/**
 * PolicyLayer v2 Complete Unit Tests - 90%+ Coverage Target
 * Run with: node node_modules/jest/bin/jest.js --coverage
 */

const PolicyLayer = require('../src/policy-layer');

describe('PolicyLayer v2', () => {

    // ===== FORBIDDEN WORDS =====
    describe('hasForbidden', () => {
        test('detects multi-word "assistente virtual"', () => {
            expect(PolicyLayer.hasForbidden('Eu sou seu assistente virtual', 'assistente virtual')).toBe(true);
        });

        test('detects multi-word "inteligencia artificial"', () => {
            expect(PolicyLayer.hasForbidden('Feito por inteligencia artificial', 'inteligencia artificial')).toBe(true);
        });

        test('detects single word "bot" with boundary', () => {
            expect(PolicyLayer.hasForbidden('Você é um bot?', 'bot')).toBe(true);
        });

        test('does NOT detect "bot" inside "roboto"', () => {
            expect(PolicyLayer.hasForbidden('A fonte Roboto é bonita', 'bot')).toBe(false);
        });

        test('is case insensitive', () => {
            expect(PolicyLayer.hasForbidden('Eu sou um BOT', 'bot')).toBe(true);
        });
    });

    // ===== AUTOMATICO HANDLING =====
    describe('automatico handling', () => {
        test('allows "oração no automático"', () => {
            const result = PolicyLayer.validateWithReason('Quando você faz oração no automático', {});
            expect(result.reason).toBe('OK');
        });

        test('blocks "automatizado"', () => {
            const result = PolicyLayer.validateWithReason('Este é um processo automatizado', {});
            expect(result.reason).toContain('FORBIDDEN_WORD');
        });

        test('blocks "automacao"', () => {
            const result = PolicyLayer.validateWithReason('Isso é automacao pura', {});
            expect(result.reason).toContain('FORBIDDEN_WORD');
        });

        test('blocks "programado"', () => {
            const result = PolicyLayer.validateWithReason('Fui programado para isso', {});
            expect(result.reason).toContain('FORBIDDEN_WORD');
        });
    });

    // ===== VALIDATE WITH REASON =====
    describe('validateWithReason', () => {
        test('returns EMPTY_RESPONSE for null', () => {
            const result = PolicyLayer.validateWithReason(null);
            expect(result.reason).toBe('EMPTY_RESPONSE');
            expect(result.allowed).toBe(false);
        });

        test('returns EMPTY_RESPONSE for empty string', () => {
            const result = PolicyLayer.validateWithReason('');
            expect(result.reason).toBe('EMPTY_RESPONSE');
        });

        test('truncates long messages', () => {
            const longMsg = 'A'.repeat(500);
            const result = PolicyLayer.validateWithReason(longMsg, { max_chars_per_message: 100 });
            expect(result.response.length).toBeLessThanOrEqual(103); // 100 + "..."
            expect(result.logs.some(l => l.includes('TRUNCATED'))).toBe(true);
        });

        test('blocks links when allow_links is false/undefined', () => {
            const result = PolicyLayer.validateWithReason('Acesse https://meusite.com/path', {});
            expect(result.reason).toBe('LINK_BLOCKED');
        });

        test('allows links when allow_links is true', () => {
            const result = PolicyLayer.validateWithReason('Acesse https://meusite.com/path', { allow_links: true });
            expect(result.reason).toBe('OK');
        });

        test('blocks prices when allow_price is false/undefined', () => {
            const result = PolicyLayer.validateWithReason('O valor é R$ 29,90', {});
            expect(result.reason).toBe('PRICE_BLOCKED');
        });

        test('allows prices when allow_price is true', () => {
            const result = PolicyLayer.validateWithReason('O valor é R$ 29,90', { allow_price: true });
            expect(result.reason).toBe('OK');
        });

        test('blocks sales terms like "checkout"', () => {
            const result = PolicyLayer.validateWithReason('Vá ao checkout e finalize', {});
            expect(result.reason).toContain('SALES_TERM');
        });

        test('blocks sales terms like "clique aqui"', () => {
            const result = PolicyLayer.validateWithReason('Clique aqui para comprar', {});
            expect(result.reason).toContain('SALES_TERM');
        });

        test('uses custom forbidden_words from policy', () => {
            const result = PolicyLayer.validateWithReason('Vamos falar de bitcoin', { forbidden_words: ['bitcoin'] });
            expect(result.reason).toContain('FORBIDDEN_WORD:bitcoin');
        });
    });

    // ===== BOT CONFIRMATION =====
    describe('BOT_CONFIRMATION', () => {
        test('blocks "sou um bot"', () => {
            const result = PolicyLayer.validateWithReason('Olá, sou um bot aqui para ajudar', {});
            // Note: 'bot' is in GLOBAL_FORBIDDEN so it hits FORBIDDEN_WORD first
            expect(result.reason).toContain('FORBIDDEN_WORD');
        });

        test('blocks "sou uma ia"', () => {
            const result = PolicyLayer.validateWithReason('Eu sou uma ia treinada', {});
            expect(result.reason).toContain('BOT_CONFIRMATION');
        });

        test('blocks "nao sou humano"', () => {
            const result = PolicyLayer.validateWithReason('Eu nao sou humano, sou digital', {});
            expect(result.reason).toContain('BOT_CONFIRMATION');
        });

        test('blocks "fui programado" as FORBIDDEN_WORD', () => {
            const result = PolicyLayer.validateWithReason('Eu fui programado para isso', {});
            // 'programado' is in GLOBAL_FORBIDDEN, so it hits FORBIDDEN_WORD first
            expect(result.reason).toContain('FORBIDDEN_WORD');
        });

        test('blocks "meu criador"', () => {
            const result = PolicyLayer.validateWithReason('Meu criador me ensinou isso', {});
            expect(result.reason).toContain('BOT_CONFIRMATION');
        });
    });

    // ===== CROSS-NICHE / MONOTEMATIC =====
    describe('checkMonotematic', () => {
        test('blocks religious response with diet words in RELIGIOSO', () => {
            const result = PolicyLayer.validateWithReason('Você precisa emagrecer com fé', {}, { niche: 'RELIGIOSO' });
            expect(result.reason).toBe('CROSS_NICHE');
        });

        test('blocks political response with religious words in POLITICA', () => {
            const result = PolicyLayer.validateWithReason('Vamos orar pelo candidato', {}, { niche: 'POLITICA' });
            expect(result.reason).toBe('CROSS_NICHE');
        });

        test('allows on-niche response', () => {
            const result = PolicyLayer.validateWithReason('Que Deus te abençoe', {}, { niche: 'RELIGIOSO' });
            expect(result.reason).toBe('OK');
        });

        test('checkMonotematic returns true for unknown niche', () => {
            const result = PolicyLayer.checkMonotematic('Any text here', 'UNKNOWN_NICHE');
            expect(result).toBe(true);
        });
    });

    // ===== PRICE DETECTION =====
    describe('detectPrice', () => {
        test('blocks explicit "R$ 29,90"', () => {
            const result = PolicyLayer.detectPrice('O produto custa R$ 29,90');
            expect(result.detected).toBe(true);
            expect(result.reason).toBe('PRICE_BLOCKED');
        });

        test('blocks "49 reais"', () => {
            const result = PolicyLayer.detectPrice('São apenas 49 reais');
            expect(result.detected).toBe(true);
            expect(result.reason).toBe('PRICE_BLOCKED');
        });

        test('blocks naked price "19,90" with monetary context "valor"', () => {
            const result = PolicyLayer.detectPrice('O valor é 19,90 por mês');
            expect(result.detected).toBe(true);
            expect(result.reason).toBe('PRICE_BLOCKED_NAKED');
        });

        test('blocks naked price with "custa"', () => {
            const result = PolicyLayer.detectPrice('Custa apenas 27.90');
            expect(result.detected).toBe(true);
            expect(result.reason).toBe('PRICE_BLOCKED_NAKED');
        });

        test('blocks naked price with "investimento"', () => {
            const result = PolicyLayer.detectPrice('O investimento é 99,00');
            expect(result.detected).toBe(true);
            expect(result.reason).toBe('PRICE_BLOCKED_NAKED');
        });

        test('does NOT block "19,90 km" (no monetary context)', () => {
            const result = PolicyLayer.detectPrice('Hoje faço 19,90 km de caminhada');
            expect(result.detected).toBe(false);
        });

        test('does NOT block random numbers', () => {
            const result = PolicyLayer.detectPrice('Tenho 25 anos de experiência');
            expect(result.detected).toBe(false);
        });
    });

    // ===== STOP RULES =====
    describe('shouldStopWithReason', () => {
        test('stops short "Amém!"', () => {
            const result = PolicyLayer.shouldStopWithReason('Amém!');
            expect(result.stop).toBe(true);
            expect(result.reason).toContain('STOP_RULE');
        });

        test('stops "ok" short message', () => {
            const result = PolicyLayer.shouldStopWithReason('ok');
            expect(result.stop).toBe(true);
        });

        test('stops "valeu" short message', () => {
            const result = PolicyLayer.shouldStopWithReason('valeu');
            expect(result.stop).toBe(true);
        });

        test('stops "tchau"', () => {
            const result = PolicyLayer.shouldStopWithReason('tchau');
            expect(result.stop).toBe(true);
        });

        test('stops long message WITHOUT "?"', () => {
            const msg = 'Amém Deus abençoe muito, que Deus te ilumine sempre e te proteja';
            const result = PolicyLayer.shouldStopWithReason(msg);
            expect(result.stop).toBe(true);
            expect(result.reason).toContain('STOP_RULE_LONG');
        });

        test('does NOT stop if has "?"', () => {
            const msg = 'Amém, mas pode explicar melhor o que você quis dizer?';
            const result = PolicyLayer.shouldStopWithReason(msg);
            expect(result.stop).toBe(false);
        });

        test('stops emoji-only 🙏🙏🙏', () => {
            const result = PolicyLayer.shouldStopWithReason('🙏🙏🙏');
            expect(result.stop).toBe(true);
            expect(result.reason).toBe('EMOJI_ONLY');
        });

        test('stops emoji-only with spaces', () => {
            const result = PolicyLayer.shouldStopWithReason('🙏 🙏');
            expect(result.stop).toBe(true);
            expect(result.reason).toBe('EMOJI_ONLY');
        });

        test('uses custom stop_rules from array', () => {
            const result = PolicyLayer.shouldStopWithReason('paz', ['paz', 'amem']);
            expect(result.stop).toBe(true);
        });

        test('returns false for null message', () => {
            const result = PolicyLayer.shouldStopWithReason(null);
            expect(result.stop).toBe(false);
        });
    });

    // ===== ESCALATION RULES =====
    describe('shouldEscalateWithReason', () => {
        // Identity questions - should NOT escalate
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

        test('does NOT escalate "quem é você?"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('Quem é você?');
            expect(result.escalate).toBe(false);
            expect(result.reason).toBe('IDENTITY_QUESTION_NO_ESCALATE');
        });

        // Bot suspicion - SHOULD escalate
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

        test('ESCALATES "resposta automatica"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('Isso parece resposta automatica');
            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('BOT_SUSPECT');
        });

        // Critical escalation - always escalate
        test('ESCALATES "suicidio"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('Estou pensando em suicidio');
            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('ESCALATION_RULE');
        });

        test('ESCALATES "depressao"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('Estou com depressao');
            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('ESCALATION_RULE');
        });

        test('ESCALATES "me ajuda"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('Por favor me ajuda');
            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('ESCALATION_RULE');
        });

        // Audio
        test('ESCALATES [audio] message', () => {
            const result = PolicyLayer.shouldEscalateWithReason('[audio] mensagem de voz');
            expect(result.escalate).toBe(true);
            expect(result.reason).toBe('AUDIO_MESSAGE');
        });

        // Long message
        test('ESCALATES very long message (>500 chars)', () => {
            const longMsg = 'A'.repeat(501);
            const result = PolicyLayer.shouldEscalateWithReason(longMsg);
            expect(result.escalate).toBe(true);
            expect(result.reason).toBe('LONG_MESSAGE');
        });

        // Upset indicators
        test('ESCALATES upset word "pqp"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('pqp isso não funciona');
            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('UPSET');
        });

        test('ESCALATES upset word "vsf"', () => {
            const result = PolicyLayer.shouldEscalateWithReason('vsf para de me encher');
            expect(result.escalate).toBe(true);
            expect(result.reason).toContain('UPSET');
        });

        test('uses custom escalation_rules', () => {
            const result = PolicyLayer.shouldEscalateWithReason('preciso de reembolso', ['reembolso', 'devolucao']);
            expect(result.escalate).toBe(true);
        });

        test('returns false for null message', () => {
            const result = PolicyLayer.shouldEscalateWithReason(null);
            expect(result.escalate).toBe(false);
        });

        test('returns false for normal message', () => {
            const result = PolicyLayer.shouldEscalateWithReason('Bom dia, tudo bem?');
            expect(result.escalate).toBe(false);
            expect(result.reason).toBe(null);
        });
    });

    // ===== SAFE RESPONSE =====
    describe('getSafeResponse', () => {
        test('uses policy.safe_responses when provided', () => {
            const policy = { safe_responses: ['Deus te abençoe, me conta mais.'] };
            const response = PolicyLayer.getSafeResponse(policy);
            expect(response).toBe('Deus te abençoe, me conta mais.');
        });

        test('picks random from safe_responses array', () => {
            const policy = { safe_responses: ['Resp1', 'Resp2', 'Resp3'] };
            const response = PolicyLayer.getSafeResponse(policy);
            expect(policy.safe_responses).toContain(response);
        });

        test('uses default when no custom', () => {
            const response = PolicyLayer.getSafeResponse({});
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        });

        test('uses default when safe_responses is empty array', () => {
            const response = PolicyLayer.getSafeResponse({ safe_responses: [] });
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        });
    });

    // ===== HANDOFF MESSAGE =====
    describe('getHandoffMessage', () => {
        test('uses policy.handoff_message when provided', () => {
            const policy = { handoff_message: 'Deixa eu pensar com carinho...' };
            const msg = PolicyLayer.getHandoffMessage(policy);
            expect(msg).toBe('Deixa eu pensar com carinho...');
        });

        test('uses default when no custom', () => {
            const msg = PolicyLayer.getHandoffMessage({});
            expect(msg).toBe('Entendo... vou ler com calma e já te respondo.');
        });

        test('default does NOT mention "equipe"', () => {
            const msg = PolicyLayer.getHandoffMessage({});
            expect(msg.toLowerCase()).not.toContain('equipe');
        });

        test('default does NOT mention "sistema"', () => {
            const msg = PolicyLayer.getHandoffMessage({});
            expect(msg.toLowerCase()).not.toContain('sistema');
        });

        test('default does NOT mention "automação"', () => {
            const msg = PolicyLayer.getHandoffMessage({});
            expect(msg.toLowerCase()).not.toContain('automação');
        });
    });

    // ===== LINK DETECTION =====
    describe('hasLink', () => {
        test('detects https:// URLs', () => {
            expect(PolicyLayer.hasLink('Acesse https://example.com/path')).toBe(true);
        });

        test('detects http:// URLs', () => {
            expect(PolicyLayer.hasLink('Veja http://site.com')).toBe(true);
        });

        test('detects www. URLs', () => {
            expect(PolicyLayer.hasLink('Visite www.site.com.br')).toBe(true);
        });

        test('detects bit.ly shorteners', () => {
            expect(PolicyLayer.hasLink('Clique em bit.ly/abc123')).toBe(true);
        });

        test('detects t.co shorteners', () => {
            expect(PolicyLayer.hasLink('Link: t.co/xyz')).toBe(true);
        });

        test('detects domain with path', () => {
            expect(PolicyLayer.hasLink('meusite.com/pagina')).toBe(true);
        });

        test('does NOT detect emails', () => {
            expect(PolicyLayer.hasLink('Email: contato@dominio.com')).toBe(false);
        });

        test('does NOT detect domain without path', () => {
            expect(PolicyLayer.hasLink('meu.com')).toBe(false);
        });
    });

    // ===== TRUNCATE =====
    describe('truncateAtSentence', () => {
        test('returns original if under max length', () => {
            const result = PolicyLayer.truncateAtSentence('Hello world.', 100);
            expect(result).toBe('Hello world.');
        });

        test('truncates at sentence boundary', () => {
            const text = 'First sentence. Second sentence. Third sentence.';
            const result = PolicyLayer.truncateAtSentence(text, 25);
            expect(result).toBe('First sentence.');
        });

        test('adds ... if no good sentence break', () => {
            const text = 'This is a very long text without periods that goes on';
            const result = PolicyLayer.truncateAtSentence(text, 30);
            expect(result.endsWith('...')).toBe(true);
        });
    });

    // ===== BACKWARD COMPATIBILITY =====
    describe('Backward compatible methods', () => {
        test('validate() returns string', () => {
            const result = PolicyLayer.validate('Hello world', {});
            expect(typeof result).toBe('string');
        });

        test('shouldStop() returns boolean', () => {
            const result = PolicyLayer.shouldStop('amém');
            expect(typeof result).toBe('boolean');
            expect(result).toBe(true);
        });

        test('shouldEscalate() returns boolean', () => {
            const result = PolicyLayer.shouldEscalate('suicidio');
            expect(typeof result).toBe('boolean');
            expect(result).toBe(true);
        });
    });

    // ===== UTILITY =====
    describe('Utility methods', () => {
        test('escapeRegex escapes special characters', () => {
            const result = PolicyLayer.escapeRegex('test.com');
            expect(result).toBe('test\\.com');
        });

        test('buildLogEntry creates structured log', () => {
            const log = PolicyLayer.buildLogEntry('BLOCKED', 'FORBIDDEN_WORD', { word: 'bot' });
            expect(log.action).toBe('BLOCKED');
            expect(log.reason).toBe('FORBIDDEN_WORD');
            expect(log.word).toBe('bot');
            expect(log.timestamp).toBeDefined();
        });
    });

    // ===== INTEGRATION =====
    describe('Integration', () => {
        test('passes clean religious response', () => {
            const result = PolicyLayer.validateWithReason('Que Deus te abençoe!', {}, { niche: 'RELIGIOSO' });
            expect(result.reason).toBe('OK');
            expect(result.response).toBe('Que Deus te abençoe!');
        });

        test('blocks and uses custom safe_responses', () => {
            const policy = { safe_responses: ['Deus te guie sempre.'] };
            const result = PolicyLayer.validateWithReason('Sou um chatbot aqui', policy);
            expect(result.response).toBe('Deus te guie sempre.');
        });

        test('full religious niche validation', () => {
            const policy = {
                safe_responses: ['Que bênção!'],
                handoff_message: 'Vou orar por isso.'
            };
            const context = { niche: 'RELIGIOSO' };

            // Valid message passes
            const r1 = PolicyLayer.validateWithReason('Deus é maravilhoso!', policy, context);
            expect(r1.reason).toBe('OK');

            // Bot word blocks
            const r2 = PolicyLayer.validateWithReason('Eu sou um chatbot', policy, context);
            expect(r2.response).toBe('Que bênção!');

            // Cross-niche blocks
            const r3 = PolicyLayer.validateWithReason('Vamos emagrecer juntos', policy, context);
            expect(r3.reason).toBe('CROSS_NICHE');
        });
    });
});
