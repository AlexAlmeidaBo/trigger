/**
 * Admin API Routes
 * 
 * Dashboard endpoints for system control
 * PROTECTED: Only admins can access these endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin, isAdmin } = require('../authMiddleware');

// Apply requireAdmin middleware to all routes in this router
router.use(requireAdmin);

// Check if current user is admin (for frontend visibility)
router.get('/check', (req, res) => {
    res.json({ success: true, isAdmin: true }); // Already passed requireAdmin
});

// Get plans distribution
router.get('/plans-distribution', (req, res) => {
    try {
        // Count subscriptions by plan
        const distribution = {
            FREE: 0,
            MENSAL: 0,
            VITALICIO: 0
        };

        // Get all subscriptions
        const sql = `SELECT plan_id, COUNT(*) as count FROM subscriptions GROUP BY plan_id`;
        const rows = db.all(sql);

        if (rows) {
            rows.forEach(row => {
                const planId = (row.plan_id || 'FREE').toUpperCase();
                if (distribution.hasOwnProperty(planId)) {
                    distribution[planId] = row.count;
                } else {
                    distribution.FREE += row.count;
                }
            });
        }

        res.json({ success: true, distribution });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Clear rate limits (in-memory)
router.post('/clear-rate-limits', (req, res) => {
    try {
        // Import brain resolver and clear its rate limit maps
        const brainResolver = require('../brain-resolver');
        if (brainResolver.campaignRateLimits) {
            brainResolver.campaignRateLimits.clear();
        }
        if (brainResolver.campaignCooldowns) {
            brainResolver.campaignCooldowns.clear();
        }

        console.log('[Admin] Rate limits cleared');
        res.json({ success: true, message: 'Rate limits cleared' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Pause all agents (set global flag)
let agentsPaused = false;

router.post('/pause-all', (req, res) => {
    try {
        agentsPaused = true;

        // Also update all active conversations to SILENCED
        const sql = `UPDATE conversations SET handoff_status = 'HUMAN_TAKEN' WHERE handoff_status = 'NONE'`;
        db.run(sql);

        console.log('[Admin] All agents paused');
        res.json({ success: true, message: 'All agents paused' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Resume all agents
router.post('/resume-all', (req, res) => {
    try {
        agentsPaused = false;

        // Reset conversations to NONE
        const sql = `UPDATE conversations SET handoff_status = 'NONE' WHERE handoff_status = 'HUMAN_TAKEN'`;
        db.run(sql);

        console.log('[Admin] All agents resumed');
        res.json({ success: true, message: 'All agents resumed' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Check if agents are globally paused
router.get('/agents-status', (req, res) => {
    res.json({ success: true, paused: agentsPaused });
});

// Clear database (DANGEROUS)
router.post('/clear-database', (req, res) => {
    try {
        // Only clear non-essential tables
        db.run('DELETE FROM conversations');
        db.run('DELETE FROM messages');
        db.run('DELETE FROM contacts');

        console.log('[Admin] Database cleared (conversations, messages, contacts)');
        res.json({ success: true, message: 'Database cleared' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Export paused state for other modules
module.exports = router;
module.exports.isAgentsPaused = () => agentsPaused;
