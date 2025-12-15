/**
 * Archetype Validator
 * 
 * Ensures all archetypes inherit from BASE_ARCHETYPE_TEMPLATE
 * and cannot override immutable safety fields.
 */

const baseTemplate = require('./BASE_ARCHETYPE_TEMPLATE.json');

class ArchetypeValidator {

    /**
     * Get immutable policy fields from base template
     */
    static getImmutablePolicy() {
        const immutable = baseTemplate.IMMUTABLE_FIELDS.policy;
        return {
            max_messages_in_row: immutable.max_messages_in_row,
            allow_links: immutable.allow_links,
            allow_price: immutable.allow_price,
            global_forbidden_words: immutable.global_forbidden_words,
            mandatory_stop_rules: immutable.mandatory_stop_rules,
            mandatory_escalation_rules: immutable.mandatory_escalation_rules,
            bot_suspicion_escalate: immutable.bot_suspicion_escalate
        };
    }

    /**
     * Get niche exclusions for monotematic enforcement
     */
    static getNicheExclusions(niche) {
        return baseTemplate.NICHE_EXCLUSIONS[niche] || [];
    }

    /**
     * Validate archetype data before creation
     * Returns { valid: boolean, errors: string[] }
     */
    static validate(archetypeData) {
        const errors = [];

        // Required fields
        if (!archetypeData.persona_name) {
            errors.push('persona_name é obrigatório');
        }
        if (!archetypeData.niche) {
            errors.push('niche é obrigatório');
        }
        if (!archetypeData.tone) {
            errors.push('tone é obrigatório');
        }
        if (!archetypeData.system_prompt) {
            errors.push('system_prompt é obrigatório');
        }

        // Valid niches
        const validNiches = ['RELIGIOSO', 'POLITICA', 'EMAGRECIMENTO', 'MARKETING', 'OUTRO'];
        if (archetypeData.niche && !validNiches.includes(archetypeData.niche)) {
            errors.push(`niche deve ser um de: ${validNiches.join(', ')}`);
        }

        // Valid tones
        const validTones = ['pastoral', 'provocador', 'empatico', 'neutro', 'profissional'];
        if (archetypeData.tone && !validTones.includes(archetypeData.tone)) {
            errors.push(`tone deve ser um de: ${validTones.join(', ')}`);
        }

        // Check system_prompt doesn't contain forbidden terms
        if (archetypeData.system_prompt) {
            const prompt = archetypeData.system_prompt.toLowerCase();
            const forbiddenInPrompt = ['você é um bot', 'você é uma ia', 'sou um programa', 'fui programado'];
            for (const term of forbiddenInPrompt) {
                if (prompt.includes(term)) {
                    errors.push(`system_prompt não pode conter: "${term}"`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Merge user archetype with base template
     * Ensures immutable fields are always applied
     */
    static mergeWithBase(archetypeData) {
        const immutablePolicy = this.getImmutablePolicy();
        const nicheExclusions = this.getNicheExclusions(archetypeData.niche);

        // Start with user's policy or empty object
        const userPolicy = archetypeData.policy || {};

        // Merge forbidden words: immutable + user's additional
        const allForbiddenWords = [
            ...immutablePolicy.global_forbidden_words,
            ...(userPolicy.forbidden_words || [])
        ];

        // Merge stop rules: immutable + user's additional
        const allStopRules = [
            ...immutablePolicy.mandatory_stop_rules,
            ...(userPolicy.stop_rules || [])
        ];

        // Merge escalation rules: immutable + user's additional
        const allEscalationRules = [
            ...immutablePolicy.mandatory_escalation_rules,
            ...immutablePolicy.bot_suspicion_escalate,
            ...(userPolicy.escalation_rules || [])
        ];

        // Build final policy
        const finalPolicy = {
            // Immutable - CANNOT be overridden
            max_messages_in_row: immutablePolicy.max_messages_in_row,
            allow_links: immutablePolicy.allow_links,
            allow_price: immutablePolicy.allow_price,

            // Merged arrays
            forbidden_words: [...new Set(allForbiddenWords)],
            stop_rules: [...new Set(allStopRules)],
            escalation_rules: [...new Set(allEscalationRules)],

            // Niche exclusions for monotematic
            niche_exclusions: nicheExclusions,

            // User editable with defaults
            max_chars_per_message: userPolicy.max_chars_per_message || 400,
            delays: userPolicy.delays || { min: 15, max: 60 }
        };

        // Add safe_responses and handoff_message if provided
        if (userPolicy.safe_responses) {
            finalPolicy.safe_responses = userPolicy.safe_responses;
        }
        if (userPolicy.handoff_message) {
            finalPolicy.handoff_message = userPolicy.handoff_message;
        }

        return {
            ...archetypeData,
            policy: finalPolicy,
            _based_on_template: baseTemplate._version,
            _created_at: new Date().toISOString()
        };
    }

    /**
     * Get checklist for publishing an archetype
     */
    static getPublishChecklist() {
        return [
            { id: 'persona_name', label: 'Nome da persona definido', required: true },
            { id: 'system_prompt', label: 'Prompt de sistema criado', required: true },
            { id: 'niche', label: 'Nicho selecionado', required: true },
            { id: 'tone', label: 'Tom definido', required: true },
            { id: 'safe_responses', label: 'Respostas seguras configuradas', required: false },
            { id: 'handoff_message', label: 'Mensagem de handoff definida', required: false },
            { id: 'sandbox_tested', label: 'Testado no sandbox', required: true },
            { id: 'no_bot_leak', label: 'Verificado: não menciona IA/bot', required: true },
            { id: 'monotematic', label: 'Verificado: sem vocabulário cruzado', required: true }
        ];
    }
}

module.exports = ArchetypeValidator;
