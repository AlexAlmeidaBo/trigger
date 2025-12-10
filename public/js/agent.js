// Agent Module
const Agent = {
    config: {
        enabled: false,
        prompt: ''
    },
    logs: [],

    init() {
        this.loadConfig();
        this.bindEvents();
    },

    bindEvents() {
        const toggle = document.getElementById('enableAgent');
        const saveBtn = document.getElementById('saveAgentConfig');

        if (toggle) {
            toggle.addEventListener('change', (e) => this.toggleAgent(e.target.checked));
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveConfig());
        }
    },

    async loadConfig() {
        try {
            const result = await API.get('/agent/config');
            if (result.success) {
                this.config = result.config;
                this.updateUI();
            }
        } catch (err) {
            console.error('Error loading agent config:', err);
        }
    },

    updateUI() {
        const toggle = document.getElementById('enableAgent');
        const promptInput = document.getElementById('agentPrompt');

        if (toggle) toggle.checked = this.config.enabled;
        if (promptInput) promptInput.value = this.config.prompt || '';
    },

    async toggleAgent(enabled) {
        try {
            const result = await API.post('/agent/toggle', { enabled });
            if (result.success) {
                this.config.enabled = result.enabled;
                Toast.success(result.message);
            }
        } catch (err) {
            Toast.error('Erro ao alterar status do agente');
        }
    },

    async saveConfig() {
        const prompt = document.getElementById('agentPrompt')?.value?.trim();

        if (!prompt) {
            Toast.warning('Digite as instruções do agente');
            return;
        }

        try {
            const result = await API.post('/agent/config', {
                enabled: this.config.enabled,
                prompt
            });

            if (result.success) {
                this.config = result.config;
                Toast.success('Configuração salva!');
            }
        } catch (err) {
            Toast.error('Erro ao salvar configuração');
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
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <h3>Nenhuma conversa ainda</h3>
                    <p>Quando o agente responder mensagens, elas aparecerão aqui</p>
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

    // Called when agent reply comes through WebSocket
    handleAgentReply(data) {
        console.log('Agent replied:', data);

        // Add to logs
        this.logs.unshift({
            contactId: data.contact,
            messages: [
                { role: 'user', content: data.message },
                { role: 'assistant', content: data.response }
            ],
            lastUpdate: data.timestamp
        });

        // Keep only 20 logs
        this.logs = this.logs.slice(0, 20);
        this.renderLogs();

        // Show toast
        Toast.success(`Agente respondeu para ${data.contact}`);
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
