const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// OpenAI API key should be set via environment variable OPENAI_API_KEY

// Import modules
const db = require('./src/database');
const whatsapp = require('./src/whatsapp');
const { authMiddleware } = require('./src/authMiddleware');
const authRouter = require('./src/routes/auth');
const contactsRouter = require('./src/routes/contacts');
const messagesRouter = require('./src/routes/messages');
const reportsRouter = require('./src/routes/reports');
const groupSearchRouter = require('./src/routes/group-search');
const agentRouter = require('./src/routes/agent');
const subscriptionsRouter = require('./src/routes/subscriptions');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Redirect root to landing page
app.get('/', (req, res) => {
    res.redirect('/landing.html');
});

app.use(express.static(path.join(__dirname, 'public')));

// Webhook route (no auth required - must be before authMiddleware)
app.use('/api/webhook', subscriptionsRouter);

// Auth middleware for API routes
app.use('/api', authMiddleware);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/groups', groupSearchRouter);
app.use('/api/agent', agentRouter);
app.use('/api/subscription', subscriptionsRouter);

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

// Request pairing code
app.post('/api/whatsapp/pairing-code', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }

        const result = await whatsapp.requestPairingCode(phoneNumber);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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
