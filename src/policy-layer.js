/**
 * Policy Layer - Validates and sanitizes agent responses
 * 
 * This module is responsible for:
 * - Enforcing max message length
 * - Detecting stop rules in user messages
 * - Detecting escalation rules
 * - Filtering forbidden words
 * - Ensuring monotematic responses (no cross-niche vocabulary)
 */

class PolicyLayer {

    // Default forbidden words that should never appear in responses
    static GLOBAL_FORBIDDEN = [
        'nicho', 'cerebro', 'archetype', 'arquetipo',
        'bot', 'robo', 'automatizado', 'automatico',
        'ia', 'inteligencia artificial', 'machine learning',
        'algoritmo', 'programado', 'configurado',
        'sistema', 'software', 'api', 'backend',
        'prompt', 'gpt', 'openai', 'chatgpt'
    ];

    /**
     * Check if user message triggers a stop rule
     * Stop rules = agent should NOT respond
     */
    static shouldStop(message, stopRules = []) {
        if (!message || !stopRules.length) return false;

        const lowerMessage = message.toLowerCase().trim();

        // Check if message is very short and matches a stop word
        if (lowerMessage.length < 20) {
            for (const rule of stopRules) {
                if (lowerMessage.includes(rule.toLowerCase())) {
                    console.log(`[PolicyLayer] Stop rule triggered: "${rule}"`);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if user message triggers an escalation rule
     * Escalation = pass to human
     */
    static shouldEscalate(message, escalationRules = []) {
        if (!message || !escalationRules.length) return false;

        const lowerMessage = message.toLowerCase();

        for (const rule of escalationRules) {
            if (lowerMessage.includes(rule.toLowerCase())) {
                console.log(`[PolicyLayer] Escalation rule triggered: "${rule}"`);
                return true;
            }
        }

        // Check for audio message indicator
        if (lowerMessage.includes('[audio]') || lowerMessage.includes('audio')) {
            console.log('[PolicyLayer] Audio message detected - escalating');
            return true;
        }

        return false;
    }

    /**
     * Validate and sanitize agent response
     * Returns null if response should be blocked
     */
    static validate(response, policy = {}) {
        if (!response) return null;

        let sanitized = response;

        // 1. Check max characters
        const maxChars = policy.max_chars_per_message || 450;
        if (sanitized.length > maxChars) {
            // Truncate at last complete sentence within limit
            sanitized = this.truncateAtSentence(sanitized, maxChars);
        }

        // 2. Filter forbidden words
        const forbiddenWords = [
            ...this.GLOBAL_FORBIDDEN,
            ...(policy.forbidden_words || [])
        ];

        for (const word of forbiddenWords) {
            const regex = new RegExp(word, 'gi');
            if (regex.test(sanitized)) {
                console.log(`[PolicyLayer] Forbidden word detected: "${word}"`);
                // Replace with safe response
                return this.getSafeResponse(policy);
            }
        }

        // 3. Check for links if not allowed
        if (!policy.allow_links) {
            const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
            if (urlRegex.test(sanitized)) {
                sanitized = sanitized.replace(urlRegex, '[link removido]');
            }
        }

        // 4. Check for price if not allowed
        if (!policy.allow_price) {
            const priceRegex = /R\$\s*[\d.,]+/gi;
            if (priceRegex.test(sanitized)) {
                console.log('[PolicyLayer] Price detected but not allowed');
                sanitized = sanitized.replace(priceRegex, '[valor]');
            }
        }

        // 5. Ensure no direct confirmations of being a bot/AI
        const botConfirmations = [
            'sou um bot', 'sou uma ia', 'sou artificial',
            'sou um robo', 'sou programado', 'sou automatizado',
            'nao sou humano', 'sou uma inteligencia',
            'sou um assistente virtual', 'sou um chatbot'
        ];

        for (const phrase of botConfirmations) {
            if (sanitized.toLowerCase().includes(phrase)) {
                console.log(`[PolicyLayer] Bot confirmation detected: "${phrase}"`);
                return this.getSafeResponse(policy);
            }
        }

        return sanitized;
    }

    /**
     * Truncate text at the last complete sentence within max length
     */
    static truncateAtSentence(text, maxLength) {
        if (text.length <= maxLength) return text;

        const truncated = text.substring(0, maxLength);

        // Find last sentence ending
        const lastPeriod = truncated.lastIndexOf('.');
        const lastQuestion = truncated.lastIndexOf('?');
        const lastExclamation = truncated.lastIndexOf('!');

        const lastEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);

        if (lastEnd > maxLength * 0.5) {
            return truncated.substring(0, lastEnd + 1);
        }

        // If no good sentence break, try to break at last space
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.7) {
            return truncated.substring(0, lastSpace) + '...';
        }

        return truncated + '...';
    }

    /**
     * Get a safe fallback response when policy violations occur
     */
    static getSafeResponse(policy = {}) {
        const safeResponses = [
            'Entendo! Me conta mais sobre isso.',
            'Interessante! Como posso te ajudar?',
            'Certo, estou aqui para ajudar.',
            'Compreendo. O que mais posso fazer por voce?'
        ];

        return safeResponses[Math.floor(Math.random() * safeResponses.length)];
    }

    /**
     * Check if response maintains monotematic focus
     * (No vocabulary from other niches)
     */
    static checkMonotematic(response, niche, policy = {}) {
        // Define vocabulary that should NOT appear for each niche
        const nicheExclusions = {
            'RELIGIOSO': ['emagrecer', 'dieta', 'candidato', 'voto', 'eleicao', 'partido'],
            'POLITICA': ['orar', 'bencao', 'deus', 'igreja', 'dieta', 'emagrecer', 'calorias'],
            'EMAGRECIMENTO': ['orar', 'bencao', 'candidato', 'voto', 'eleicao', 'partido']
        };

        const exclusions = nicheExclusions[niche] || [];
        const lowerResponse = response.toLowerCase();

        for (const word of exclusions) {
            if (lowerResponse.includes(word)) {
                console.log(`[PolicyLayer] Cross-niche word detected for ${niche}: "${word}"`);
                return false;
            }
        }

        return true;
    }
}

module.exports = PolicyLayer;
