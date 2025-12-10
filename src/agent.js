const OpenAI = require('openai');

class Agent {
    constructor() {
        // Configuration per user
        this.configs = new Map();
        this.conversations = new Map();

        // OpenAI client
        this.openai = process.env.OPENAI_API_KEY
            ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
            : null;
    }

    // Get or create config for user
    getConfig(userId) {
        if (!this.configs.has(userId)) {
            this.configs.set(userId, {
                enabled: false,
                prompt: 'Você é um assistente virtual. Responda de forma educada e prestativa.',
                createdAt: new Date()
            });
        }
        return this.configs.get(userId);
    }

    // Update config
    setConfig(userId, config) {
        const current = this.getConfig(userId);
        this.configs.set(userId, {
            ...current,
            ...config,
            updatedAt: new Date()
        });
        return this.getConfig(userId);
    }

    // Check if agent is enabled for user
    isEnabled(userId) {
        return this.getConfig(userId).enabled;
    }

    // Get conversation context for a contact
    getConversation(userId, contactId) {
        const key = `${userId}:${contactId}`;
        if (!this.conversations.has(key)) {
            this.conversations.set(key, []);
        }
        return this.conversations.get(key);
    }

    // Add message to conversation
    addToConversation(userId, contactId, role, content) {
        const conversation = this.getConversation(userId, contactId);
        conversation.push({ role, content, timestamp: new Date() });

        // Keep only last 10 messages for context
        if (conversation.length > 10) {
            conversation.shift();
        }
    }

    // Generate response using OpenAI
    async generateResponse(userId, contactId, message, contactName) {
        if (!this.openai) {
            console.log('OpenAI not configured, using fallback response');
            return this.getFallbackResponse(message);
        }

        const config = this.getConfig(userId);

        // Add incoming message to context
        this.addToConversation(userId, contactId, 'user', message);

        const conversation = this.getConversation(userId, contactId);

        // Build messages array for OpenAI
        const messages = [
            {
                role: 'system',
                content: `${config.prompt}\n\nVocê está conversando com ${contactName || 'um cliente'}. Responda de forma natural e concisa, como em uma conversa de WhatsApp.`
            },
            ...conversation.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        ];

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                temperature: 0.7,
                max_tokens: 500
            });

            const reply = response.choices[0]?.message?.content || this.getFallbackResponse(message);

            // Add response to context
            this.addToConversation(userId, contactId, 'assistant', reply);

            return reply;
        } catch (err) {
            console.error('OpenAI error:', err.message);
            return this.getFallbackResponse(message);
        }
    }

    // Fallback response when AI is not available
    getFallbackResponse(message) {
        const responses = [
            'Obrigado pela mensagem! Em breve retornaremos.',
            'Recebemos sua mensagem. Aguarde que logo responderemos.',
            'Olá! Sua mensagem foi recebida. Entraremos em contato em breve.'
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Get recent logs for UI
    getLogs(userId, limit = 20) {
        const logs = [];

        for (const [key, conversation] of this.conversations.entries()) {
            if (key.startsWith(userId + ':')) {
                const contactId = key.split(':')[1];
                const recentMessages = conversation.slice(-4);

                if (recentMessages.length > 0) {
                    logs.push({
                        contactId,
                        messages: recentMessages,
                        lastUpdate: recentMessages[recentMessages.length - 1]?.timestamp
                    });
                }
            }
        }

        // Sort by most recent
        logs.sort((a, b) => b.lastUpdate - a.lastUpdate);

        return logs.slice(0, limit);
    }

    // Clear conversation
    clearConversation(userId, contactId) {
        const key = `${userId}:${contactId}`;
        this.conversations.delete(key);
    }
}

module.exports = new Agent();
