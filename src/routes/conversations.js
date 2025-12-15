/**
 * Conversations API Routes
 * 
 * Endpoints for managing conversations and handoff
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { getUserId } = require('../authMiddleware');

// Get all conversations for user
router.get('/', (req, res) => {
    try {
        const userId = getUserId(req);
        const conversations = db.getActiveConversations(userId);

        // Enrich with archetype info
        const enriched = conversations.map(conv => {
            const archetype = conv.archetype_id ? db.getArchetypeById(conv.archetype_id) : null;
            return {
                ...conv,
                archetype: archetype ? {
                    key: archetype.key,
                    niche: archetype.niche,
                    persona_name: archetype.persona_name
                } : null
            };
        });

        res.json({ success: true, conversations: enriched });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get escalated conversations only
router.get('/escalated', (req, res) => {
    try {
        const userId = getUserId(req);
        const all = db.getActiveConversations(userId);
        const escalated = all.filter(c => c.handoff_status === 'ESCALATED');

        // Enrich with archetype info
        const enriched = escalated.map(conv => {
            const archetype = conv.archetype_id ? db.getArchetypeById(conv.archetype_id) : null;
            return {
                ...conv,
                archetype: archetype ? {
                    key: archetype.key,
                    niche: archetype.niche,
                    persona_name: archetype.persona_name
                } : null
            };
        });

        res.json({ success: true, conversations: enriched });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get single conversation
router.get('/:id', (req, res) => {
    try {
        const conversation = db.getConversationById(parseInt(req.params.id));
        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        const archetype = conversation.archetype_id ? db.getArchetypeById(conversation.archetype_id) : null;

        res.json({
            success: true,
            conversation: {
                ...conversation,
                archetype: archetype ? {
                    key: archetype.key,
                    niche: archetype.niche,
                    persona_name: archetype.persona_name,
                    tone: archetype.tone
                } : null
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Take over conversation (human assumes control)
router.post('/:id/take-over', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const conversation = db.getConversationById(id);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        db.takeOverConversation(id);

        res.json({
            success: true,
            message: 'Conversa assumida pelo humano',
            handoff_status: 'HUMAN_TAKEN'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Return conversation to agent
router.post('/:id/return', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const conversation = db.getConversationById(id);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        db.returnToAgent(id);

        res.json({
            success: true,
            message: 'Conversa devolvida ao agente',
            handoff_status: 'NONE'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Add note to conversation
router.post('/:id/notes', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { note } = req.body;

        const conversation = db.getConversationById(id);
        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        // Append note with timestamp
        const existingNotes = conversation.notes ? JSON.parse(conversation.notes) : [];
        existingNotes.push({
            text: note,
            timestamp: new Date().toISOString(),
            author: getUserId(req)
        });

        db.updateConversation(id, { notes: JSON.stringify(existingNotes) });

        res.json({ success: true, message: 'Nota adicionada' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get conversation metrics
router.get('/metrics/summary', (req, res) => {
    try {
        const userId = getUserId(req);
        const conversations = db.getActiveConversations(userId);

        const today = new Date().toISOString().split('T')[0];

        const metrics = {
            total: conversations.length,
            active: conversations.filter(c => c.handoff_status === 'NONE').length,
            escalated: conversations.filter(c => c.handoff_status === 'ESCALATED').length,
            human_taken: conversations.filter(c => c.handoff_status === 'HUMAN_TAKEN').length,
            today: conversations.filter(c => c.created_at?.startsWith(today)).length
        };

        res.json({ success: true, metrics });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
