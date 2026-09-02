const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');
require('dotenv').config(); // Cargar variables de entorno
const { Server } = require("socket.io");
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);

// Opciones de CORS para producción y desarrollo
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
            ? process.env.CLIENT_ORIGIN || false 
            : "*"
};
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? process.env.CLIENT_ORIGIN || false 
            : "*", // Permisivo para desarrollo local
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const TASA_FILE = path.join(ROOT_DIR, 'tasa_settings.json');

// Estado global de configuración de tasas en el servidor
let serverTasaSettings = {
    oficial: { mode: 'automatico', value: 0 },
    paralelo: { mode: 'automatico', value: 0 }
};

try {
    if (fs.existsSync(TASA_FILE)) {
        const raw = fs.readFileSync(TASA_FILE, 'utf8');
        serverTasaSettings = JSON.parse(raw);
    }
} catch (e) {
    console.warn('Aviso: No se pudo leer tasa_settings.json al iniciar:', e.message);
}

// URL del worker de autenticación, obtenida de las variables de entorno para despliegue
const WORKER_URL = process.env.WORKER_URL || 'https://total-repuestos.benjaminandresperaza.workers.dev/';

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());

// Servir archivos estáticos evitando caché obsoleta en sw.js, html y manifest
app.use(express.static(ROOT_DIR, {
    setHeaders: (res, filePath) => {
        const normalized = filePath.toLowerCase().replace(/\\/g, '/');
        if (
            normalized.endsWith('/sw.js') || 
            normalized.endsWith('.html') || 
            normalized.endsWith('/manifest.json')
        ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Endpoint de versión para verificar conectividad y cambios
app.get('/api/version', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
        version: '1.2.0',
        timestamp: Date.now(),
        status: 'online'
    });
});

// Endpoint global para obtener la configuración de tasas
app.get('/api/tasas', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({ success: true, settings: serverTasaSettings });
});

// Endpoint global para actualizar la configuración de tasas desde cualquier terminal
app.post('/api/tasas', (req, res) => {
    const { oficial, paralelo } = req.body || {};
    if (oficial && paralelo) {
        serverTasaSettings = {
            oficial: {
                mode: oficial.mode === 'manual' ? 'manual' : 'automatico',
                value: parseFloat(oficial.value) || 0
            },
            paralelo: {
                mode: paralelo.mode === 'manual' ? 'manual' : 'automatico',
                value: parseFloat(paralelo.value) || 0
            }
        };

        try {
            fs.writeFileSync(TASA_FILE, JSON.stringify(serverTasaSettings, null, 2), 'utf8');
        } catch (e) {
            console.warn('Error al guardar tasa_settings.json:', e.message);
        }

        // Emitir a todos los clientes conectados en tiempo real
        io.emit('actualizacion-dato', { type: 'rates', settings: serverTasaSettings });
        console.log('📡 Tasas globales actualizadas y sincronizadas:', serverTasaSettings);

        return res.json({ success: true, settings: serverTasaSettings });
    }
    res.status(400).json({ success: false, message: 'Datos de tasas incompletos.' });
});

// Endpoint para obtener la configuración de licencia
app.get('/api/license', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const LICENSE_FILE = path.join(ROOT_DIR, 'license_config.json');
    let config = {
        username: 'total-repuestos',
        password: 'hdf378nr',
        license_key: 'OMG-7J66-BT4Q-6LWQ-GQPX-CN5L-9QAZ',
        app_name: 'WEBSITE'
    };
    try {
        if (fs.existsSync(LICENSE_FILE)) {
            const raw = fs.readFileSync(LICENSE_FILE, 'utf8');
            config = JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Aviso: No se pudo leer license_config.json:', e.message);
    }
    res.json({ success: true, config });
});

// Endpoint para actualizar la configuración de licencia
app.post('/api/license', (req, res) => {
    const { username, password, license_key, app_name } = req.body || {};
    if (!username || !license_key) {
        return res.status(400).json({ success: false, message: 'Datos de licencia incompletos.' });
    }
    const config = {
        username: username.trim(),
        password: (password || '').trim(),
        license_key: license_key.trim(),
        app_name: (app_name || 'WEBSITE').trim()
    };
    const LICENSE_FILE = path.join(ROOT_DIR, 'license_config.json');
    try {
        fs.writeFileSync(LICENSE_FILE, JSON.stringify(config, null, 2), 'utf8');
        console.log('🔐 Configuración de licencia actualizada:', config);
        return res.json({ success: true, config });
    } catch (e) {
        console.error('Error al guardar license_config.json:', e);
        return res.status(500).json({ success: false, message: 'No se pudo guardar la configuración de licencia.' });
    }
});

// API REST - Proxy de Autenticación
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos.' });
    }

    try {
        const workerResponse = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: username, contrasena: password })
        });

        const data = await workerResponse.json();
        res.status(workerResponse.status).json(data);

    } catch (error) {
        console.error("Error al contactar el worker de autenticación:", error);
        res.status(500).json({ success: false, message: 'Error de conexión con el servicio de autenticación.' });
    }
});

// Lógica de Socket.IO para tiempo real
io.on('connection', (socket) => {
    console.log('Un cliente se ha conectado vía WebSocket');

    // Enviar configuración de tasas actual al conectar
    if (serverTasaSettings) {
        socket.emit('actualizacion-dato', { type: 'rates', settings: serverTasaSettings });
    }

    // Escucha eventos desde un cliente
    socket.on('cambio-dato', (data) => {
        if (data && data.type === 'rates' && data.settings) {
            serverTasaSettings = data.settings;
            try {
                fs.writeFileSync(TASA_FILE, JSON.stringify(serverTasaSettings, null, 2), 'utf8');
            } catch (e) {}
        }
        // Reenvía la información a todos los demás clientes conectados (excepto al emisor)
        socket.broadcast.emit('actualizacion-dato', data);
        console.log('Dato recibido y retransmitido a otros clientes:', data);
    });

    socket.on('disconnect', () => {
        console.log('Un cliente se ha desconectado');
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});