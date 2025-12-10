// Group Search Module - Returns only WhatsApp links
const GroupSearch = {
    links: [],
    manualSearch: {},
    searching: false,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const searchBtn = document.getElementById('searchGroupsBtn');
        const searchInput = document.getElementById('groupSearchInput');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.search());
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.search();
            });
        }
    },

    async search() {
        const input = document.getElementById('groupSearchInput');
        const query = input?.value?.trim();

        if (!query || query.length < 2) {
            Toast.warning('Digite pelo menos 2 caracteres para buscar');
            return;
        }

        if (this.searching) return;
        this.searching = true;

        const btn = document.getElementById('searchGroupsBtn');
        const resultsContainer = document.getElementById('groupResults');
        const emptyState = document.getElementById('emptyGroupSearch');

        btn.disabled = true;
        btn.innerHTML = '<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> Buscando...';
        resultsContainer.innerHTML = '<div class="loading-groups"><div class="spinner"></div><p>Buscando links de grupos...</p></div>';
        emptyState?.classList.add('hidden');

        try {
            const result = await API.get(`/groups/search?q=${encodeURIComponent(query)}`);

            this.manualSearch = result.manualSearch || {};

            if (result.success && result.links && result.links.length > 0) {
                this.links = result.links;
                this.renderLinks(query);
                Toast.success(`${result.links.length} link(s) encontrado(s)!`);
            } else {
                this.renderNoResults(query);
            }
        } catch (err) {
            console.error('Search error:', err);
            Toast.error('Erro ao buscar grupos');
            resultsContainer.innerHTML = `
                <div class="no-results error">
                    <h3>Erro na busca</h3>
                    <p>Tente novamente em alguns segundos</p>
                </div>
            `;
        } finally {
            this.searching = false;
            btn.disabled = false;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> Buscar';
        }
    },

    renderLinks(query) {
        const container = document.getElementById('groupResults');

        let html = `<div class="links-header"><h3>🔗 ${this.links.length} link(s) de grupos encontrados para "${query}"</h3></div>`;

        html += '<div class="links-grid">';

        this.links.forEach((item, index) => {
            html += `
                <div class="link-card">
                    <div class="link-number">${index + 1}</div>
                    <div class="link-content">
                        <a href="${item.link}" target="_blank" class="link-url">${item.link}</a>
                    </div>
                    <div class="link-actions">
                        <a href="${item.link}" target="_blank" class="btn btn-primary btn-sm">Entrar</a>
                        <button class="btn btn-secondary btn-sm" onclick="GroupSearch.copyLink('${item.link}')">Copiar</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';

        container.innerHTML = html;
    },

    renderNoResults(query) {
        const container = document.getElementById('groupResults');

        let html = `
            <div class="no-results">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                </svg>
                <h3>Nenhum link encontrado automaticamente</h3>
                <p>Tente buscar manualmente clicando nos botões abaixo:</p>
                
                <div class="manual-search-buttons">
                    <a href="${this.manualSearch.google || '#'}" target="_blank" class="btn btn-primary">
                        🔍 Buscar no Google
                    </a>
                    <a href="${this.manualSearch.duckduckgo || '#'}" target="_blank" class="btn btn-secondary">
                        🦆 Buscar no DuckDuckGo
                    </a>
                    <a href="${this.manualSearch.facebook || '#'}" target="_blank" class="btn btn-secondary">
                        📘 Buscar no Facebook
                    </a>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    copyLink(link) {
        navigator.clipboard.writeText(link).then(() => {
            Toast.success('Link copiado!');
        }).catch(() => {
            Toast.error('Erro ao copiar');
        });
    }
};
