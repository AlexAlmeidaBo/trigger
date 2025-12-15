const express = require('express');
const router = express.Router();
const db = require('../database');
const whatsapp = require('../whatsapp');
const ai = require('../ai-variations');
const { getUserId } = require('../authMiddleware');

// Get all templates
router.get('/templates', (req, res) => {
    try {
        const userId = getUserId(req);
        const templates = db.getAllTemplates(userId);
        res.json({ success: true, templates });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create template
router.post('/templates', (req, res) => {
    try {
        const userId = getUserId(req);
        const { name, content } = req.body;

        if (!name || !content) {
            return res.status(400).json({ success: false, error: 'Name and content are required' });
        }

        const result = db.insertTemplate(name, content, userId);
        res.json({
            success: true,
            id: result.lastInsertRowid,
            message: 'Template created successfully'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update template
router.put('/templates/:id', (req, res) => {
    try {
        const userId = getUserId(req);
        const { name, content } = req.body;
        db.updateTemplate(req.params.id, name, content, userId);
        res.json({ success: true, message: 'Template updated' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete template
router.delete('/templates/:id', (req, res) => {
    try {
        const userId = getUserId(req);
        db.deleteTemplate(req.params.id, userId);
        res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Generate AI variations (premium only)
router.post('/variations', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { message, level } = req.body;

        // Check if user has premium access
        const isPremium = db.isPremiumUser(userId);
        if (!isPremium) {
            return res.status(403).json({
                success: false,
                error: 'Texto Mágico é um recurso exclusivo para assinantes.',
                code: 'PREMIUM_REQUIRED',
                upgradeUrl: 'https://pay.kirvano.com/245a1b99-0627-4f2b-93fa-adf5dc52ffee'
            });
        }

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const variations = await ai.generateVariations(message, level || 'medium');
        res.json({ success: true, variations });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Set AI API key
router.post('/ai-config', (req, res) => {
    try {
        const { apiKey } = req.body;
        ai.setApiKey(apiKey);
        res.json({ success: true, message: 'API key configured' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get all campaigns
router.get('/campaigns', (req, res) => {
    try {
        const userId = getUserId(req);
        const campaigns = db.getAllCampaigns(userId);
        res.json({ success: true, campaigns });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get campaign by ID
router.get('/campaigns/:id', (req, res) => {
    try {
        const campaign = db.getCampaignById(req.params.id);
        const logs = db.getLogsByCampaign(req.params.id);
        res.json({ success: true, campaign, logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Active campaign tracking
let activeCampaign = null;

// Create and start campaign
router.post('/campaigns', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { name, message, contactIds, delayConfig, delaySeconds, variationLevel } = req.body;

        // ANTI-SPAM PROTECTION: Enforce minimum safe delays
        // WhatsApp blocks even 15-35s delays, so we need much higher minimums
        const SAFE_MINIMUMS = {
            delayMin: 60,        // At least 60 seconds between messages
            delayMax: 180,       // Up to 3 minutes between messages  
            batchSize: 3,        // Only 3 messages per batch
            batchDelayMin: 300,  // 5 minute pause between batches
            batchDelayMax: 600   // Up to 10 minute pause between batches
        };

        // Get user config or defaults
        let config = delayConfig || {
            delayMin: SAFE_MINIMUMS.delayMin,
            delayMax: SAFE_MINIMUMS.delayMax,
            batchSize: SAFE_MINIMUMS.batchSize,
            batchDelayMin: SAFE_MINIMUMS.batchDelayMin,
            batchDelayMax: SAFE_MINIMUMS.batchDelayMax
        };

        // ENFORCE MINIMUMS: Don't allow unsafe delays
        config.delayMin = Math.max(config.delayMin || 60, SAFE_MINIMUMS.delayMin);
        config.delayMax = Math.max(config.delayMax || 180, SAFE_MINIMUMS.delayMax);
        config.batchSize = Math.min(config.batchSize || 3, SAFE_MINIMUMS.batchSize);
        config.batchDelayMin = Math.max(config.batchDelayMin || 300, SAFE_MINIMUMS.batchDelayMin);
        config.batchDelayMax = Math.max(config.batchDelayMax || 600, SAFE_MINIMUMS.batchDelayMax);

        console.log('Creating campaign with SAFE config:', { name, contacts: contactIds?.length, delayConfig: config, variationLevel });

        if (!message || !contactIds || contactIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message and contacts are required'
            });
        }

        // ANTI-SPAM: Limit max contacts per campaign to avoid detection
        const MAX_CONTACTS_PER_CAMPAIGN = 20;
        if (contactIds.length > MAX_CONTACTS_PER_CAMPAIGN) {
            return res.status(400).json({
                success: false,
                error: `⚠️ Máximo ${MAX_CONTACTS_PER_CAMPAIGN} contatos por campanha para evitar bloqueio do WhatsApp. Você selecionou ${contactIds.length}.`,
                code: 'MAX_CONTACTS_EXCEEDED',
                maxContacts: MAX_CONTACTS_PER_CAMPAIGN,
                selectedContacts: contactIds.length
            });
        }

        // Check message limits for freemium users
        const DAILY_LIMIT = 15;
        const limits = db.canSendMessages(userId, contactIds.length, DAILY_LIMIT);

        if (!limits.allowed) {
            return res.status(403).json({
                success: false,
                error: `Limite diário atingido! Você pode enviar apenas ${DAILY_LIMIT} mensagens por dia no plano grátis.`,
                code: 'DAILY_LIMIT_REACHED',
                remaining: limits.remaining,
                limit: limits.limit,
                upgradeUrl: 'https://pay.kirvano.com/245a1b99-0627-4f2b-93fa-adf5dc52ffee'
            });
        }

        // For free users, limit the number of contacts they can send to
        let contactsToSend = contactIds;
        if (!limits.isPremium && contactIds.length > limits.remaining) {
            contactsToSend = contactIds.slice(0, limits.remaining);
            console.log(`Free user: limiting from ${contactIds.length} to ${contactsToSend.length} contacts`);
        }

        // Get contacts
        const allContacts = db.getAllContacts(userId);
        const selectedContacts = allContacts.filter(c => contactsToSend.includes(c.id));
        console.log('Selected contacts:', selectedContacts.length);

        if (selectedContacts.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid contacts found' });
        }

        // Create template if not exists
        const templateResult = db.insertTemplate(
            name || `Campaign ${Date.now()}`,
            message,
            userId
        );
        console.log('Template created, ID:', templateResult.lastInsertRowid);

        // Create campaign (store average delay for compatibility)
        const avgDelay = Math.round((config.delayMin + config.delayMax) / 2);
        const campaignResult = db.insertCampaign(
            name || `Campaign ${Date.now()}`,
            templateResult.lastInsertRowid,
            avgDelay,
            variationLevel || 'none',
            selectedContacts.length,
            userId
        );

        const campaignId = campaignResult.lastInsertRowid;
        console.log('Campaign created, ID:', campaignId);

        if (!campaignId) {
            throw new Error('Failed to create campaign - no ID returned');
        }

        // Create message logs
        for (const contact of selectedContacts) {
            db.insertMessageLog(campaignId, contact.id, message);
        }

        // Start campaign in background
        db.updateCampaignStatus(campaignId, 'running');
        activeCampaign = campaignId;
        console.log('Campaign started, activeCampaign:', activeCampaign);

        // Run campaign asynchronously with advanced delay config
        runCampaign(campaignId, selectedContacts, message, config, variationLevel || 'none');

        res.json({
            success: true,
            campaignId,
            message: 'Campaign started'
        });
    } catch (err) {
        console.error('Error creating campaign:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Stop campaign
router.post('/campaigns/:id/stop', (req, res) => {
    try {
        const campaignId = parseInt(req.params.id);
        console.log(`Stop request for campaign ${campaignId}, activeCampaign is ${activeCampaign}`);

        if (activeCampaign === campaignId) {
            activeCampaign = null;

            // Get current campaign stats before stopping
            const campaign = db.getCampaignById(campaignId);
            db.updateCampaignStatus(campaignId, 'stopped', campaign?.sent_count || 0, campaign?.failed_count || 0);

            console.log(`Campaign ${campaignId} stopped`);
        }

        res.json({ success: true, message: 'Campaign stopped' });
    } catch (err) {
        console.error('Error stopping campaign:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Run campaign function with advanced delay
async function runCampaign(campaignId, contacts, message, delayConfig, variationLevel) {
    console.log(`Starting campaign ${campaignId} with ${contacts.length} contacts`);
    console.log('Delay config:', delayConfig);
    console.log('Variation level received:', variationLevel);

    let sentCount = 0;
    let failedCount = 0;

    // Extract delay config
    const { delayMin, delayMax, batchSize, batchDelayMin, batchDelayMax } = delayConfig;

    for (let i = 0; i < contacts.length; i++) {
        // Check if campaign was stopped
        if (activeCampaign !== campaignId) {
            console.log(`Campaign ${campaignId} was stopped`);
            break;
        }

        const contact = contacts[i];
        const messageNum = i + 1;

        try {
            // Get message variation
            console.log(`Getting variation for contact ${contact.name}, level: ${variationLevel}`);
            const finalMessage = await ai.getRandomVariation(message, variationLevel, contact);
            console.log(`Original: "${message.substring(0, 50)}..." | Final: "${finalMessage.substring(0, 50)}..."`);

            // Send message
            await whatsapp.sendMessage(contact.phone, finalMessage);

            sentCount++;
            console.log(`Campaign ${campaignId}: Sent to ${contact.name} (${sentCount}/${contacts.length})`);

            // Update log
            const logs = db.getLogsByCampaign(campaignId);
            const log = logs.find(l => l.contact_id === contact.id);
            if (log) {
                db.updateMessageLog(log.id, 'sent');
            }

            // Broadcast progress
            whatsapp.broadcast({
                type: 'campaign_progress',
                campaignId,
                current: messageNum,
                total: contacts.length,
                contact: contact.name,
                status: 'sent'
            });
        } catch (err) {
            failedCount++;
            console.log(`Campaign ${campaignId}: Failed for ${contact.name} - ${err.message}`);

            const logs = db.getLogsByCampaign(campaignId);
            const log = logs.find(l => l.contact_id === contact.id);
            if (log) {
                db.updateMessageLog(log.id, 'failed', err.message);
            }

            whatsapp.broadcast({
                type: 'campaign_progress',
                campaignId,
                current: messageNum,
                total: contacts.length,
                contact: contact.name,
                status: 'failed',
                error: err.message
            });
        }

        // Update campaign stats during execution
        db.updateCampaignStatus(campaignId, 'running', sentCount, failedCount);

        // Apply delays (only if not the last message)
        if (i < contacts.length - 1) {
            // Check if we need a batch pause (after every batchSize messages)
            if (messageNum % batchSize === 0) {
                // Batch pause - larger delay after X messages
                const batchDelay = randomDelay(batchDelayMin, batchDelayMax);
                console.log(`Campaign ${campaignId}: Batch pause ${batchDelay}s after ${messageNum} messages`);

                whatsapp.broadcast({
                    type: 'campaign_progress',
                    campaignId,
                    current: messageNum,
                    total: contacts.length,
                    contact: `Pausa de ${batchDelay}s...`,
                    status: 'waiting'
                });

                await delay(batchDelay * 1000);
            } else {
                // Normal delay between messages
                const msgDelay = randomDelay(delayMin, delayMax);
                console.log(`Campaign ${campaignId}: Waiting ${msgDelay}s before next message`);
                await delay(msgDelay * 1000);
            }
        }
    }

    // Complete campaign
    const finalStatus = activeCampaign === campaignId ? 'completed' : 'stopped';
    console.log(`Campaign ${campaignId}: Completing with status=${finalStatus}, sent=${sentCount}, failed=${failedCount}`);
    db.updateCampaignStatus(campaignId, finalStatus, sentCount, failedCount);
    activeCampaign = null;

    whatsapp.broadcast({
        type: 'campaign_complete',
        campaignId,
        status: finalStatus,
        sent: sentCount,
        failed: failedCount
    });
}

// Helper: Random delay between min and max seconds
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Delay promise
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;
