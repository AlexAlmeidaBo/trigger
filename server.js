const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// Import modules
const db = require('./src/database');
const whatsapp = require('./src/whatsapp');
const contactsRouter = require('./src/routes/contacts');
const messagesRouter = require('./src/routes/messages');
const reportsRouter = require('./src/routes/reports');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/contacts', contactsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/reports', reportsRouter);

// WhatsApp status endpoint
app.get('/api/whatsapp/status', (req, res) => {
    res.json(whatsapp.getInfo());
});

// WhatsApp QR code endpoint
app.get('/api/whatsapp/qr', (req, res) => {
    const info = whatsapp.getInfo();
    if (info.hasQr) {
        res.json({ success: true, qrCode: whatsapp.qrCode });
    } else {
        res.json({ success: false, status: info.status });
    }
});

// Reconnect WhatsApp
app.post('/api/whatsapp/reconnect', async (req, res) => {
    try {
        await whatsapp.disconnect();
        whatsapp.initialize();
        res.json({ success: true, message: 'Reconnecting...' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Logout WhatsApp
app.post('/api/whatsapp/logout', async (req, res) => {
    try {
        await whatsapp.logout();
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// WebSocket handling
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    whatsapp.addWsClient(ws);

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        whatsapp.removeWsClient(ws);
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        whatsapp.removeWsClient(ws);
    });
});

// Serve index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
async function start() {
    try {
        // Initialize database
        console.log('Initializing database...');
        await db.init();

        // Start server
        server.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 WhatsApp Mass Sender - Server Running                   ║
║                                                               ║
║   Local:   http://localhost:${PORT}                            ║
║                                                               ║
║   Press Ctrl+C to stop                                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
            `);

            // Initialize WhatsApp client
            console.log('Initializing WhatsApp client...');
            whatsapp.initialize();
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await whatsapp.disconnect();
    process.exit(0);
});
