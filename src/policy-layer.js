/**
 * Policy Layer - Validates and sanitizes agent responses
 * 
 * POLICY IS LAW. Prompt is suggestion.
 * 
 * This module is responsible for:
 * - Enforcing max message length
 * - Detecting stop rules in user messages (CALA)
 * - Detecting escalation rules (ESCALA)
 * - Filtering forbidden words (BLOCKLIST)
 * - Blocking links, prices, CTAs
 * - Ensuring monotematic responses
 * - Logging all decisions with reasons
 */

class PolicyLayer {

    // Default forbidden words that should NEVER appear in responses
    static GLOBAL_FORBIDDEN = [
        // Tech terms
        'nicho', 'cerebro', 'archetype', 'arquetipo',
        'bot', 'robo', 'automatizado', 'automatico',
        'ia', 'inteligencia artificial', 'machine learning',
        'algoritmo', 'programado', 'configurado',
        'sistema', 'software', 'api', 'backend',
        'prompt', 'gpt', 'openai', 'chatgpt', 'llm',
        // Identity reveals
        'assistente virtual', 'agente virtual', 'chatbot'
    ];

    // Payment/sales blocklist
    static SALES_BLOCKLIST = [
        'checkout', 'pagamento', 'pagar', 'comprar agora',
        'cartao de credito', 'pix', 'boleto', 'parcelado',
        'clique aqui', 'acesse o link', 'link na bio'
    ];

    /**
     * Main validation entry point - returns structured result
     * @returns {{ allowed: boolean, response: string|null, reason: string, logs: string[] }}
     */
    static validateWithReason(response, policy = {}, context = {}) {
        const logs = [];
        let sanitized = response;

        if (!response) {
            return { allowed: false, response: null, reason: 'EMPTY_RESPONSE', logs };
        }

        // 1. MAX CHARS - Truncate if needed
        const maxChars = policy.max_chars_per_message || 450;
        if (sanitized.length > maxChars) {
            sanitized = this.truncateAtSentence(sanitized, maxChars);
            logs.push(`TRUNCATED: ${response.length} -> ${sanitized.length} chars`);
        }

        // 2. FORBIDDEN WORDS - Block completely
        const forbiddenWords = [
            ...this.GLOBAL_FORBIDDEN,
            ...(policy.forbidden_words || [])
        ];

        for (const word of forbiddenWords) {
            const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
            if (regex.test(sanitized)) {
                logs.push(`BLOCKED: Forbidden word "${word}"`);
                return {
                    allowed: true,
                    response: this.getSafeResponse(policy),
                    reason: `FORBIDDEN_WORD:${word}`,
                    logs
                };
            }
        }

        // 3. LINKS - Block or remove
        if (!policy.allow_links) {
            const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\w+\.com[^\s]*)/gi;
            if (urlRegex.test(sanitized)) {
                logs.push('BLOCKED: Link detected');
                return {
                    allowed: true,
                    response: this.getSafeResponse(policy),
                    reason: 'LINK_BLOCKED',
                    logs
                };
            }
        }

        // 4. PRICE/PAYMENT - Block completely
        if (!policy.allow_price) {
            const priceRegex = /R\$\s*[\d.,]+|(\d+)\s*(reais|real)/gi;
            if (priceRegex.test(sanitized)) {
                logs.push('BLOCKED: Price detected');
                return {
                    allowed: true,
                    response: this.getSafeResponse(policy),
                    reason: 'PRICE_BLOCKED',
                    logs
                };
            }

            // Also check sales blocklist
            for (const term of this.SALES_BLOCKLIST) {
                if (sanitized.toLowerCase().includes(term)) {
                    logs.push(`BLOCKED: Sales term "${term}"`);
                    return {
                        allowed: true,
                        response: this.getSafeResponse(policy),
                        reason: `SALES_TERM:${term}`,
                        logs
                    };
                }
            }
        }

        // 5. BOT CONFIRMATION - Never admit being a bot
        const botConfirmations = [
            'sou um bot', 'sou uma ia', 'sou artificial',
            'sou um robo', 'sou programado', 'sou automatizado',
            'nao sou humano', 'sou uma inteligencia',
            'sou um assistente', 'sou um chatbot',
            'fui programad', 'me programaram', 'meu criador'
        ];

        for (const phrase of botConfirmations) {
            if (sanitized.toLowerCase().includes(phrase)) {
                logs.push(`BLOCKED: Bot confirmation "${phrase}"`);
                return {
                    allowed: true,
                    response: this.getSafeResponse(policy),
                    reason: `BOT_CONFIRMATION:${phrase}`,
                    logs
                };
            }
        }

        // 6. MONOTEMATIC CHECK - No cross-niche vocabulary
        if (context.niche && !this.checkMonotematic(sanitized, context.niche)) {
            logs.push(`BLOCKED: Cross-niche vocabulary for ${context.niche}`);
            return {
                allowed: true,
                response: this.getSafeResponse(policy),
                reason: 'CROSS_NICHE',
                logs
            };
        }

        logs.push('PASSED: All validations');
        return { allowed: true, response: sanitized, reason: 'OK', logs };
    }

    /**
     * Simple validate (backward compatible)
     */
    static validate(response, policy = {}) {
        const result = this.validateWithReason(response, policy);
        return result.response;
    }

    /**
     * Check if user message triggers a stop rule (CALA)
     * @returns {{ stop: boolean, reason: string|null }}
     */
    static shouldStopWithReason(message, stopRules = []) {
        if (!message) return { stop: false, reason: null };

        const lowerMessage = message.toLowerCase().trim();

        // Default stop rules if none provided
        const rules = stopRules.length > 0 ? stopRules : [
            'amem', 'ok', 'deus abencoe', 'obrigad', 'ate mais',
            'bom dia', 'boa noite', 'valeu', 'vlw', 'blz', 'tchau', 'fui'
        ];

        // Short messages with stop words = CALA
        if (lowerMessage.length < 30) {
            for (const rule of rules) {
                if (lowerMessage.includes(rule.toLowerCase())) {
                    return { stop: true, reason: `STOP_RULE:${rule}` };
                }
            }
        }

        // Emoji-only messages = CALA
        const emojiOnly = /^[\p{Emoji}\s]+$/u;
        if (emojiOnly.test(message.trim())) {
            return { stop: true, reason: 'EMOJI_ONLY' };
        }

        return { stop: false, reason: null };
    }

    /**
     * Simple shouldStop (backward compatible)
     */
    static shouldStop(message, stopRules = []) {
        return this.shouldStopWithReason(message, stopRules).stop;
    }

    /**
     * Check if user message triggers escalation (ESCALA PARA HUMANO)
     * @returns {{ escalate: boolean, reason: string|null }}
     */
    static shouldEscalateWithReason(message, escalationRules = []) {
        if (!message) return { escalate: false, reason: null };

        const lowerMessage = message.toLowerCase();

        // Default escalation rules
        const rules = escalationRules.length > 0 ? escalationRules : [
            'me ajuda', 'desanimo', 'automatico', 'como voce faz',
            'quem e voce', 'tristeza', 'depressao', 'suicidio',
            'voce e bot', 'voce e ia', 'e voce mesma', 'parece bot'
        ];

        for (const rule of rules) {
            if (lowerMessage.includes(rule.toLowerCase())) {
                return { escalate: true, reason: `ESCALATION_RULE:${rule}` };
            }
        }

        // Audio message = ESCALA
        if (lowerMessage.includes('[audio]') || lowerMessage.includes('audio:')) {
            return { escalate: true, reason: 'AUDIO_MESSAGE' };
        }

        // Very long message (>500 chars) = might need human
        if (message.length > 500) {
            return { escalate: true, reason: 'LONG_MESSAGE' };
        }

        // Aggressive/upset detection
        const upsetIndicators = ['pqp', 'vsf', 'fdp', 'caralho', 'merda', 'porra'];
        for (const word of upsetIndicators) {
            if (lowerMessage.includes(word)) {
                return { escalate: true, reason: `UPSET:${word}` };
            }
        }

        return { escalate: false, reason: null };
    }

    /**
     * Simple shouldEscalate (backward compatible)
     */
    static shouldEscalate(message, escalationRules = []) {
        return this.shouldEscalateWithReason(message, escalationRules).escalate;
    }

    /**
     * Check monotematic focus
     */
    static checkMonotematic(response, niche) {
        const nicheExclusions = {
            'RELIGIOSO': ['emagrecer', 'dieta', 'candidato', 'voto', 'eleicao', 'partido', 'calorias', 'kg'],
            'POLITICA': ['orar', 'bencao', 'deus te', 'igreja', 'dieta', 'emagrecer', 'calorias', 'jejum'],
            'EMAGRECIMENTO': ['orar', 'bencao', 'candidato', 'voto', 'eleicao', 'partido', 'deus te']
        };

        const exclusions = nicheExclusions[niche] || [];
        const lowerResponse = response.toLowerCase();

        for (const word of exclusions) {
            if (lowerResponse.includes(word)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Truncate at sentence boundary
     */
    static truncateAtSentence(text, maxLength) {
        if (text.length <= maxLength) return text;

        const truncated = text.substring(0, maxLength);
        const lastPeriod = truncated.lastIndexOf('.');
        const lastQuestion = truncated.lastIndexOf('?');
        const lastExclamation = truncated.lastIndexOf('!');
        const lastEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);

        if (lastEnd > maxLength * 0.5) {
            return truncated.substring(0, lastEnd + 1);
        }

        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.7) {
            return truncated.substring(0, lastSpace) + '...';
        }

        return truncated + '...';
    }

    /**
     * Get safe fallback response
     */
    static getSafeResponse(policy = {}) {
        const safeResponses = [
            'Entendo! Me conta mais sobre isso.',
            'Interessante! Como posso te ajudar?',
            'Certo, estou aqui pra ajudar.',
            'Compreendo. O que mais posso fazer?',
            'Me fala mais sobre isso.'
        ];
        return safeResponses[Math.floor(Math.random() * safeResponses.length)];
    }

    /**
     * Escape regex special chars
     */
    static escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Build policy log entry for database
     */
    static buildLogEntry(action, reason, details = {}) {
        return {
            timestamp: new Date().toISOString(),
            action, // STOPPED, ESCALATED, BLOCKED, PASSED
            reason,
            ...details
        };
    }
}

module.exports = PolicyLayer;
