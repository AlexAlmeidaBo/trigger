// Agent Module with Archetypes
const Agent = {
    config: {
        enabled: false,
        selectedArchetypeId: null
    },
    archetypes: [],
    logs: [],

    init() {
        this.loadArchetypes();
        this.loadConfig();
        this.bindEvents();
    },

    bindEvents() {
        const toggle = document.getElementById('enableAgent');
        const saveBtn = document.getElementById('saveAgentConfig');
        const archetypeSelect = document.getElementById('archetypeSelect');

        if (toggle) {
            toggle.addEventListener('change', (e) => this.toggleAgent(e.target.checked));
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveConfig());
        }

        if (archetypeSelect) {
            archetypeSelect.addEventListener('change', (e) => this.showArchetypePreview(e.target.value));
        }
    },

    async loadArchetypes() {
        try {
            const result = await API.get('/archetypes');
            if (result.success) {
                this.archetypes = result.archetypes;
                this.renderArchetypeSelect();
            }
        } catch (err) {
            console.error('Error loading archetypes:', err);
            Toast.error('Erro ao carregar cerebros');
        }
    },

    renderArchetypeSelect() {
        const select = document.getElementById('archetypeSelect');
        if (!select) return;

        if (this.archetypes.length === 0) {
            select.innerHTML = '<option value="">Nenhum cerebro disponivel</option>';
            return;
        }

        select.innerHTML = `
            <option value="">Selecione um cerebro...</option>
            ${this.archetypes.map(a => `
                <option value="${a.id}" ${a.id === this.config.selectedArchetypeId ? 'selected' : ''}>
                    ${this.formatArchetypeName(a)}
                </option>
            `).join('')}
        `;

        // Show preview if one is selected
        if (this.config.selectedArchetypeId) {
            this.showArchetypePreview(this.config.selectedArchetypeId);
        }
    },

    formatArchetypeName(archetype) {
        const nicheEmoji = {
            'RELIGIOSO': '🙏',
            'POLITICA': '🏛️',
            'EMAGRECIMENTO': '💪'
        };
        return `${nicheEmoji[archetype.niche] || '🤖'} ${archetype.niche} - ${archetype.tone}`;
    },

    showArchetypePreview(archetypeId) {
        const preview = document.getElementById('archetypePreview');
        if (!preview) return;

        if (!archetypeId) {
            preview.style.display = 'none';
            return;
        }

        const archetype = this.archetypes.find(a => a.id == archetypeId);
        if (!archetype) {
            preview.style.display = 'none';
            return;
        }

        preview.style.display = 'block';

        // Update preview elements
        document.getElementById('archetypeNiche').textContent = archetype.niche;
        document.getElementById('archetypeTone').textContent = archetype.tone;
        document.getElementById('archetypeObjective').textContent = archetype.objective || 'Nao definido';

        const delays = archetype.policy?.delays || { min: 10, max: 30 };
        document.getElementById('archetypeDelay').textContent = `${delays.min}s - ${delays.max}s`;

        document.getElementById('archetypePrompt').textContent = archetype.system_prompt;

        this.config.selectedArchetypeId = parseInt(archetypeId);
    },

    async loadConfig() {
        try {
            const result = await API.get('/agent/config');
            if (result.success) {
                this.config.enabled = result.config.enabled;
                this.updateStatusUI();
            }
        } catch (err) {
            console.error('Error loading agent config:', err);
        }
    },

    updateStatusUI() {
        const toggle = document.getElementById('enableAgent');
        const statusDot = document.getElementById('agentStatusDot');
        const statusText = document.getElementById('agentStatus');

        if (toggle) toggle.checked = this.config.enabled;

        if (statusDot) {
            statusDot.classList.toggle('active', this.config.enabled);
            statusDot.classList.toggle('inactive', !this.config.enabled);
        }

        if (statusText) {
            statusText.textContent = this.config.enabled ? 'Ativo' : 'Desativado';
        }
    },

    async toggleAgent(enabled) {
        try {
            const result = await API.post('/agent/toggle', { enabled });
            if (result.success) {
                this.config.enabled = result.enabled;
                this.updateStatusUI();
                Toast.success(result.message);
            }
        } catch (err) {
            Toast.error('Erro ao alterar status do agente');
        }
    },

    async saveConfig() {
        const archetypeId = document.getElementById('archetypeSelect')?.value;

        if (!archetypeId) {
            Toast.warning('Selecione um cerebro primeiro');
            return;
        }

        try {
            // Save the archetype selection (for now just toggle on)
            const result = await API.post('/agent/toggle', { enabled: true });

            if (result.success) {
                this.config.enabled = true;
                this.updateStatusUI();
                Toast.success('Cerebro ativado com sucesso!');
            }
        } catch (err) {
            Toast.error('Erro ao ativar cerebro');
        }
    },

    async loadLogs() {
        try {
            const result = await API.get('/agent/logs');
            if (result.success) {
                this.logs = result.logs;
                this.renderLogs();
            }
        } catch (err) {
            console.error('Error loading logs:', err);
        }
    },

    renderLogs() {
        const container = document.getElementById('agentLogs');
        if (!container) return;

        if (this.logs.length === 0) {
            container.innerHTML = `
                <div class="empty-logs">
                    <p>Nenhuma conversa ainda</p>
                    <small>As conversas do bot aparecerao aqui em tempo real</small>
                </div>
            `;
            return;
        }

        container.innerHTML = this.logs.map(log => `
            <div class="agent-log-item">
                <div class="contact">📱 ${log.contactId}</div>
                ${log.messages.map(m => `
                    <div class="${m.role === 'user' ? 'message' : 'response'}">
                        ${m.role === 'user' ? '👤' : '🤖'} ${this.escapeHtml(m.content)}
                    </div>
                `).join('')}
                <div class="time">${new Date(log.lastUpdate).toLocaleString()}</div>
            </div>
        `).join('');
    },

    handleAgentReply(data) {
        console.log('Agent replied:', data);

        this.logs.unshift({
            contactId: data.contact,
            messages: [
                { role: 'user', content: data.message },
                { role: 'assistant', content: data.response }
            ],
            lastUpdate: data.timestamp,
            archetypeKey: data.archetypeKey
        });

        this.logs = this.logs.slice(0, 20);
        this.renderLogs();
        Toast.success(`Agente respondeu para ${data.contact}`);
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
