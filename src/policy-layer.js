/**
 * Policy Layer v2 - Validates and sanitizes agent responses
 * 
 * POLICY IS LAW. Prompt is suggestion.
 * 
 * v2 Changes:
 * - hasForbidden() for terms with spaces
 * - Removed "automatico" from global forbidden (religious niches use it)
 * - Naked price detection (19,90 with monetary context)
 * - Stop rules work for messages >30 chars without "?"
 * - Identity questions don't escalate (only bot suspicion does)
 * - Custom safe_responses per policy
 * - Custom handoff_message per policy
 * - Improved link regex (fewer false positives)
 */

class PolicyLayer {

    // Default forbidden words - NEVER appear in responses
    // Note: "automatico" removed (legitimate in religious context: "oração no automático")
    static GLOBAL_FORBIDDEN = [
        // Tech terms (single words)
        'nicho', 'cerebro', 'archetype', 'arquetipo',
        'bot', 'robo', 'automatizado', 'automacao',
        'programado', 'configurado', 'algoritmo',
        'software', 'api', 'backend', 'frontend',
        'prompt', 'gpt', 'openai', 'chatgpt', 'llm',
        'chatbot',
        // Multi-word terms (will use includes)
        'inteligencia artificial',
        'assistente virtual',
        'agente virtual',
        'machine learning',
        'ia generativa'
    ];

    // Payment/sales blocklist
    static SALES_BLOCKLIST = [
        'checkout', 'pagamento', 'pagar agora', 'comprar agora',
        'cartao de credito', 'pix', 'boleto', 'parcelado',
        'clique aqui', 'acesse o link', 'link na bio',
        'aproveite a oferta', 'promocao relampago'
    ];

    // Identity questions - don't escalate, just need persona affirmation
    static IDENTITY_QUESTIONS = [
        'com quem eu falo',
        'quem e voce',
        'quem é você',
        'vc e voce mesma',
        'é você mesma',
        'e vc mesma',
        'é vc',
        'e a pastora',
        'é a pastora',
        'falo com quem',
        'quem ta falando'
    ];

    // Bot suspicion - THESE escalate or trigger special handling
    static BOT_SUSPICION = [
        'vc e bot',
        'vc é bot',
        'voce e bot',
        'voce é bot',
        'você e bot',
        'você é bot',
        'parece bot',
        'parece robo',
        'parece robô',
        'vc e ia',
        'vc é ia',
        'voce e ia',
        'voce é ia',
        'você é ia',
        'isso e automatico',
        'isso é automatico',
        'resposta automatica',
        'resposta automática'
    ];

    /**
     * Check if text contains forbidden word
     * Handles multi-word terms (with spaces) differently from single words
     */
    static hasForbidden(text, word) {
        const lowerText = text.toLowerCase();
        const lowerWord = word.toLowerCase();

        // If word contains space, use simple includes (more reliable)
        if (lowerWord.includes(' ')) {
            return lowerText.includes(lowerWord);
        }

        // Single word: use word boundary regex
        try {
            const regex = new RegExp(`\\b${this.escapeRegex(lowerWord)}\\b`, 'i');
            return regex.test(lowerText);
        } catch (e) {
            // Fallback to includes if regex fails
            return lowerText.includes(lowerWord);
        }
    }

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

        // 2. FORBIDDEN WORDS - Using hasForbidden for proper detection
        const forbiddenWords = [
            ...this.GLOBAL_FORBIDDEN,
            ...(policy.forbidden_words || [])
        ];

        for (const word of forbiddenWords) {
            if (this.hasForbidden(sanitized, word)) {
                logs.push(`BLOCKED: Forbidden word "${word}"`);
                return {
                    allowed: true,
                    response: this.getSafeResponse(policy),
                    reason: `FORBIDDEN_WORD:${word}`,
                    logs
                };
            }
        }

        // 3. LINKS - Improved regex with fewer false positives
        if (!policy.allow_links) {
            if (this.hasLink(sanitized)) {
                logs.push('BLOCKED: Link detected');
                return {
                    allowed: true,
                    response: this.getSafeResponse(policy),
                    reason: 'LINK_BLOCKED',
                    logs
                };
            }
        }

        // 4. PRICE/PAYMENT - Including naked prices with monetary context
        if (!policy.allow_price) {
            const priceResult = this.detectPrice(sanitized);
            if (priceResult.detected) {
                logs.push(`BLOCKED: ${priceResult.reason}`);
                return {
                    allowed: true,
                    response: this.getSafeResponse(policy),
                    reason: priceResult.reason,
                    logs
                };
            }

            // Also check sales blocklist
            for (const term of this.SALES_BLOCKLIST) {
                if (this.hasForbidden(sanitized, term)) {
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
            'fui programad', 'me programaram', 'meu criador',
            'minha programacao'
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
     * Detect prices - including naked prices with monetary context
     */
    static detectPrice(text) {
        const lowerText = text.toLowerCase();

        // Explicit price patterns
        const explicitPrice = /R\$\s*[\d.,]+|(\d+)\s*(reais|real)/gi;
        if (explicitPrice.test(text)) {
            return { detected: true, reason: 'PRICE_BLOCKED' };
        }

        // Naked price (19,90 or 19.90) with monetary context
        const nakedMoneyRegex = /\b\d{1,3}([.,]\d{2})\b/;
        const moneyContextRegex = /(valor|custa|por apenas|fica|investimento|preço|preco|pagar|pagamento|parcela|mensalidade)/i;

        if (nakedMoneyRegex.test(text) && moneyContextRegex.test(lowerText)) {
            return { detected: true, reason: 'PRICE_BLOCKED_NAKED' };
        }

        return { detected: false, reason: null };
    }

    /**
     * Detect links with improved regex (fewer false positives)
     */
    static hasLink(text) {
        // Priority 1: Clear URLs with protocol
        if (/https?:\/\/[^\s]+/i.test(text)) return true;

        // Priority 2: www. prefix
        if (/www\.[^\s]+/i.test(text)) return true;

        // Priority 3: Common TLDs with path (not just domain)
        // Matches: site.com/path, site.com.br/path
        // Does NOT match: email@domain.com, just "meu.com" without path
        if (/[a-zA-Z0-9-]+\.(com|net|org|io|app|br|me)(\/[^\s]*)/i.test(text)) return true;

        // Priority 4: bit.ly, t.co style shorteners
        if (/\b(bit\.ly|t\.co|goo\.gl|tinyurl\.com|rb\.gy)\/[^\s]+/i.test(text)) return true;

        return false;
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
     * v2: Works for messages >30 chars if no "?" present
     * @returns {{ stop: boolean, reason: string|null }}
     */
    static shouldStopWithReason(message, stopRules = []) {
        if (!message) return { stop: false, reason: null };

        const lowerMessage = message.toLowerCase().trim();
        const hasQuestion = message.includes('?');

        // Default stop rules if none provided
        const rules = stopRules.length > 0 ? stopRules : [
            'amem', 'amém', 'ok', 'deus abencoe', 'deus abençoe',
            'obrigad', 'ate mais', 'até mais', 'bom dia', 'boa noite',
            'valeu', 'vlw', 'blz', 'tchau', 'fui', 'falou', 'tmj'
        ];

        // Emoji-only messages = CALA
        const emojiOnly = /^[\p{Emoji}\s]+$/u;
        if (emojiOnly.test(message.trim())) {
            return { stop: true, reason: 'EMOJI_ONLY' };
        }

        // Check rules
        for (const rule of rules) {
            if (lowerMessage.includes(rule.toLowerCase())) {
                // Short message (<30) with stop rule = definitely stop
                if (lowerMessage.length < 30) {
                    return { stop: true, reason: `STOP_RULE:${rule}` };
                }

                // Longer message without question mark = also stop
                // (e.g., "amém Deus abençoe muito, que Deus te ilumine sempre")
                if (!hasQuestion) {
                    return { stop: true, reason: `STOP_RULE_LONG:${rule}` };
                }
            }
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
     * v2: Identity questions don't escalate, only bot suspicion does
     * @returns {{ escalate: boolean, reason: string|null }}
     */
    static shouldEscalateWithReason(message, escalationRules = []) {
        if (!message) return { escalate: false, reason: null };

        const lowerMessage = message.toLowerCase();

        // FIRST: Check if it's just an identity question (NO escalation)
        for (const q of this.IDENTITY_QUESTIONS) {
            if (lowerMessage.includes(q)) {
                // Check if there's also bot suspicion
                const hasBotSuspicion = this.BOT_SUSPICION.some(s => lowerMessage.includes(s));
                if (!hasBotSuspicion) {
                    // Just identity question, no need to escalate
                    return { escalate: false, reason: 'IDENTITY_QUESTION_NO_ESCALATE' };
                }
            }
        }

        // Check bot suspicion - escalate
        for (const suspicion of this.BOT_SUSPICION) {
            if (lowerMessage.includes(suspicion)) {
                return { escalate: true, reason: `BOT_SUSPECT:${suspicion}` };
            }
        }

        // Default escalation rules
        const rules = escalationRules.length > 0 ? escalationRules : [
            'me ajuda', 'desanimo', 'desânimo', 'tristeza',
            'depressao', 'depressão', 'suicidio', 'suicídio',
            'me matar', 'nao aguento', 'não aguento',
            'preciso de ajuda', 'socorro'
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

        // THREATS AND ACCUSATIONS - Immediate escalation
        const threats = [
            'vou te processar', 'vai se arrepender', 'vou denunciar',
            'vou te matar', 'vou acabar com voce', 'vou acabar com você',
            'vou na policia', 'vou na polícia', 'advogado',
            'processado', 'procon'
        ];
        for (const threat of threats) {
            if (lowerMessage.includes(threat)) {
                return { escalate: true, reason: `THREAT:${threat}` };
            }
        }

        // Aggressive/upset detection
        const upsetIndicators = ['pqp', 'vsf', 'fdp', 'caralho', 'porra', 'merda', 'idiota', 'imbecil', 'babaca'];
        for (const word of upsetIndicators) {
            if (lowerMessage.includes(word)) {
                return { escalate: true, reason: `UPSET:${word}` };
            }
        }

        return { escalate: false, reason: null };
    }

    /**
     * Check if message needs desescalation (for POLITICA niche)
     * Returns a desescalation message if mild aggression detected
     * @returns {{ shouldDesescalate: boolean, message: string|null }}
     */
    static checkDesescalation(message, niche = '') {
        if (niche.toUpperCase() !== 'POLITICA') {
            return { shouldDesescalate: false, message: null };
        }

        const lowerMessage = message.toLowerCase();

        // Mild aggression indicators - try to desescalate first
        const mildAggression = [
            'voce ta errado', 'você ta errado', 'vc ta errado',
            'nao sabe nada', 'não sabe nada', 'ignorante',
            'burro', 'idiota', 'seu gado'
        ];

        for (const term of mildAggression) {
            if (lowerMessage.includes(term)) {
                return {
                    shouldDesescalate: true,
                    message: 'Ei, vamos manter o respeito? Podemos discordar sem ofensas. O que você acha?'
                };
            }
        }

        return { shouldDesescalate: false, message: null };
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
     * Get safe fallback response - uses policy.safe_responses if available
     */
    static getSafeResponse(policy = {}) {
        // Use custom safe responses if provided (per niche/persona)
        if (policy.safe_responses && policy.safe_responses.length > 0) {
            return policy.safe_responses[Math.floor(Math.random() * policy.safe_responses.length)];
        }

        // Default fallback
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
     * Get handoff message - uses policy.handoff_message if available
     * Note: Never mentions "equipe", "sistema", "automação"
     */
    static getHandoffMessage(policy = {}) {
        if (policy.handoff_message) {
            return policy.handoff_message;
        }

        // Default handoff that doesn't reveal automation
        return 'Entendo... vou ler com calma e já te respondo.';
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
            action,
            reason,
            ...details
        };
    }
}

module.exports = PolicyLayer;
