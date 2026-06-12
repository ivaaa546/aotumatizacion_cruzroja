import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

const envPath = join(__dirname, '..', '.env');

app.use(express.json());

const dataDir = join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir, { recursive: true });
}

// Configurar multer para guardar en 'data/'
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, dataDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'job-' + uniqueSuffix + '.json');
    }
});
const upload = multer({ storage: storage });

app.use(express.static(join(__dirname, '..', 'public')));

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ jobId: req.file.filename });
});

app.get('/api/stream', (req, res) => {
    const { jobId, type } = req.query;
    
    if (!jobId || !type) {
        return res.status(400).send('Faltan parámetros');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const script = type === 'consultation' ? 'src/consultation.js' : 'src/upload.js';
    
    const child = spawn('node', [script, jobId], {
        cwd: join(__dirname, '..'),
        env: process.env // Pasamos las .env tal cual para que el hijo las pueda usar (dotenv/config en el root/child)
    });

    child.stdout.on('data', (data) => {
        // Enviar lineas por chunks para que no se atore
        const text = data.toString();
        res.write(`data: ${JSON.stringify({ type: 'stdout', text })}\n\n`);
    });

    child.stderr.on('data', (data) => {
        const text = data.toString();
        res.write(`data: ${JSON.stringify({ type: 'stderr', text })}\n\n`);
    });

    child.on('close', (code) => {
        res.write(`data: ${JSON.stringify({ type: 'close', code })}\n\n`);
        res.end();
        
        // Limpiamos el archivo residual después de que acabe el trabajo
        fs.unlink(join(dataDir, jobId), () => {});
    });
    
    req.on('close', () => {
        child.kill();
    });
});

// Config Endpoints
app.get('/api/morbilities', async (req, res) => {
    try {
        const response = await fetch(`${process.env.SIGGA_BASE_URL}/morbidity`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SIGGA_TOKEN}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        res.json(Array.isArray(data) ? data : (data.data || []));
    } catch (err) {
        res.status(500).json({ error: 'No se pudieron obtener las morbilidades' });
    }
});

// Config Endpoints
app.get('/api/config', (req, res) => {
    try {
        const content = fs.readFileSync(envPath, 'utf8');
        const config = {};
        content.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value && !key.startsWith('#')) {
                config[key.trim()] = value.trim();
            }
        });
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: 'No se pudo leer el archivo .env' });
    }
});

app.post('/api/config', (req, res) => {
    try {
        const newConfig = req.body;
        let content = fs.readFileSync(envPath, 'utf8');
        
        Object.keys(newConfig).forEach(key => {
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (content.match(regex)) {
                content = content.replace(regex, `${key}=${newConfig[key]}`);
            } else {
                content += `\n${key}=${newConfig[key]}`;
            }
        });

        fs.writeFileSync(envPath, content);
        
        // Actualizar process.env para que los scripts hijos hereden los nuevos valores inmediatamente
        Object.keys(newConfig).forEach(key => {
            process.env[key] = newConfig[key];
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'No se pudo guardar la configuración' });
    }
});

app.listen(port, () => {
    console.log(`🚀 Frontend SIGGA Web lanzado en http://localhost:${port}`);
});
