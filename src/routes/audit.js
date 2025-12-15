/**
 * Audit API Routes - Logs and Export
 * 
 * Endpoints for viewing and exporting policy logs
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { getUserId } = require('../authMiddleware');

// Get all policy logs with filtering
router.get('/logs', (req, res) => {
    try {
        const userId = getUserId(req);
        const { reason, action, campaign_id, archetype_id, limit = 100 } = req.query;

        const conversations = db.getActiveConversations(userId);

        // Collect all logs from all conversations
        let allLogs = [];

        conversations.forEach(conv => {
            try {
                const logs = conv.policy_log ? JSON.parse(conv.policy_log) : [];
                logs.forEach(log => {
                    allLogs.push({
                        ...log,
                        conversation_id: conv.id,
                        contact_phone: conv.contact_phone,
                        contact_name: conv.contact_name,
                        campaign_id: conv.campaign_id,
                        archetype_id: conv.archetype_id
                    });
                });
            } catch (e) { }
        });

        // Filter by reason
        if (reason) {
            allLogs = allLogs.filter(log => log.reason && log.reason.includes(reason));
        }

        // Filter by action
        if (action) {
            allLogs = allLogs.filter(log => log.action === action);
        }

        // Filter by campaign
        if (campaign_id) {
            allLogs = allLogs.filter(log => log.campaign_id === parseInt(campaign_id));
        }

        // Filter by archetype
        if (archetype_id) {
            allLogs = allLogs.filter(log => log.archetype_id === parseInt(archetype_id));
        }

        // Sort by timestamp descending
        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Limit
        allLogs = allLogs.slice(0, parseInt(limit));

        res.json({ success: true, logs: allLogs, total: allLogs.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Export logs as CSV
router.get('/logs/export', (req, res) => {
    try {
        const userId = getUserId(req);
        const conversations = db.getActiveConversations(userId);

        // Collect all logs
        let allLogs = [];

        conversations.forEach(conv => {
            try {
                const logs = conv.policy_log ? JSON.parse(conv.policy_log) : [];
                logs.forEach(log => {
                    allLogs.push({
                        timestamp: log.timestamp,
                        action: log.action,
                        reason: log.reason,
                        conversation_id: conv.id,
                        contact_phone: conv.contact_phone,
                        contact_name: conv.contact_name || '',
                        campaign_id: conv.campaign_id || '',
                        archetype_id: conv.archetype_id || ''
                    });
                });
            } catch (e) { }
        });

        // Sort by timestamp
        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Generate CSV
        const headers = ['timestamp', 'action', 'reason', 'conversation_id', 'contact_phone', 'contact_name', 'campaign_id', 'archetype_id'];
        const csvRows = [headers.join(',')];

        allLogs.forEach(log => {
            const row = headers.map(h => {
                const val = log[h] || '';
                // Escape quotes
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvRows.push(row.join(','));
        });

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get summary of log actions
router.get('/logs/summary', (req, res) => {
    try {
        const userId = getUserId(req);
        const conversations = db.getActiveConversations(userId);

        const summary = {
            STOPPED: 0,
            ESCALATED: 0,
            BLOCKED: 0,
            MODIFIED: 0,
            SILENCED: 0
        };

        conversations.forEach(conv => {
            try {
                const logs = conv.policy_log ? JSON.parse(conv.policy_log) : [];
                logs.forEach(log => {
                    if (summary.hasOwnProperty(log.action)) {
                        summary[log.action]++;
                    }
                });
            } catch (e) { }
        });

        res.json({ success: true, summary });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
