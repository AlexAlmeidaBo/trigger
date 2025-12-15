/**
 * SaaS Plans Configuration
 * 
 * Defines the plan tiers, limits, and feature flags
 */

const PLANS = {
    // Free tier
    FREE: {
        id: 'FREE',
        name: 'Gratuito',
        price: 0,
        billingCycle: null,
        limits: {
            campaigns: 1,
            brains: 1,
            conversationsPerMonth: 50,
            messagesPerDay: 15,
            contactsTotal: 100
        },
        features: {
            aiAgent: false,
            aiVariations: false,
            cockpitDashboard: false,
            exportCsv: false,
            customBrains: false,
            multipleArchetypes: false,
            prioritySupport: false,
            whitelabel: false,
            apiAccess: false
        }
    },

    // Starter tier
    STARTER: {
        id: 'STARTER',
        name: 'Starter',
        price: 2790, // R$ 27,90 in cents
        billingCycle: 'monthly',
        limits: {
            campaigns: 3,
            brains: 2,
            conversationsPerMonth: 500,
            messagesPerDay: 100,
            contactsTotal: 1000
        },
        features: {
            aiAgent: true,
            aiVariations: true,
            cockpitDashboard: true,
            exportCsv: true,
            customBrains: false,
            multipleArchetypes: false,
            prioritySupport: false,
            whitelabel: false,
            apiAccess: false
        }
    },

    // Pro tier
    PRO: {
        id: 'PRO',
        name: 'Pro',
        price: 9790, // R$ 97,90 in cents
        billingCycle: 'monthly',
        limits: {
            campaigns: 10,
            brains: 5,
            conversationsPerMonth: 2000,
            messagesPerDay: 500,
            contactsTotal: 10000
        },
        features: {
            aiAgent: true,
            aiVariations: true,
            cockpitDashboard: true,
            exportCsv: true,
            customBrains: true,
            multipleArchetypes: true,
            prioritySupport: true,
            whitelabel: false,
            apiAccess: true
        }
    },

    // Agency tier
    AGENCY: {
        id: 'AGENCY',
        name: 'Agency',
        price: 29790, // R$ 297,90 in cents
        billingCycle: 'monthly',
        limits: {
            campaigns: -1, // unlimited
            brains: -1, // unlimited
            conversationsPerMonth: -1, // unlimited
            messagesPerDay: -1, // unlimited
            contactsTotal: -1 // unlimited
        },
        features: {
            aiAgent: true,
            aiVariations: true,
            cockpitDashboard: true,
            exportCsv: true,
            customBrains: true,
            multipleArchetypes: true,
            prioritySupport: true,
            whitelabel: true,
            apiAccess: true
        }
    }
};

// Feature descriptions for UI
const FEATURE_DESCRIPTIONS = {
    aiAgent: 'Agente IA Automático',
    aiVariations: 'Variações de Mensagem com IA',
    cockpitDashboard: 'Painel Cockpit Operacional',
    exportCsv: 'Exportar Logs e Dados',
    customBrains: 'Criar Cérebros Customizados',
    multipleArchetypes: 'Múltiplos Arquétipos',
    prioritySupport: 'Suporte Prioritário',
    whitelabel: 'Marca Branca (Whitelabel)',
    apiAccess: 'Acesso à API'
};

// Get plan by ID
function getPlan(planId) {
    return PLANS[planId] || PLANS.FREE;
}

// Check if plan has feature
function hasFeature(planId, featureName) {
    const plan = getPlan(planId);
    return plan.features[featureName] === true;
}

// Check if within limit (-1 means unlimited)
function isWithinLimit(planId, limitName, currentUsage) {
    const plan = getPlan(planId);
    const limit = plan.limits[limitName];
    if (limit === -1) return true; // unlimited
    return currentUsage < limit;
}

// Get remaining allowance
function getRemainingAllowance(planId, limitName, currentUsage) {
    const plan = getPlan(planId);
    const limit = plan.limits[limitName];
    if (limit === -1) return Infinity;
    return Math.max(0, limit - currentUsage);
}

// Get all plans for pricing page
function getAllPlans() {
    return Object.values(PLANS);
}

// Get upgrade path from current plan
function getUpgradePath(currentPlanId) {
    const order = ['FREE', 'STARTER', 'PRO', 'AGENCY'];
    const currentIndex = order.indexOf(currentPlanId);
    if (currentIndex === -1 || currentIndex >= order.length - 1) return null;
    return order[currentIndex + 1];
}

module.exports = {
    PLANS,
    FEATURE_DESCRIPTIONS,
    getPlan,
    hasFeature,
    isWithinLimit,
    getRemainingAllowance,
    getAllPlans,
    getUpgradePath
};
