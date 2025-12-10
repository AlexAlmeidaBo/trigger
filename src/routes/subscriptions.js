const express = require('express');
const router = express.Router();
const db = require('../database');

// Kirvano webhook secret token (set in environment)
const KIRVANO_WEBHOOK_TOKEN = process.env.KIRVANO_WEBHOOK_TOKEN || 'kirvano_secret_token';

// Kirvano webhook handler
router.post('/kirvano', express.json(), async (req, res) => {
    console.log('[KIRVANO] Webhook received:', JSON.stringify(req.body, null, 2));

    try {
        // Verify token (Kirvano sends token in header or body)
        const token = req.headers['x-kirvano-token'] || req.body.token || req.query.token;

        if (token && token !== KIRVANO_WEBHOOK_TOKEN) {
            console.log('[KIRVANO] Invalid token');
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { event, data } = req.body;

        // Handle different event types from Kirvano
        // Common field names: email, customer_email, buyer_email
        const email = data?.email || data?.customer_email || data?.buyer_email || data?.customer?.email;
        const transactionId = data?.transaction_id || data?.id || data?.order_id;

        if (!email) {
            console.log('[KIRVANO] No email found in webhook data');
            return res.status(400).json({ error: 'Email not found in webhook data' });
        }

        console.log(`[KIRVANO] Event: ${event}, Email: ${email}, Transaction: ${transactionId}`);

        switch (event) {
            case 'compra_aprovada':
            case 'purchase_approved':
            case 'sale_approved':
            case 'subscription_active':
            case 'payment_confirmed':
                // Activate or renew subscription
                db.activateSubscriptionByEmail(email, transactionId, 30);
                console.log(`[KIRVANO] Subscription activated for ${email}`);
                break;

            case 'reembolso':
            case 'refund':
            case 'refunded':
                // Cancel subscription immediately
                db.cancelSubscriptionByEmail(email);
                console.log(`[KIRVANO] Subscription cancelled (refund) for ${email}`);
                break;

            case 'chargeback':
            case 'dispute':
                // Cancel subscription immediately
                db.cancelSubscriptionByEmail(email);
                console.log(`[KIRVANO] Subscription cancelled (chargeback) for ${email}`);
                break;

            case 'assinatura_cancelada':
            case 'subscription_cancelled':
            case 'subscription_canceled':
                // Mark subscription as cancelled
                db.cancelSubscriptionByEmail(email);
                console.log(`[KIRVANO] Subscription cancelled for ${email}`);
                break;

            case 'boleto_gerado':
            case 'pix_gerado':
            case 'carrinho_abandonado':
                // These are informational events, no action needed
                console.log(`[KIRVANO] Informational event: ${event}`);
                break;

            default:
                console.log(`[KIRVANO] Unknown event type: ${event}`);
        }

        // Always respond 200 to acknowledge receipt
        res.json({ success: true, message: 'Webhook processed' });

    } catch (error) {
        console.error('[KIRVANO] Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check subscription status endpoint (for frontend)
router.get('/status', (req, res) => {
    try {
        const userId = req.user?.uid;
        const email = req.user?.email;

        if (!userId && !email) {
            return res.json({
                active: false,
                reason: 'not_logged_in',
                message: 'Faça login para verificar sua assinatura'
            });
        }

        // Check by userId first, then by email
        let isActive = false;
        let subscription = null;

        if (userId) {
            isActive = db.isSubscriptionActive(userId);
            subscription = db.getSubscription(userId);
        }

        if (!isActive && email) {
            isActive = db.isSubscriptionActiveByEmail(email);
            subscription = db.getSubscriptionByEmail(email);

            // If found by email but not by userId, link them
            if (isActive && userId && subscription) {
                db.linkSubscriptionToUser(userId, email);
            }
        }

        if (isActive) {
            res.json({
                active: true,
                expiresAt: subscription?.expires_at,
                status: subscription?.status,
                message: 'Assinatura ativa'
            });
        } else {
            res.json({
                active: false,
                reason: subscription ? 'expired' : 'no_subscription',
                expiresAt: subscription?.expires_at,
                message: subscription
                    ? 'Sua assinatura expirou. Renove para continuar usando.'
                    : 'Você não possui uma assinatura ativa.'
            });
        }
    } catch (error) {
        console.error('[SUBSCRIPTION] Status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user limits for freemium model
router.get('/limits', (req, res) => {
    try {
        const userId = req.user?.uid;
        const DAILY_LIMIT = 15;

        if (!userId) {
            return res.json({
                isPremium: false,
                messagesRemaining: 0,
                dailyLimit: DAILY_LIMIT,
                canSendMessages: false,
                features: {
                    aiVariations: false,
                    aiAgent: false,
                    unlimitedMessages: false
                }
            });
        }

        const limits = db.canSendMessages(userId, 1, DAILY_LIMIT);
        const isPremium = db.isPremiumUser(userId);

        res.json({
            isPremium: isPremium,
            messagesRemaining: limits.remaining,
            dailyLimit: DAILY_LIMIT,
            canSendMessages: limits.allowed,
            features: {
                aiVariations: isPremium,
                aiAgent: isPremium,
                unlimitedMessages: isPremium
            }
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Limits error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

