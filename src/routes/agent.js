const express = require('express');
const router = express.Router();
const agent = require('../agent');
const db = require('../database');
const { getUserId } = require('../authMiddleware');

// Get agent config
router.get('/config', (req, res) => {
    try {
        const userId = getUserId(req);
        const config = agent.getConfig(userId);
        const isPremium = db.isPremiumUser(userId);
        res.json({ success: true, config, isPremium });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update agent config (premium only)
router.post('/config', (req, res) => {
    try {
        const userId = getUserId(req);

        // Check if user has premium access
        const isPremium = db.isPremiumUser(userId);
        if (!isPremium) {
            return res.status(403).json({
                success: false,
                error: 'Agente IA é um recurso exclusivo para assinantes.',
                code: 'PREMIUM_REQUIRED',
                upgradeUrl: 'https://pay.kirvano.com/245a1b99-0627-4f2b-93fa-adf5dc52ffee'
            });
        }

        const { enabled, prompt } = req.body;

        const config = agent.setConfig(userId, { enabled, prompt });
        res.json({ success: true, config, message: 'Configuração salva!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Toggle agent on/off
router.post('/toggle', (req, res) => {
    try {
        const userId = getUserId(req);
        const { enabled } = req.body;

        const config = agent.setConfig(userId, { enabled });
        res.json({
            success: true,
            enabled: config.enabled,
            message: config.enabled ? 'Agente ativado!' : 'Agente desativado'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get agent logs
router.get('/logs', (req, res) => {
    try {
        const userId = getUserId(req);
        const logs = agent.getLogs(userId);
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Clear conversation with a contact
router.delete('/conversation/:contactId', (req, res) => {
    try {
        const userId = getUserId(req);
        agent.clearConversation(userId, req.params.contactId);
        res.json({ success: true, message: 'Conversa limpa' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
