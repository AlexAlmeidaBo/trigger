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
        mensalLimit = 60,      // requests per minute for MENSAL
        vitalicioLimit = -1    // unlimited for VITALICIO
    } = options;

    const limits = {
        FREE: freeLimit,
        MENSAL: mensalLimit,
        VITALICIO: vitalicioLimit
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

/**
 * Block automation for FREE plan
 * This is the REAL enforcement - FREE users cannot have agent respond automatically
 */
function requireAutomation(req, res, next) {
    try {
        const userId = getUserId(req);
        const subscription = db.getSubscription(userId);
        const planId = subscription?.plan_id || 'FREE';

        if (planId === 'FREE') {
            return res.status(403).json({
                success: false,
                error: 'Automação não disponível',
                code: 'AUTOMATION_BLOCKED',
                message: 'Plano FREE não inclui automação do agente. Faça upgrade para usar o bot automático.',
                upgradeUrl: '/pricing'
            });
        }

        next();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Enforce campaign creation limit
 */
function requireCampaignLimit(req, res, next) {
    try {
        const userId = getUserId(req);
        const subscription = db.getSubscription(userId);
        const planId = subscription?.plan_id || 'FREE';
        const plan = plans.getPlan(planId);

        const currentCampaigns = db.getAllCampaigns(userId)?.length || 0;
        const limit = plan.limits.campaigns;

        if (limit !== -1 && currentCampaigns >= limit) {
            return res.status(403).json({
                success: false,
                error: 'Limite de campanhas do plano atingido',
                code: 'CAMPAIGN_LIMIT',
                current: currentCampaigns,
                max: limit,
                plan: planId,
                message: `Seu plano ${plan.name} permite ${limit} campanha(s). Faça upgrade para criar mais.`,
                upgradeUrl: '/pricing'
            });
        }

        next();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Enforce brain/archetype creation limit
 */
function requireBrainLimit(req, res, next) {
    try {
        const userId = getUserId(req);
        const subscription = db.getSubscription(userId);
        const planId = subscription?.plan_id || 'FREE';
        const plan = plans.getPlan(planId);

        // For now, archetypes are global - in production, filter by user
        const currentBrains = db.getAllArchetypes(true)?.length || 0;
        const limit = plan.limits.brains;

        if (limit !== -1 && currentBrains >= limit) {
            return res.status(403).json({
                success: false,
                error: 'Limite de cérebros do plano atingido',
                code: 'BRAIN_LIMIT',
                current: currentBrains,
                max: limit,
                plan: planId,
                message: `Seu plano ${plan.name} permite ${limit} cérebro(s). Faça upgrade para criar mais.`,
                upgradeUrl: '/pricing'
            });
        }

        next();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Onboarding validation - check if user completed required steps
 */
function requireOnboarding(req, res, next) {
    try {
        const userId = getUserId(req);

        // Check if user has at least 1 campaign
        const campaigns = db.getAllCampaigns(userId);
        if (!campaigns || campaigns.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'Onboarding incompleto',
                code: 'NO_CAMPAIGN',
                message: 'Você precisa criar uma campanha antes de ativar o agente.',
                nextStep: 'create_campaign'
            });
        }

        next();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    requireFeature,
    requireLimit,
    rateLimit,
    nicheComplianceWarning,
    requireAutomation,
    requireCampaignLimit,
    requireBrainLimit,
    requireOnboarding
};

