/**
 * SaaS Plans Configuration
 * 
 * Defines the plan tiers, limits, and feature flags
 * Based on actual pricing: Gratuito, Mensal (R$27,90), Vitalício (R$299)
 */

const PLANS = {
    // Free tier - Gratuito
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
            agent_enabled: false,    // ❌ Agente IA
            magic_text: false,       // ❌ Texto Mágico
            aiAgent: false,          // alias
            aiVariations: false,     // alias
            cockpitDashboard: false,
            exportCsv: false,
            customBrains: false,
            prioritySupport: false,
            unlimitedMessages: false,
            importacaoIlimitada: true // ✅ Importação ilimitada
        }
    },

    // Monthly tier - Mensal
    MENSAL: {
        id: 'MENSAL',
        name: 'Mensal',
        price: 2790, // R$ 27,90 in cents
        billingCycle: 'monthly',
        limits: {
            campaigns: 10,
            brains: 5,
            conversationsPerMonth: -1, // unlimited
            messagesPerDay: -1,        // unlimited
            contactsTotal: -1          // unlimited
        },
        features: {
            agent_enabled: true,       // ✅ Agente IA
            magic_text: true,          // ✅ Texto Mágico
            aiAgent: true,             // alias
            aiVariations: true,        // alias
            cockpitDashboard: true,
            exportCsv: true,
            customBrains: true,
            prioritySupport: false,
            unlimitedMessages: true,   // ✅ Mensagens ilimitadas
            importacaoIlimitada: true  // ✅ Importação ilimitada
        }
    },

    // Lifetime tier - Vitalício
    VITALICIO: {
        id: 'VITALICIO',
        name: 'Vitalício',
        price: 29900, // R$ 299,00 in cents (one-time)
        billingCycle: 'lifetime',
        limits: {
            campaigns: -1,             // unlimited
            brains: -1,                // unlimited
            conversationsPerMonth: -1, // unlimited
            messagesPerDay: -1,        // unlimited
            contactsTotal: -1          // unlimited
        },
        features: {
            agent_enabled: true,       // ✅ Agente IA + Atualizações
            magic_text: true,          // ✅ Texto Mágico
            aiAgent: true,             // alias
            aiVariations: true,        // alias
            cockpitDashboard: true,
            exportCsv: true,
            customBrains: true,
            prioritySupport: true,
            unlimitedMessages: true,   // ✅ Mensagens ilimitadas
            importacaoIlimitada: true, // ✅ Importação ilimitada
            accessoVitalicio: true,    // ✅ Acesso vitalício
            futureUpdates: true        // ✅ Atualizações futuras
        }
    }
};

// Feature descriptions for UI
const FEATURE_DESCRIPTIONS = {
    aiAgent: 'Agente IA Automático',
    aiVariations: 'Texto Mágico (IA)',
    cockpitDashboard: 'Painel Cockpit Operacional',
    exportCsv: 'Exportar Logs e Dados',
    customBrains: 'Criar Cérebros Customizados',
    prioritySupport: 'Suporte Prioritário',
    unlimitedMessages: 'Mensagens Ilimitadas',
    importacaoIlimitada: 'Importação Ilimitada',
    accessoVitalicio: 'Acesso Vitalício',
    futureUpdates: 'Atualizações Futuras'
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
    const order = ['FREE', 'MENSAL', 'VITALICIO'];
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
