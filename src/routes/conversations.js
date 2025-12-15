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

// Add/update tags on conversation
router.post('/:id/tags', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { tags } = req.body; // array of tags

        const conversation = db.getConversationById(id);
        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        // Tags are stored as JSON array
        db.updateConversation(id, { tags: JSON.stringify(tags) });

        res.json({ success: true, message: 'Tags atualizadas', tags });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get available tag presets
router.get('/tags/presets', (req, res) => {
    const presets = [
        'LEAD_QUENTE',
        'LEAD_MORNO',
        'LEAD_FRIO',
        'LEAD_CANSADO',
        'LEAD_AUTOMATICO',
        'LEAD_DESCONFIADO',
        'PRONTO_PARA_CTA',
        'PRECISA_FOLLOW_UP',
        'NAO_INCOMODAR'
    ];
    res.json({ success: true, presets });
});

// Get policy log for conversation
router.get('/:id/policy-log', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const conversation = db.getConversationById(id);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        let logs = [];
        try {
            logs = conversation.policy_log ? JSON.parse(conversation.policy_log) : [];
        } catch (e) {
            logs = [];
        }

        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get human-taken conversations
router.get('/filter/human-taken', (req, res) => {
    try {
        const userId = getUserId(req);
        const all = db.getActiveConversations(userId);
        const humanTaken = all.filter(c => c.handoff_status === 'HUMAN_TAKEN');

        res.json({ success: true, conversations: humanTaken });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
