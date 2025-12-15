/**
 * PolicyLayer v2 Unit Tests
 * 
 * Run with: npx jest tests/policy-layer.test.js
 */

const PolicyLayer = require('../src/policy-layer');

describe('PolicyLayer v2', () => {

    // =========================================
    // 1. FORBIDDEN WORDS WITH SPACES
    // =========================================
    describe('hasForbidden - multi-word terms', () => {
        test('should detect "assistente virtual" (multi-word term)', () => {
            const text = 'Eu sou seu assistente virtual aqui';
            expect(PolicyLayer.hasForbidden(text, 'assistente virtual')).toBe(true);
        });

        test('should detect "inteligencia artificial" (multi-word term)', () => {
            const text = 'Isso é feito por inteligencia artificial';
            expect(PolicyLayer.hasForbidden(text, 'inteligencia artificial')).toBe(true);
        });

        test('should detect single word "bot" with boundary', () => {
            const text = 'Você é um bot?';
            expect(PolicyLayer.hasForbidden(text, 'bot')).toBe(true);
        });

        test('should NOT detect "bot" inside "roboto" (word boundary)', () => {
            const text = 'A fonte Roboto é bonita';
            expect(PolicyLayer.hasForbidden(text, 'bot')).toBe(false);
        });
    });

    describe('validateWithReason - forbidden words', () => {
        test('should block "assistente virtual" with reason FORBIDDEN_WORD', () => {
            const response = 'Sou seu assistente virtual pronto para ajudar';
            const result = PolicyLayer.validateWithReason(response, {});

            expect(result.reason).toContain('FORBIDDEN_WORD');
            expect(result.reason).toContain('assistente virtual');
        });
    });

    // =========================================
    // 2. "automatico" NOT GLOBALLY FORBIDDEN
    // =========================================
    describe('automatico - not blocked', () => {
        test('should NOT block "oração no automático" (religious context)', () => {
            const response = 'Quando você faz oração no automático, perde o sentido';
            const result = PolicyLayer.validateWithReason(response, {});

            expect(result.reason).toBe('OK');
        });

        test('should STILL block "automatizado"', () => {
            const response = 'Este é um processo automatizado';
            const result = PolicyLayer.validateWithReason(response, {});

            expect(result.reason).toContain('FORBIDDEN_WORD');
        });
    });

    // =========================================
    // 3. NAKED PRICE DETECTION
    // =========================================
    describe('detectPrice - naked prices with context', () => {
        test('should block "o valor é 19,90" (naked price with monetary context)', () => {
            const text = 'O valor é 19,90 por mês';
            const result = PolicyLayer.detectPrice(text);

            expect(result.detected).toBe(true);
            expect(result.reason).toBe('PRICE_BLOCKED_NAKED');
        });

        test('should block "custa apenas 27.90" (naked price with context)', () => {
            const text = 'Custa apenas 27.90';
            const result = PolicyLayer.detectPrice(text);

            expect(result.detected).toBe(true);
            expect(result.reason).toBe('PRICE_BLOCKED_NAKED');
        });

        test('should NOT block "faço 19,90 km" (no monetary context)', () => {
            const text = 'Hoje eu faço 19,90 km de caminhada';
            const result = PolicyLayer.detectPrice(text);

            expect(result.detected).toBe(false);
        });

        test('should block explicit "R$ 29,90"', () => {
            const text = 'O produto custa R$ 29,90';
            const result = PolicyLayer.detectPrice(text);

            expect(result.detected).toBe(true);
            expect(result.reason).toBe('PRICE_BLOCKED');
        });
    });

    // =========================================
    // 4. STOP RULES FOR LONG MESSAGES
    // =========================================
    describe('shouldStopWithReason - long messages', () => {
        test('should stop short message with "amém"', () => {
            const message = 'Amém!';
            const result = PolicyLayer.shouldStopWithReason(message);

            expect(result.stop).toBe(true);
            expect(result.reason).toBe('STOP_RULE:amém');
        });

        test('should stop long message "amém Deus abençoe muito" WITHOUT question mark', () => {
            const message = 'Amém Deus abençoe muito, que Deus te ilumine sempre e te proteja';
            const result = PolicyLayer.shouldStopWithReason(message);

            expect(result.stop).toBe(true);
            expect(result.reason).toContain('STOP_RULE_LONG');
        });

        test('should NOT stop if message has question mark (even with stop word)', () => {
            const message = 'Amém, mas você pode me explicar melhor o que você quis dizer?';
            const result = PolicyLayer.shouldStopWithReason(message);

            expect(result.stop).toBe(false);
        });

        test('should stop emoji-only message', () => {
            const message = '🙏🙏🙏';
            const result = PolicyLayer.shouldStopWithReason(message);

            expect(result.stop).toBe(true);
            expect(result.reason).toBe('EMOJI_ONLY');
        });
    });

    // =========================================
    // 5. IDENTITY QUESTIONS vs ESCALATION
    // =========================================
    describe('shouldEscalateWithReason - identity questions', () => {
        test('should NOT escalate "com quem eu falo?" (identity question)', () => {
            const message = 'Com quem eu falo?';
            const result = PolicyLayer.shouldEscalateWithReason(message);

            expect(result.escalate).toBe(false);
            expect(result.reason).toBe('IDENTITY_QUESTION_NO_ESCALATE');
        });

        test('should NOT escalate "é você mesma?" (identity question)', () => {
            const message = 'É você mesma, pastora?';
            const result = PolicyLayer.shouldEscalateWithReason(message);

            expect(result.escalate).toBe(false);
            expect(result.reason).toBe('IDENTITY_QUESTION_NO_ESCALATE');
        });

        test('should ESCALATE "vc é bot?" (bot suspicion)', () => {
            const message = 'Vc é bot?';
            const result = PolicyLayer.shouldEscalateWithReason(message);

            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('BOT_SUSPECT');
        });

        test('should ESCALATE "parece bot isso" (bot suspicion)', () => {
            const message = 'Parece bot isso que você está falando';
            const result = PolicyLayer.shouldEscalateWithReason(message);

            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('BOT_SUSPECT');
        });

        test('should ESCALATE "suicidio" (always escalate)', () => {
            const message = 'Estou pensando em suicidio';
            const result = PolicyLayer.shouldEscalateWithReason(message);

            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('ESCALATION_RULE');
        });
    });

    // =========================================
    // 6. CUSTOM SAFE RESPONSES
    // =========================================
    describe('getSafeResponse - custom per policy', () => {
        test('should use policy.safe_responses when provided', () => {
            const policy = {
                safe_responses: [
                    'Deus te abençoe, me conta mais.',
                    'Que bonito, me fala mais sobre isso.'
                ]
            };

            const response = PolicyLayer.getSafeResponse(policy);
            expect(policy.safe_responses).toContain(response);
        });

        test('should use default fallback when no policy.safe_responses', () => {
            const response = PolicyLayer.getSafeResponse({});

            expect(response).toBeTruthy();
            expect(typeof response).toBe('string');
        });
    });

    // =========================================
    // 7. CUSTOM HANDOFF MESSAGE
    // =========================================
    describe('getHandoffMessage', () => {
        test('should return policy.handoff_message when provided', () => {
            const policy = {
                handoff_message: 'Deixa eu pensar com carinho e já volto.'
            };

            const message = PolicyLayer.getHandoffMessage(policy);
            expect(message).toBe('Deixa eu pensar com carinho e já volto.');
        });

        test('should return default when no policy.handoff_message', () => {
            const message = PolicyLayer.getHandoffMessage({});

            expect(message).toBe('Entendo... vou ler com calma e já te respondo.');
        });
    });

    // =========================================
    // 8. IMPROVED LINK REGEX
    // =========================================
    describe('hasLink - improved detection', () => {
        test('should detect https:// URLs', () => {
            expect(PolicyLayer.hasLink('Acesse https://example.com/path')).toBe(true);
        });

        test('should detect www. URLs', () => {
            expect(PolicyLayer.hasLink('Visite www.meusite.com.br')).toBe(true);
        });

        test('should detect bit.ly shorteners', () => {
            expect(PolicyLayer.hasLink('Clique em bit.ly/abc123')).toBe(true);
        });

        test('should detect domain with path', () => {
            expect(PolicyLayer.hasLink('Acesse meusite.com/pagina')).toBe(true);
        });

        test('should NOT detect email addresses', () => {
            // Emails don't have path, so shouldn't trigger
            expect(PolicyLayer.hasLink('Meu email é contato@dominio.com')).toBe(false);
        });

        test('should NOT detect domain without path (like typos)', () => {
            // "meu.com" alone without path shouldn't trigger
            expect(PolicyLayer.hasLink('meu.com')).toBe(false);
        });
    });

    // =========================================
    // INTEGRATION TESTS
    // =========================================
    describe('Integration - full validation flow', () => {
        test('should pass clean religious response', () => {
            const response = 'Que Deus te abençoe! Você está no caminho certo.';
            const result = PolicyLayer.validateWithReason(response, {}, { niche: 'RELIGIOSO' });

            expect(result.reason).toBe('OK');
            expect(result.response).toBe(response);
        });

        test('should block response with bot confirmation', () => {
            const response = 'Eu sou um bot programado para ajudar';
            const result = PolicyLayer.validateWithReason(response, {});

            expect(result.reason).toContain('BOT_CONFIRMATION');
        });

        test('should use custom safe_responses when blocking', () => {
            const policy = {
                safe_responses: ['Deus te guie sempre.']
            };
            const response = 'Sou um chatbot aqui para ajudar';
            const result = PolicyLayer.validateWithReason(response, policy);

            expect(result.response).toBe('Deus te guie sempre.');
        });
    });
});
