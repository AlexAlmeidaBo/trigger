const OpenAI = require('openai');
const db = require('./database');

class AIVariations {
    constructor() {
        // OpenAI API configuration - use environment variable
        this.apiKey = process.env.OPENAI_API_KEY || null;
        this.model = 'gpt-4o-mini'; // Using gpt-4o-mini which is fast and cheap

        this.openai = this.apiKey ? new OpenAI({
            apiKey: this.apiKey
        }) : null;

        // Rate limiting and caching
        this.lastApiCall = 0;
        this.minApiInterval = 1000; // 1 second between API calls
        this.memoryCache = new Map();
        this.apiFailures = 0;
        this.maxApiFailures = 5;
    }

    getPromptByLevel(level, message) {
        const prompts = {
            low: `Você é um assistente que reescreve mensagens de marketing para WhatsApp.
Reescreva a seguinte mensagem de forma ligeiramente diferente, mantendo o mesmo significado e tom.
Faça apenas pequenas alterações nas palavras, mantendo a estrutura similar.
Gere exatamente 3 variações.
IMPORTANTE: Mantenha as variáveis entre colchetes como [nome], [produto], etc. exatamente como estão.

Mensagem original:
"${message}"

Responda APENAS com as variações, uma por linha, sem numeração, sem aspas, sem explicações.`,

            medium: `Você é um assistente que reescreve mensagens de marketing para WhatsApp.
Reescreva a seguinte mensagem de 4 formas diferentes, mantendo a mesma intenção mas variando o estilo e vocabulário.
Você pode reorganizar a frase e usar sinônimos.
IMPORTANTE: Mantenha as variáveis entre colchetes como [nome], [produto], etc. exatamente como estão.

Mensagem original:
"${message}"

Responda APENAS com as variações, uma por linha, sem numeração, sem aspas, sem explicações.`,

            high: `Você é um assistente criativo que reescreve mensagens de marketing para WhatsApp.
Crie 5 versões completamente diferentes da seguinte mensagem, mantendo apenas a intenção principal.
Seja criativo com a estrutura, tom e vocabulário.
Algumas podem ser mais formais, outras mais casuais.
IMPORTANTE: Mantenha as variáveis entre colchetes como [nome], [produto], etc. exatamente como estão.

Mensagem original:
"${message}"

Responda APENAS com as variações, uma por linha, sem numeração, sem aspas, sem explicações.`
        };

        return prompts[level] || prompts.medium;
    }

    async generateVariations(message, level = 'medium') {
        // Create cache key
        const cacheKey = `${message}_${level}`;

        // Check memory cache first (fastest)
        if (this.memoryCache.has(cacheKey)) {
            console.log('Returning from memory cache');
            return this.memoryCache.get(cacheKey);
        }

        // Check if we've had too many failures - use simulated only
        if (this.apiFailures >= this.maxApiFailures) {
            console.log('Too many API failures, using simulated variations');
            return this.generateSimulatedVariations(message, level);
        }

        if (!this.openai) {
            console.log('No API key configured, using simulated variations');
            return this.generateSimulatedVariations(message, level);
        }

        // Check database cache
        try {
            if (db.ready) {
                const cached = db.getCachedVariations(message, level);
                if (cached) {
                    console.log('Returning cached variations from DB');
                    const variations = JSON.parse(cached.variations);
                    this.memoryCache.set(cacheKey, variations);
                    return variations;
                }
            }
        } catch (err) {
            console.log('Cache check failed:', err.message);
        }

        // Rate limiting
        const now = Date.now();
        const timeSinceLastCall = now - this.lastApiCall;
        if (timeSinceLastCall < this.minApiInterval) {
            console.log('Rate limiting - using simulated variations');
            return this.generateSimulatedVariations(message, level);
        }
        this.lastApiCall = now;

        try {
            console.log('Calling OpenAI API for variations...');
            const prompt = this.getPromptByLevel(level, message);

            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'Você é um assistente especializado em reescrever mensagens de marketing para WhatsApp. Sempre preserve variáveis entre colchetes.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: level === 'low' ? 0.4 : level === 'high' ? 0.9 : 0.7,
                max_tokens: 1024
            });

            const text = response.choices[0]?.message?.content || '';
            console.log('OpenAI API response received');
            console.log('Raw AI response:', text);

            // Parse variations - clean up the response
            const variations = text
                .split('\n')
                .map(v => v.trim())
                .map(v => v.replace(/^["']|["']$/g, '')) // Remove quotes
                .map(v => v.replace(/^\d+[\.\)]\s*/, '')) // Remove numbering
                .map(v => v.replace(/^[-•]\s*/, '')) // Remove bullet points
                .filter(v => v.length > 10); // Only keep substantial variations

            console.log('Parsed variations:', variations);

            // Cache the results in memory and DB
            if (variations.length > 0) {
                this.memoryCache.set(cacheKey, variations);
                this.apiFailures = 0; // Reset failure counter on success

                if (db.ready) {
                    try {
                        db.cacheVariations(message, level, variations);
                    } catch (err) {
                        console.log('Cache save failed:', err.message);
                    }
                }
            }

            return variations.length > 0 ? variations : this.generateSimulatedVariations(message, level);
        } catch (err) {
            console.error('OpenAI API error:', err.message);
            this.apiFailures++;
            console.log(`API failure count: ${this.apiFailures}/${this.maxApiFailures}`);
            return this.generateSimulatedVariations(message, level);
        }
    }

    // Fallback when API fails - improved version that always generates variations
    generateSimulatedVariations(message, level) {
        console.log('Using simulated variations for message:', message);
        const variations = [];
        const count = level === 'low' ? 3 : level === 'high' ? 5 : 4;

        // Word replacements dictionary (expanded)
        const replacements = {
            'Olá': ['Oi', 'Oie', 'E aí', 'Hey'],
            'olá': ['oi', 'oie', 'e aí', 'hey'],
            'Oi': ['Olá', 'Oie', 'E aí', 'Hey'],
            'oi': ['olá', 'oie', 'e aí', 'hey'],
            'promoção': ['oferta', 'desconto', 'oportunidade', 'condição especial'],
            'especial': ['exclusiva', 'incrível', 'imperdível', 'única'],
            'Confira': ['Veja', 'Aproveite', 'Não perca', 'Descubra'],
            'confira': ['veja', 'aproveite', 'não perca', 'descubra'],
            'para você': ['pra você', 'especialmente para você', 'só para você'],
            'Temos': ['Preparamos', 'Trouxemos', 'Temos aqui'],
            'temos': ['preparamos', 'trouxemos', 'temos aqui'],
            'Bom dia': ['Olá', 'Oi', 'Oie'],
            'Boa tarde': ['Olá', 'Oi', 'Oie'],
            'Boa noite': ['Olá', 'Oi', 'Oie'],
            'teste': ['test', 'verificação', 'checagem'],
            'mensagem': ['msg', 'texto', 'comunicação'],
            'testar': ['verificar', 'checar', 'validar'],
            'bot': ['robô', 'assistente', 'sistema']
        };

        // Prefixes to add variation
        const prefixes = ['', '👋 ', '✨ ', '📢 ', '💬 ', '🔔 '];

        // Suffixes to add variation
        const suffixes = ['', ' 😊', ' 👍', ' ✅', ' 💪', '!'];

        for (let i = 0; i < count; i++) {
            let variation = message;
            let changed = false;

            // Try word replacements
            Object.entries(replacements).forEach(([original, options]) => {
                if (variation.includes(original)) {
                    const replacement = options[Math.floor(Math.random() * options.length)];
                    variation = variation.replace(original, replacement);
                    changed = true;
                }
            });

            // If no word replacements worked, add prefix/suffix variations
            if (!changed || i > 0) {
                const prefix = prefixes[i % prefixes.length];
                const suffix = suffixes[i % suffixes.length];

                // Also vary punctuation
                if (variation.endsWith('!')) {
                    variation = variation.slice(0, -1) + '.';
                } else if (variation.endsWith('.')) {
                    variation = variation.slice(0, -1) + '!';
                }

                variation = prefix + variation + suffix;
            }

            // Ensure we don't add duplicates
            if (!variations.includes(variation) && variation !== message) {
                variations.push(variation);
            }
        }

        // Always ensure we have at least some variations
        if (variations.length === 0) {
            // Force create variations with different prefixes/suffixes
            variations.push('👋 ' + message);
            variations.push(message + ' 😊');
            variations.push('✨ ' + message + '!');
        }

        console.log('Generated simulated variations:', variations);
        return variations;
    }

    // Apply variables to message
    applyVariables(message, contact) {
        if (!message) return message;

        const name = contact?.name || 'Cliente';
        const phone = contact?.phone || '';

        return message
            .replace(/\[nome\]/gi, name)
            .replace(/\[telefone\]/gi, phone)
            .replace(/\[Nome\]/g, name)
            .replace(/\[NOME\]/g, name.toUpperCase());
    }

    // Get random variation
    async getRandomVariation(message, level = 'medium', contact = null) {
        if (level === 'none') {
            return contact ? this.applyVariables(message, contact) : message;
        }

        const variations = await this.generateVariations(message, level);
        const randomIndex = Math.floor(Math.random() * variations.length);
        const variation = variations[randomIndex] || message;

        return contact ? this.applyVariables(variation, contact) : variation;
    }
}

module.exports = new AIVariations();
