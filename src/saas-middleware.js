/**
 * SaaS Middleware
 * 
 * Rate limiting and feature gating based on user's plan
 */

const plans = require('./plans');
const db = require('./database');
const { getUserId } = require('./authMiddleware');

// Rate limiting storage (in-memory, use Redis in production)
const rateLimitStore = new Map();

/**
 * Check if user has access to a feature
 */
function requireFeature(featureName) {
    return (req, res, next) => {
        try {
            const userId = getUserId(req);
            const subscription = db.getSubscription(userId);
            const planId = subscription?.plan_id || 'FREE';

            if (!plans.hasFeature(planId, featureName)) {
                return res.status(403).json({
                    success: false,
                    error: 'Feature not available',
                    feature: featureName,
                    message: `Este recurso requer um plano superior. Seu plano atual: ${planId}`,
                    upgradeUrl: '/pricing'
                });
            }

            next();
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    };
}

/**
 * Check if user is within limit
 */
function requireLimit(limitName, getCurrentUsage) {
    return (req, res, next) => {
        try {
            const userId = getUserId(req);
            const subscription = db.getSubscription(userId);
            const planId = subscription?.plan_id || 'FREE';

            const currentUsage = getCurrentUsage(req, userId);

            if (!plans.isWithinLimit(planId, limitName, currentUsage)) {
                const plan = plans.getPlan(planId);
                return res.status(403).json({
                    success: false,
                    error: 'Limit exceeded',
                    limit: limitName,
                    max: plan.limits[limitName],
                    current: currentUsage,
                    message: `Você atingiu o limite de ${limitName}. Considere fazer upgrade.`,
                    upgradeUrl: '/pricing'
                });
            }

            next();
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    };
}

/**
 * Rate limiting middleware
 * Limits requests per minute based on plan
 */
function rateLimit(options = {}) {
    const {
        freeLimit = 10,        // requests per minute for FREE
        starterLimit = 30,     // requests per minute for STARTER
        proLimit = 100,        // requests per minute for PRO
        agencyLimit = -1       // unlimited for AGENCY
    } = options;

    const limits = {
        FREE: freeLimit,
        STARTER: starterLimit,
        PRO: proLimit,
        AGENCY: agencyLimit
    };

    return (req, res, next) => {
        try {
            const userId = getUserId(req);
            const subscription = db.getSubscription(userId);
            const planId = subscription?.plan_id || 'FREE';

            const limit = limits[planId];
            if (limit === -1) {
                return next(); // Unlimited
            }

            const key = `${userId}:${Math.floor(Date.now() / 60000)}`;
            const current = rateLimitStore.get(key) || 0;

            if (current >= limit) {
                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    message: 'Muitas requisições. Aguarde um minuto.',
                    retryAfter: 60
                });
            }

            rateLimitStore.set(key, current + 1);

            // Clean old entries
            if (rateLimitStore.size > 10000) {
                const cutoff = Date.now() - 120000;
                for (const [k, v] of rateLimitStore) {
                    if (parseInt(k.split(':')[1]) < cutoff / 60000) {
                        rateLimitStore.delete(k);
                    }
                }
            }

            next();
        } catch (err) {
            next(); // Don't block on error
        }
    };
}

/**
 * Niche compliance warning middleware
 */
function nicheComplianceWarning(req, res, next) {
    const sensitiveNiches = ['POLITICA', 'RELIGIOSO'];
    const niche = req.body?.niche || req.query?.niche;

    if (niche && sensitiveNiches.includes(niche.toUpperCase())) {
        res.set('X-Compliance-Warning', 'true');
        res.set('X-Compliance-Message',
            'Este nicho é sensível. Certifique-se de seguir as diretrizes de conteúdo.'
        );
    }

    next();
}

module.exports = {
    requireFeature,
    requireLimit,
    rateLimit,
    nicheComplianceWarning
};
