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

// ===== COCKPIT ENDPOINTS =====

// Advanced inbox filter with multiple criteria
router.get('/filter/inbox', (req, res) => {
    try {
        const userId = getUserId(req);
        const { status, campaign_id, archetype_id, has_tag, sort_by } = req.query;

        let conversations = db.getActiveConversations(userId);

        // Filter by status
        if (status && status !== 'ALL') {
            conversations = conversations.filter(c => c.handoff_status === status);
        }

        // Filter by campaign
        if (campaign_id) {
            conversations = conversations.filter(c => c.campaign_id === parseInt(campaign_id));
        }

        // Filter by archetype (brain)
        if (archetype_id) {
            conversations = conversations.filter(c => c.archetype_id === parseInt(archetype_id));
        }

        // Filter by tag
        if (has_tag) {
            conversations = conversations.filter(c => {
                const tags = c.tags ? JSON.parse(c.tags) : [];
                return tags.includes(has_tag);
            });
        }

        // Filter out silenced (unless specifically requested)
        if (req.query.include_silenced !== 'true') {
            conversations = conversations.filter(c => !c.silenced);
        }

        // Sort by urgency (last policy event timestamp)
        if (sort_by === 'urgency') {
            conversations.sort((a, b) => {
                const aTime = a.last_policy_event ? new Date(a.last_policy_event).getTime() : 0;
                const bTime = b.last_policy_event ? new Date(b.last_policy_event).getTime() : 0;
                return bTime - aTime; // Most recent first
            });
        } else if (sort_by === 'status') {
            const statusOrder = { 'ESCALATED': 0, 'HUMAN_TAKEN': 1, 'NONE': 2 };
            conversations.sort((a, b) => statusOrder[a.handoff_status] - statusOrder[b.handoff_status]);
        }

        // Enrich with archetype and extract last policy reason
        const enriched = conversations.map(conv => {
            const archetype = conv.archetype_id ? db.getArchetypeById(conv.archetype_id) : null;
            let lastPolicyReason = null;
            let tags = [];

            try {
                const logs = conv.policy_log ? JSON.parse(conv.policy_log) : [];
                if (logs.length > 0) {
                    lastPolicyReason = logs[logs.length - 1].reason;
                }
            } catch (e) { }

            try {
                tags = conv.tags ? JSON.parse(conv.tags) : [];
            } catch (e) { }

            return {
                ...conv,
                tags,
                last_policy_reason: lastPolicyReason,
                archetype: archetype ? {
                    key: archetype.key,
                    niche: archetype.niche,
                    persona_name: archetype.persona_name
                } : null
            };
        });

        res.json({ success: true, conversations: enriched, total: enriched.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Silence a conversation (agent won't respond)
router.post('/:id/silence', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { silenced } = req.body;

        const conversation = db.getConversationById(id);
        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        db.updateConversation(id, { silenced: silenced ? 1 : 0 });

        res.json({
            success: true,
            message: silenced ? 'Conversa silenciada' : 'Conversa reativada',
            silenced
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get conversation message history
router.get('/:id/messages', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const conversation = db.getConversationById(id);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        // Get messages from message_logs table for this contact
        const messages = db.all(`
            SELECT * FROM message_logs 
            WHERE contact_id = ? 
            ORDER BY sent_at ASC
        `, [conversation.contact_phone]);

        res.json({ success: true, messages, conversation_id: id });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Advanced metrics for cockpit dashboard
router.get('/metrics/advanced', (req, res) => {
    try {
        const userId = getUserId(req);
        const conversations = db.getActiveConversations(userId);

        // Count by status
        const byStatus = {
            NONE: 0,
            ESCALATED: 0,
            HUMAN_TAKEN: 0
        };

        // Count by campaign
        const byCampaign = {};

        // Count by archetype
        const byArchetype = {};

        // Count policy reasons
        const policyReasons = {};

        // Count stops and blocks
        let stopCount = 0;
        let blockCount = 0;
        let escalateCount = 0;

        conversations.forEach(conv => {
            // Status
            byStatus[conv.handoff_status] = (byStatus[conv.handoff_status] || 0) + 1;

            // Campaign
            if (conv.campaign_id) {
                byCampaign[conv.campaign_id] = (byCampaign[conv.campaign_id] || 0) + 1;
            }

            // Archetype
            if (conv.archetype_id) {
                byArchetype[conv.archetype_id] = (byArchetype[conv.archetype_id] || 0) + 1;
            }

            // Policy logs
            try {
                const logs = conv.policy_log ? JSON.parse(conv.policy_log) : [];
                logs.forEach(log => {
                    if (log.reason) {
                        policyReasons[log.reason] = (policyReasons[log.reason] || 0) + 1;
                    }
                    if (log.action === 'STOPPED') stopCount++;
                    if (log.action === 'BLOCKED') blockCount++;
                    if (log.action === 'ESCALATED') escalateCount++;
                });
            } catch (e) { }
        });

        // Top 10 escalation reasons
        const topReasons = Object.entries(policyReasons)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([reason, count]) => ({ reason, count }));

        // Escalation rate by campaign
        const escalationByCampaign = {};
        Object.keys(byCampaign).forEach(campaignId => {
            const total = byCampaign[campaignId];
            const escalated = conversations.filter(
                c => c.campaign_id === parseInt(campaignId) && c.handoff_status === 'ESCALATED'
            ).length;
            escalationByCampaign[campaignId] = {
                total,
                escalated,
                rate: total > 0 ? Math.round((escalated / total) * 100) : 0
            };
        });

        const total = conversations.length;

        res.json({
            success: true,
            metrics: {
                total,
                byStatus,
                byArchetype,
                byCampaign,
                escalationByCampaign,
                topReasons,
                stopRate: total > 0 ? Math.round((stopCount / total) * 100) : 0,
                blockRate: total > 0 ? Math.round((blockCount / total) * 100) : 0,
                escalateRate: total > 0 ? Math.round((escalateCount / total) * 100) : 0
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;

