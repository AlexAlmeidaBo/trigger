/**
 * Plans API Routes
 * 
 * Endpoints for plan management and feature checking
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const plans = require('../plans');
const { getUserId } = require('../authMiddleware');

// Get all available plans
router.get('/', (req, res) => {
    const allPlans = plans.getAllPlans();
    res.json({
        success: true,
        plans: allPlans,
        featureDescriptions: plans.FEATURE_DESCRIPTIONS
    });
});

// Get current user's plan and usage
router.get('/current', (req, res) => {
    try {
        const userId = getUserId(req);

        // Get user's current plan from subscription
        const subscription = db.getSubscription(userId);
        const planId = subscription?.plan_id || 'FREE';
        const plan = plans.getPlan(planId);

        // Get current usage
        const usage = {
            campaigns: db.getAllCampaigns(userId)?.length || 0,
            brains: db.getAllArchetypes(true)?.length || 0, // TODO: per-user
            conversationsThisMonth: db.getActiveConversations(userId)?.length || 0,
            contactsTotal: db.getAllContacts(userId)?.length || 0
        };

        // Calculate remaining
        const remaining = {};
        Object.keys(plan.limits).forEach(key => {
            remaining[key] = plans.getRemainingAllowance(planId, key, usage[key] || 0);
        });

        res.json({
            success: true,
            plan,
            usage,
            remaining,
            upgradePath: plans.getUpgradePath(planId)
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Check if user has specific feature
router.get('/feature/:featureName', (req, res) => {
    try {
        const userId = getUserId(req);
        const { featureName } = req.params;

        const subscription = db.getSubscription(userId);
        const planId = subscription?.plan_id || 'FREE';

        const hasFeature = plans.hasFeature(planId, featureName);

        res.json({
            success: true,
            feature: featureName,
            hasAccess: hasFeature,
            plan: planId
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Check if user is within limit
router.get('/limit/:limitName', (req, res) => {
    try {
        const userId = getUserId(req);
        const { limitName } = req.params;

        const subscription = db.getSubscription(userId);
        const planId = subscription?.plan_id || 'FREE';
        const plan = plans.getPlan(planId);

        // Get current usage based on limit type
        let currentUsage = 0;
        switch (limitName) {
            case 'campaigns':
                currentUsage = db.getAllCampaigns(userId)?.length || 0;
                break;
            case 'contactsTotal':
                currentUsage = db.getAllContacts(userId)?.length || 0;
                break;
            case 'conversationsPerMonth':
                currentUsage = db.getActiveConversations(userId)?.length || 0;
                break;
            default:
                currentUsage = 0;
        }

        const withinLimit = plans.isWithinLimit(planId, limitName, currentUsage);
        const remaining = plans.getRemainingAllowance(planId, limitName, currentUsage);

        res.json({
            success: true,
            limit: limitName,
            max: plan.limits[limitName],
            current: currentUsage,
            remaining,
            withinLimit,
            plan: planId
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Upgrade request (stores intent, doesn't process payment)
router.post('/upgrade', (req, res) => {
    try {
        const userId = getUserId(req);
        const { targetPlan } = req.body;

        if (!plans.PLANS[targetPlan]) {
            return res.status(400).json({ success: false, error: 'Invalid plan' });
        }

        const plan = plans.getPlan(targetPlan);

        // Store upgrade intent
        const upgradeRecord = {
            userId,
            targetPlan,
            requestedAt: new Date().toISOString(),
            status: 'pending'
        };

        // TODO: Store in database
        console.log('[PLANS] Upgrade request:', upgradeRecord);

        res.json({
            success: true,
            message: 'Solicitação de upgrade registrada',
            plan,
            // Redirect URL for payment (placeholder)
            checkoutUrl: `/checkout?plan=${targetPlan}`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
