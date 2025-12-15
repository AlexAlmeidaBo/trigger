/**
 * PolicyLayer v2 Unit Tests
 * Run with: node node_modules/jest/bin/jest.js tests/policy-layer.test.js
 */

const PolicyLayer = require('../src/policy-layer');

describe('PolicyLayer v2', () => {

    // 1. FORBIDDEN WORDS WITH SPACES
    describe('hasForbidden', () => {
        test('detects "assistente virtual" (multi-word)', () => {
            expect(PolicyLayer.hasForbidden('Eu sou seu assistente virtual', 'assistente virtual')).toBe(true);
        });

        test('detects single word "bot" with boundary', () => {
            expect(PolicyLayer.hasForbidden('Você é um bot?', 'bot')).toBe(true);
        });

        test('does NOT detect "bot" inside "roboto"', () => {
            expect(PolicyLayer.hasForbidden('A fonte Roboto é bonita', 'bot')).toBe(false);
        });
    });

    // 2. "automatico" NOT BLOCKED
    describe('automatico handling', () => {
        test('allows "oração no automático"', () => {
            const result = PolicyLayer.validateWithReason('Quando você faz oração no automático', {});
            expect(result.reason).toBe('OK');
        });

        test('blocks "automatizado"', () => {
            const result = PolicyLayer.validateWithReason('Este é um processo automatizado', {});
            expect(result.reason).toContain('FORBIDDEN_WORD');
        });
    });

    // 3. NAKED PRICE DETECTION
    describe('detectPrice', () => {
        test('blocks "valor é 19,90" (naked with context)', () => {
            const result = PolicyLayer.detectPrice('O valor é 19,90 por mês');
            expect(result.detected).toBe(true);
            expect(result.reason).toBe('PRICE_BLOCKED_NAKED');
        });

        test('does NOT block "19,90 km" (no monetary context)', () => {
            const result = PolicyLayer.detectPrice('Hoje faço 19,90 km de caminhada');
            expect(result.detected).toBe(false);
        });

        test('blocks "R$ 29,90"', () => {
            const result = PolicyLayer.detectPrice('O produto custa R$ 29,90');
            expect(result.detected).toBe(true);
            expect(result.reason).toBe('PRICE_BLOCKED');
        });
    });

    // 4. STOP RULES FOR LONG MESSAGES
    describe('shouldStopWithReason', () => {
        test('stops short "Amém!"', () => {
            const result = PolicyLayer.shouldStopWithReason('Amém!');
            expect(result.stop).toBe(true);
            expect(result.reason).toContain('STOP_RULE');
        });

        test('stops long message without "?"', () => {
            const msg = 'Amém Deus abençoe muito, que Deus te ilumine sempre';
            const result = PolicyLayer.shouldStopWithReason(msg);
            expect(result.stop).toBe(true);
            expect(result.reason).toContain('STOP_RULE_LONG');
        });

        test('does NOT stop if has "?"', () => {
            const msg = 'Amém, mas pode explicar melhor?';
            const result = PolicyLayer.shouldStopWithReason(msg);
            expect(result.stop).toBe(false);
        });

        test('stops emoji-only', () => {
            const result = PolicyLayer.shouldStopWithReason('🙏🙏🙏');
            expect(result.stop).toBe(true);
            expect(result.reason).toBe('EMOJI_ONLY');
        });
    });

    // 5. IDENTITY QUESTIONS
    describe('shouldEscalateWithReason', () => {
        test('does NOT escalate "com quem eu falo?"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('Com quem eu falo?');
            expect(result.escalate).toBe(false);
            expect(result.reason).toBe('IDENTITY_QUESTION_NO_ESCALATE');
        });

        test('does NOT escalate "é você mesma?"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('É você mesma, pastora?');
            expect(result.escalate).toBe(false);
            expect(result.reason).toBe('IDENTITY_QUESTION_NO_ESCALATE');
        });

        test('ESCALATES "vc é bot?"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('vc é bot?');
            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('BOT_SUSPECT');
        });

        test('ESCALATES "parece bot"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('Parece bot isso');
            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('BOT_SUSPECT');
        });

        test('ESCALATES "suicidio"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('Estou pensando em suicidio');
            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('ESCALATION_RULE');
        });
    });

    // 6. CUSTOM SAFE RESPONSES
    describe('getSafeResponse', () => {
        test('uses policy.safe_responses when provided', () => {
            const policy = { safe_responses: ['Deus te abençoe'] };
            expect(PolicyLayer.getSafeResponse(policy)).toBe('Deus te abençoe');
        });

        test('uses default when no custom', () => {
            const response = PolicyLayer.getSafeResponse({});
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        });
    });

    // 7. HANDOFF MESSAGE
    describe('getHandoffMessage', () => {
        test('uses policy.handoff_message when provided', () => {
            const policy = { handoff_message: 'Deixa eu pensar...' };
            expect(PolicyLayer.getHandoffMessage(policy)).toBe('Deixa eu pensar...');
        });

        test('uses default when no custom', () => {
            expect(PolicyLayer.getHandoffMessage({})).toBe('Entendo... vou ler com calma e já te respondo.');
        });
    });

    // 8. LINK DETECTION
    describe('hasLink', () => {
        test('detects https:// URLs', () => {
            expect(PolicyLayer.hasLink('Acesse https://example.com/path')).toBe(true);
        });

        test('detects www. URLs', () => {
            expect(PolicyLayer.hasLink('Visite www.site.com.br')).toBe(true);
        });

        test('detects bit.ly shorteners', () => {
            expect(PolicyLayer.hasLink('Clique em bit.ly/abc123')).toBe(true);
        });

        test('does NOT detect emails', () => {
            expect(PolicyLayer.hasLink('Email: contato@dominio.com')).toBe(false);
        });
    });

    // INTEGRATION
    describe('Integration', () => {
        test('passes clean religious response', () => {
            const result = PolicyLayer.validateWithReason('Que Deus te abençoe!', {}, { niche: 'RELIGIOSO' });
            expect(result.reason).toBe('OK');
        });

        test('blocks forbidden word "bot"', () => {
            const result = PolicyLayer.validateWithReason('Eu sou um bot', {});
            expect(result.reason).toContain('FORBIDDEN_WORD');
        });

        test('uses custom safe_responses when blocking', () => {
            const policy = { safe_responses: ['Deus te guie.'] };
            const result = PolicyLayer.validateWithReason('Sou um chatbot', policy);
            expect(result.response).toBe('Deus te guie.');
        });
    });
});
