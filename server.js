const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
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

    // Escucha un evento de ejemplo 'cambio-dato' desde un cliente
    socket.on('cambio-dato', (data) => {
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