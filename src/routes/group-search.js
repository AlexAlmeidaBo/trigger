const express = require('express');
const router = express.Router();
const axios = require('axios');

// SerpAPI configuration
// Get your free API key at: https://serpapi.com (100 free searches/month)
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';

// Search groups - returns WhatsApp invite links
router.get('/search', async (req, res) => {
    try {
        const { q, num = 10 } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Palavra-chave deve ter pelo menos 2 caracteres'
            });
        }

        const keyword = q.trim();
        const limit = Math.min(parseInt(num) || 10, 30);

        console.log(`Searching for: "${keyword}" limit: ${limit}`);

        let links = [];

        // Use SerpAPI if key is configured
        if (SERPAPI_KEY) {
            links = await searchWithSerpAPI(keyword, limit);
        } else {
            console.log('SERPAPI_KEY not configured, using fallback');
            links = await searchFallback(keyword, limit);
        }

        console.log('Found links:', links.length);

        // Build manual search URL
        const googleSearchUrl = `https://www.google.com/search?q="${encodeURIComponent(keyword)}"+https://chat.whatsapp.com`;

        res.json({
            success: true,
            links,
            query: keyword,
            googleSearchUrl,
            usingSerpAPI: !!SERPAPI_KEY,
            message: links.length > 0
                ? `${links.length} link(s) encontrado(s)`
                : 'Nenhum link encontrado. Use o botão para buscar manualmente.'
        });
    } catch (err) {
        console.error('Error searching groups:', err.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar grupos'
        });
    }
});

// Search using SerpAPI (Google Search API)
async function searchWithSerpAPI(keyword, limit) {
    const links = new Set();

    // Query format: "keyword" https://chat.whatsapp.com
    const query = `"${keyword}" https://chat.whatsapp.com`;

    console.log('SerpAPI query:', query);

    try {
        const response = await axios.get('https://serpapi.com/search', {
            params: {
                api_key: SERPAPI_KEY,
                q: query,
                engine: 'google',
                num: 30, // Get more results to filter
                hl: 'pt-BR',
                gl: 'br'
            },
            timeout: 30000
        });

        const data = response.data;

        // Extract links from organic results
        if (data.organic_results) {
            data.organic_results.forEach(result => {
                // Check URL
                const urlMatch = result.link?.match(/https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{15,25}/);
                if (urlMatch) {
                    links.add(urlMatch[0]);
                }

                // Check snippet
                const snippetMatch = result.snippet?.match(/https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{15,25}/g);
                if (snippetMatch) {
                    snippetMatch.forEach(link => links.add(link));
                }

                // Check displayed link
                const displayMatch = result.displayed_link?.match(/https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{15,25}/);
                if (displayMatch) {
                    links.add(displayMatch[0]);
                }
            });
        }

        // Also check inline links if present
        if (data.inline_links) {
            data.inline_links.forEach(item => {
                const match = item.link?.match(/https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{15,25}/);
                if (match) links.add(match[0]);
            });
        }

        console.log('SerpAPI found:', links.size, 'links');

    } catch (err) {
        console.error('SerpAPI error:', err.response?.data?.error || err.message);

        // If SerpAPI fails, try fallback
        if (links.size === 0) {
            return await searchFallback(keyword, limit);
        }
    }

    return Array.from(links).slice(0, limit).map((link, i) => ({
        id: i + 1,
        link
    }));
}

// Fallback search using Bing (when SerpAPI is not available)
async function searchFallback(keyword, limit) {
    const links = new Set();
    const query = encodeURIComponent(`"${keyword}" https://chat.whatsapp.com`);

    try {
        // Try Bing
        const bingUrl = `https://www.bing.com/search?q=${query}&count=50`;
        const response = await axios.get(bingUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html'
            },
            timeout: 15000
        });

        // Extract WhatsApp links from page text
        const matches = response.data.match(/https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{15,25}/g) || [];
        matches.forEach(link => links.add(link));

        console.log('Fallback (Bing) found:', links.size, 'links');

    } catch (err) {
        console.error('Fallback search error:', err.message);
    }

    return Array.from(links).slice(0, limit).map((link, i) => ({
        id: i + 1,
        link
    }));
}

module.exports = router;
