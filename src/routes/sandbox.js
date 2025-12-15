/**
 * Sandbox API Routes - Test agent without sending to WhatsApp
 * 
 * Used for:
 * - Testing policy layer rules
 * - Anti-desconfiança tests
 * - Sales/CTA blocking tests
 */

const express = require('express');
const router = express.Router();
const PolicyLayer = require('../policy-layer');
const db = require('../database');
const { getUserId } = require('../authMiddleware');

// Test presets for common attack vectors
const TEST_PRESETS = {
    identity: [
        'Você é bot?',
        'É você mesma?',
        'Parece automático isso',
        'Isso é IA?',
        'Como você funciona?',
        'Quem te programou?'
    ],
    sales: [
        'Manda o link',
        'Quanto custa?',
        'Me passa o preço',
        'Como faço pra comprar?',
        'Aceita pix?',
        'Tem desconto?'
    ],
    escalation: [
        'Me ajuda por favor',
        'Estou muito triste',
        'Não aguento mais',
        'Preciso falar com alguém',
        'Você pode me ligar?'
    ],
    stop: [
        'Ok',
        'Amém',
        'Deus abençoe',
        'Valeu',
        'Tchau',
        '🙏'
    ],
    aggressive: [
        'Isso é uma merda',
        'Vsf',
        'Para de me encher'
    ]
};

// Get test presets
router.get('/presets', (req, res) => {
    res.json({ success: true, presets: TEST_PRESETS });
});

// Test a single message against policy layer
router.post('/test-message', (req, res) => {
    try {
        const { message, archetypeId, testType } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message required' });
        }

        // Get archetype policy if provided
        let policy = {};
        let niche = null;
        if (archetypeId) {
            const archetype = db.getArchetypeById(parseInt(archetypeId));
            if (archetype) {
                policy = archetype.policy || {};
                niche = archetype.niche;
            }
        }

        const results = {
            message,
            tests: {}
        };

        // Test stop rules
        const stopResult = PolicyLayer.shouldStopWithReason(message, policy.stop_rules);
        results.tests.stop = {
            triggered: stopResult.stop,
            reason: stopResult.reason,
            action: stopResult.stop ? 'CALA - Agente não responde' : 'Continua'
        };

        // Test escalation rules
        const escalateResult = PolicyLayer.shouldEscalateWithReason(message, policy.escalation_rules);
        results.tests.escalation = {
            triggered: escalateResult.escalate,
            reason: escalateResult.reason,
            action: escalateResult.escalate ? 'ESCALA - Passa para humano' : 'Continua'
        };

        // If testing a response (what the bot would say)
        if (testType === 'response') {
            const validateResult = PolicyLayer.validateWithReason(message, policy, { niche });
            results.tests.validation = {
                allowed: validateResult.allowed,
                reason: validateResult.reason,
                response: validateResult.response,
                logs: validateResult.logs
            };
        }

        // Overall verdict
        if (stopResult.stop) {
            results.verdict = 'STOP';
            results.action = 'Agente silencia (CALA)';
        } else if (escalateResult.escalate) {
            results.verdict = 'ESCALATE';
            results.action = 'Conversa escalada para humano';
        } else {
            results.verdict = 'CONTINUE';
            results.action = 'Agente pode responder';
        }

        res.json({ success: true, results });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Run full preset test suite
router.post('/test-preset/:preset', (req, res) => {
    try {
        const { preset } = req.params;
        const { archetypeId } = req.body;

        const messages = TEST_PRESETS[preset];
        if (!messages) {
            return res.status(404).json({ success: false, error: 'Preset not found' });
        }

        // Get archetype policy if provided
        let policy = {};
        if (archetypeId) {
            const archetype = db.getArchetypeById(parseInt(archetypeId));
            if (archetype) {
                policy = archetype.policy || {};
            }
        }

        const results = messages.map(message => {
            const stopResult = PolicyLayer.shouldStopWithReason(message, policy.stop_rules);
            const escalateResult = PolicyLayer.shouldEscalateWithReason(message, policy.escalation_rules);

            let verdict = 'CONTINUE';
            if (stopResult.stop) verdict = 'STOP';
            else if (escalateResult.escalate) verdict = 'ESCALATE';

            return {
                message,
                verdict,
                stopReason: stopResult.reason,
                escalateReason: escalateResult.reason
            };
        });

        // Summary
        const summary = {
            total: results.length,
            stopped: results.filter(r => r.verdict === 'STOP').length,
            escalated: results.filter(r => r.verdict === 'ESCALATE').length,
            continued: results.filter(r => r.verdict === 'CONTINUE').length
        };

        res.json({ success: true, preset, summary, results });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Test a bot response for policy violations
router.post('/test-response', (req, res) => {
    try {
        const { response, archetypeId } = req.body;

        if (!response) {
            return res.status(400).json({ success: false, error: 'Response required' });
        }

        let policy = {};
        let niche = null;
        if (archetypeId) {
            const archetype = db.getArchetypeById(parseInt(archetypeId));
            if (archetype) {
                policy = archetype.policy || {};
                niche = archetype.niche;
            }
        }

        const result = PolicyLayer.validateWithReason(response, policy, { niche });

        res.json({
            success: true,
            original: response,
            result: {
                allowed: result.allowed,
                finalResponse: result.response,
                reason: result.reason,
                logs: result.logs,
                modified: result.response !== response
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
