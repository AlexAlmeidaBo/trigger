const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const agent = require('./agent');

class WhatsAppManager {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.qrCode = null;
        this.connectionStatus = 'disconnected';
        this.wsClients = new Set();
    }

    initialize() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '..', 'data', '.wwebjs_auth')
            }),
            puppeteer: {
                headless: true,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--disable-software-rasterizer',
                    '--disable-features=site-per-process',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ],
                timeout: 60000
            },
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/AudealizJS/AudealizJS/refs/heads/main/AudealizJS'
            }
        });

        this.setupEventListeners();

        console.log('Initializing WhatsApp client...');
        this.client.initialize().catch(err => {
            console.error('Failed to initialize WhatsApp client:', err);
            this.connectionStatus = 'error';
            this.broadcast({ type: 'status', status: 'error', message: err.message });
        });
    }

    setupEventListeners() {
        this.client.on('qr', async (qr) => {
            console.log('QR Code received');
            this.connectionStatus = 'qr';

            try {
                this.qrCode = await qrcode.toDataURL(qr);
                this.broadcast({ type: 'qr', qrCode: this.qrCode });
            } catch (err) {
                console.error('Error generating QR code:', err);
            }
        });

        this.client.on('ready', async () => {
            console.log('WhatsApp client is ready!');
            this.isReady = true;
            this.qrCode = null;
            this.connectionStatus = 'connected';

            // Get account info
            try {
                const info = this.client.info;
                this.accountInfo = {
                    phoneNumber: info?.wid?.user || 'Desconhecido',
                    name: info?.pushname || 'WhatsApp',
                    platform: info?.platform || 'web'
                };
                console.log('Connected as:', this.accountInfo.phoneNumber, '-', this.accountInfo.name);
            } catch (e) {
                this.accountInfo = null;
            }

            this.broadcast({
                type: 'status',
                status: 'connected',
                accountInfo: this.accountInfo
            });
        });

        this.client.on('authenticated', () => {
            console.log('WhatsApp authenticated');
            this.connectionStatus = 'authenticating';
            this.broadcast({ type: 'status', status: 'authenticating' });
        });

        this.client.on('auth_failure', (msg) => {
            console.error('Authentication failed:', msg);
            this.connectionStatus = 'auth_failed';
            this.broadcast({ type: 'status', status: 'auth_failed', message: msg });
        });

        this.client.on('disconnected', (reason) => {
            console.log('WhatsApp disconnected:', reason);
            this.isReady = false;
            this.connectionStatus = 'disconnected';
            this.broadcast({ type: 'status', status: 'disconnected', reason });
        });

        this.client.on('message', async (msg) => {
            // Handle incoming messages
            console.log('Message received from:', msg.from, '- Body:', msg.body.substring(0, 50));

            // Agent is currently in STANDBY - uncomment to enable
            // Only respond to private messages (not groups)
            // if (!msg.isGroupMsg && !msg.fromMe) {
            //     await this.handlePrivateMessage(msg);
            // }
        });
    }

    // WebSocket management
    addWsClient(ws) {
        this.wsClients.add(ws);

        // Send current status to new client
        ws.send(JSON.stringify({
            type: 'status',
            status: this.connectionStatus,
            qrCode: this.qrCode
        }));
    }

    removeWsClient(ws) {
        this.wsClients.delete(ws);
    }

    broadcast(data) {
        const message = JSON.stringify(data);
        this.wsClients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        });
    }

    // Handle private messages with agent
    async handlePrivateMessage(msg) {
        // Skip if client is not ready
        if (!this.isReady) {
            console.log('WhatsApp not ready, skipping message');
            return;
        }

        try {
            // Get contact info with timeout protection
            const contact = await Promise.race([
                msg.getContact(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);

            const contactId = contact.id?.user || 'unknown';
            const contactName = contact.pushname || contact.name || contactId;

            // For now, use a default user ID (in production this would be tied to account)
            const userId = 'default';

            // Check if agent is enabled
            if (!agent.isEnabled(userId)) {
                return; // Silently skip if agent disabled
            }

            console.log(`Agent responding to ${contactName}: ${msg.body?.substring(0, 50) || ''}`);

            // Generate response using AI
            const response = await agent.generateResponse(userId, contactId, msg.body, contactName);

            if (response && this.isReady) {
                // Send reply with error handling
                try {
                    await msg.reply(response);
                    console.log(`Agent replied to ${contactName}: ${response.substring(0, 50)}`);

                    // Broadcast to UI
                    this.broadcast({
                        type: 'agent_reply',
                        contact: contactName,
                        message: msg.body,
                        response: response,
                        timestamp: new Date()
                    });
                } catch (replyErr) {
                    console.error('Failed to send reply:', replyErr.message);
                }
            }
        } catch (err) {
            // Silently handle errors to prevent server crash
            if (err.message !== 'Timeout') {
                console.error('Error handling private message:', err.message);
            }
        }
    }

    // Get all chats
    async getChats() {
        if (!this.isReady) throw new Error('WhatsApp not connected');
        return await this.client.getChats();
    }

    // Get groups
    async getGroups() {
        if (!this.isReady) throw new Error('WhatsApp not connected');

        const chats = await this.client.getChats();
        return chats.filter(chat => chat.isGroup).map(group => ({
            id: group.id._serialized,
            name: group.name,
            participantsCount: group.participants?.length || 0
        }));
    }

    // Get group participants
    async getGroupParticipants(groupId) {
        if (!this.isReady) throw new Error('WhatsApp not connected');

        const chat = await this.client.getChatById(groupId);
        if (!chat.isGroup) throw new Error('Not a group');

        const participants = [];
        for (const participant of chat.participants) {
            try {
                const contact = await this.client.getContactById(participant.id._serialized);
                participants.push({
                    phone: participant.id.user,
                    name: contact.pushname || contact.name || participant.id.user,
                    isAdmin: participant.isAdmin || participant.isSuperAdmin
                });
            } catch (err) {
                participants.push({
                    phone: participant.id.user,
                    name: participant.id.user,
                    isAdmin: false
                });
            }
        }

        return participants;
    }

    // Send message
    async sendMessage(phone, message) {
        if (!this.isReady) throw new Error('WhatsApp not connected');

        // Format phone number
        let formattedPhone = phone.replace(/\D/g, '');
        if (!formattedPhone.includes('@c.us')) {
            formattedPhone = `${formattedPhone}@c.us`;
        }

        try {
            const result = await this.client.sendMessage(formattedPhone, message);
            return { success: true, messageId: result.id._serialized };
        } catch (err) {
            console.error(`Failed to send message to ${phone}:`, err);
            throw err;
        }
    }

    // Send messages in batch with delay
    async sendBatchMessages(contacts, getMessage, delayMs, onProgress) {
        if (!this.isReady) throw new Error('WhatsApp not connected');

        const results = [];

        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            const message = await getMessage(contact);

            try {
                const result = await this.sendMessage(contact.phone, message);
                results.push({
                    contact,
                    success: true,
                    messageId: result.messageId
                });

                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total: contacts.length,
                        contact,
                        status: 'sent'
                    });
                }
            } catch (err) {
                results.push({
                    contact,
                    success: false,
                    error: err.message
                });

                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total: contacts.length,
                        contact,
                        status: 'failed',
                        error: err.message
                    });
                }
            }

            // Wait before sending next message
            if (i < contacts.length - 1 && delayMs > 0) {
                await this.delay(delayMs);
            }
        }

        return results;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get connection info
    getInfo() {
        return {
            isReady: this.isReady,
            status: this.connectionStatus,
            hasQr: !!this.qrCode,
            qrCode: this.qrCode,
            accountInfo: this.accountInfo || null
        };
    }

    // Disconnect
    async disconnect() {
        if (this.client) {
            await this.client.destroy();
            this.isReady = false;
            this.connectionStatus = 'disconnected';
        }
    }

    // Logout and clear session
    async logout() {
        if (this.client) {
            await this.client.logout();
            this.isReady = false;
            this.qrCode = null;
            this.connectionStatus = 'disconnected';
        }
    }
}

module.exports = new WhatsAppManager();
