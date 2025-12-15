/**
 * Cockpit Operational Dashboard - Frontend Logic
 */

const Cockpit = {
    currentConversation: null,
    conversations: [],
    archetypes: [],
    tagPresets: [],

    // Initialize
    async init() {
        await this.loadArchetypes();
        await this.loadTagPresets();
        await this.loadInbox();
        await this.loadMetrics();
    },

    // Refresh all data
    async refresh() {
        await this.loadInbox();
        await this.loadMetrics();
        await this.loadAudit();
    },

    // Switch tabs
    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${tabId}`).classList.add('active');

        // Load data for specific tabs
        if (tabId === 'audit') this.loadAudit();
        if (tabId === 'metrics') this.loadMetrics();
    },

    // Load archetypes for filter dropdown
    async loadArchetypes() {
        try {
            const res = await fetch('/api/archetypes');
            const data = await res.json();
            if (data.success) {
                this.archetypes = data.archetypes;
                const select = document.getElementById('filterArchetype');
                this.archetypes.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = a.id;
                    opt.textContent = a.persona_name || a.key;
                    select.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Error loading archetypes:', e);
        }
    },

    // Load tag presets
    async loadTagPresets() {
        try {
            const res = await fetch('/api/conversations/tags/presets');
            const data = await res.json();
            if (data.success) {
                this.tagPresets = data.presets;
                const select = document.getElementById('filterTag');
                this.tagPresets.forEach(tag => {
                    const opt = document.createElement('option');
                    opt.value = tag;
                    opt.textContent = tag;
                    select.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Error loading tag presets:', e);
        }
    },

    // Load inbox with filters
    async loadInbox() {
        try {
            const status = document.getElementById('filterStatus').value;
            const sortBy = document.getElementById('filterSort').value;
            const archetypeId = document.getElementById('filterArchetype').value;
            const tag = document.getElementById('filterTag').value;

            let url = `/api/conversations/filter/inbox?sort_by=${sortBy}`;
            if (status !== 'ALL') url += `&status=${status}`;
            if (archetypeId) url += `&archetype_id=${archetypeId}`;
            if (tag) url += `&has_tag=${tag}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                this.conversations = data.conversations;
                this.renderInbox();
                document.getElementById('inboxCount').textContent = data.total;
            }
        } catch (e) {
            console.error('Error loading inbox:', e);
        }
    },

    // Render inbox table
    renderInbox() {
        const tbody = document.getElementById('inboxBody');

        if (this.conversations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma conversa encontrada</td></tr>';
            return;
        }

        tbody.innerHTML = this.conversations.map(conv => `
            <tr onclick="Cockpit.selectConversation(${conv.id})" style="cursor: pointer;">
                <td>
                    <span class="status-badge status-${conv.handoff_status}">
                        ${this.getStatusIcon(conv.handoff_status)} ${this.getStatusLabel(conv.handoff_status)}
                    </span>
                </td>
                <td>
                    <strong>${conv.contact_name || conv.contact_phone}</strong>
                    <br><small class="muted">${conv.contact_phone}</small>
                </td>
                <td>${conv.archetype?.persona_name || '-'}</td>
                <td>${this.renderTags(conv.tags)}</td>
                <td>
                    <span class="policy-reason">${conv.last_policy_reason || '-'}</span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); Cockpit.quickAction('take', ${conv.id})">Assumir</button>
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); Cockpit.quickAction('return', ${conv.id})">Devolver</button>
                </td>
            </tr>
        `).join('');
    },

    getStatusIcon(status) {
        const icons = { ESCALATED: '🔴', HUMAN_TAKEN: '🟡', NONE: '🟢' };
        return icons[status] || '⚪';
    },

    getStatusLabel(status) {
        const labels = { ESCALATED: 'Escalada', HUMAN_TAKEN: 'Assumida', NONE: 'Automático' };
        return labels[status] || status;
    },

    renderTags(tags) {
        if (!tags || tags.length === 0) return '-';
        return tags.map(tag => `<span class="tag-chip ${tag}">${tag}</span>`).join('');
    },

    // Quick actions from inbox
    async quickAction(action, id) {
        try {
            let url, method = 'POST', body = {};

            if (action === 'take') {
                url = `/api/conversations/${id}/take-over`;
            } else if (action === 'return') {
                url = `/api/conversations/${id}/return`;
            } else if (action === 'silence') {
                url = `/api/conversations/${id}/silence`;
                body = { silenced: true };
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (data.success) {
                this.loadInbox();
            }
        } catch (e) {
            console.error('Error performing action:', e);
        }
    },

    // Select conversation for detail view
    async selectConversation(id) {
        this.currentConversation = this.conversations.find(c => c.id === id);
        if (!this.currentConversation) return;

        // Switch to conversation tab
        this.switchTab('conversation');

        // Load conversation details
        try {
            const [detailRes, messagesRes, policyRes] = await Promise.all([
                fetch(`/api/conversations/${id}`),
                fetch(`/api/conversations/${id}/messages`),
                fetch(`/api/conversations/${id}/policy-log`)
            ]);

            const detail = await detailRes.json();
            const messages = await messagesRes.json();
            const policy = await policyRes.json();

            this.renderConversation(detail.conversation, messages.messages || [], policy.logs || []);
        } catch (e) {
            console.error('Error loading conversation:', e);
        }
    },

    // Render conversation detail
    renderConversation(conv, messages, policyLogs) {
        // Header
        document.getElementById('convHeader').innerHTML = `
            <span class="status-badge status-${conv.handoff_status}">
                ${this.getStatusIcon(conv.handoff_status)} ${this.getStatusLabel(conv.handoff_status)}
            </span>
            <strong style="margin-left: 12px;">${conv.contact_name || conv.contact_phone}</strong>
        `;

        // Messages
        const container = document.getElementById('messagesContainer');
        if (messages.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhuma mensagem no histórico</div>';
        } else {
            container.innerHTML = messages.map(msg => `
                <div class="message ${msg.status === 'sent' ? 'agent' : 'user'}">
                    <div class="message-content">${msg.message_content || msg.content}</div>
                    <div class="message-time">${new Date(msg.sent_at).toLocaleString('pt-BR')}</div>
                </div>
            `).join('');
            container.scrollTop = container.scrollHeight;
        }

        // Sidebar
        const sidebar = document.getElementById('convSidebar');
        let tags = [];
        try { tags = conv.tags ? JSON.parse(conv.tags) : []; } catch (e) { }

        sidebar.innerHTML = `
            <h3>Detalhes</h3>
            
            <div class="sidebar-section">
                <div class="sidebar-label">Status Handoff</div>
                <div class="sidebar-value">
                    <span class="status-badge status-${conv.handoff_status}">
                        ${this.getStatusLabel(conv.handoff_status)}
                    </span>
                </div>
            </div>
            
            <div class="sidebar-section">
                <div class="sidebar-label">Tags</div>
                <div class="sidebar-value">${tags.length > 0 ? tags.map(t => `<span class="tag-chip">${t}</span>`).join('') : '-'}</div>
                <button class="btn btn-sm btn-secondary" style="margin-top: 8px;" onclick="Cockpit.addTag()">+ Adicionar Tag</button>
            </div>
            
            <div class="sidebar-section">
                <div class="sidebar-label">Cérebro</div>
                <div class="sidebar-value">${conv.archetype?.persona_name || '-'}</div>
            </div>
            
            <div class="sidebar-section">
                <div class="sidebar-label">Campanha</div>
                <div class="sidebar-value">${conv.campaign_id || '-'}</div>
            </div>
            
            <div class="sidebar-section">
                <div class="sidebar-label">Policy Log (Últimos 10)</div>
                <div class="reasons-list">
                    ${policyLogs.slice(-10).reverse().map(log => `
                        <div class="reason-item">
                            <span>${log.action}</span>
                            <span class="reason-count">${log.reason}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Show actions
        document.getElementById('convActions').style.display = 'flex';
    },

    // Conversation actions
    async takeOver() {
        if (!this.currentConversation) return;
        await this.quickAction('take', this.currentConversation.id);
        await this.selectConversation(this.currentConversation.id);
    },

    async returnToAgent() {
        if (!this.currentConversation) return;
        await this.quickAction('return', this.currentConversation.id);
        await this.selectConversation(this.currentConversation.id);
    },

    async silenceConversation() {
        if (!this.currentConversation) return;
        await this.quickAction('silence', this.currentConversation.id);
        await this.selectConversation(this.currentConversation.id);
    },

    async addTag() {
        if (!this.currentConversation) return;
        const tag = prompt('Adicionar tag:', 'LEAD_QUENTE');
        if (!tag) return;

        try {
            let tags = [];
            try { tags = this.currentConversation.tags || []; } catch (e) { }
            if (!tags.includes(tag)) tags.push(tag);

            await fetch(`/api/conversations/${this.currentConversation.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags })
            });

            await this.selectConversation(this.currentConversation.id);
        } catch (e) {
            console.error('Error adding tag:', e);
        }
    },

    // Load audit logs
    async loadAudit() {
        try {
            const action = document.getElementById('auditAction')?.value || '';
            const reason = document.getElementById('auditReason')?.value || '';

            let url = '/api/audit/logs?limit=100';
            if (action) url += `&action=${action}`;
            if (reason) url += `&reason=${reason}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                this.renderAudit(data.logs);
            }
        } catch (e) {
            console.error('Error loading audit:', e);
        }
    },

    renderAudit(logs) {
        const tbody = document.getElementById('auditBody');

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum log encontrado</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                <td><span class="tag-chip ${log.action}">${log.action}</span></td>
                <td><span class="policy-reason">${log.reason}</span></td>
                <td>${log.contact_name || log.contact_phone}</td>
                <td>${log.conversation_id}</td>
            </tr>
        `).join('');
    },

    // Export logs
    exportLogs() {
        window.open('/api/audit/logs/export', '_blank');
    },

    // Load metrics
    async loadMetrics() {
        try {
            const res = await fetch('/api/conversations/metrics/advanced');
            const data = await res.json();

            if (data.success) {
                const m = data.metrics;

                document.getElementById('metricTotal').textContent = m.total;
                document.getElementById('metricEscalated').textContent = m.byStatus.ESCALATED || 0;
                document.getElementById('metricHuman').textContent = m.byStatus.HUMAN_TAKEN || 0;
                document.getElementById('metricActive').textContent = m.byStatus.NONE || 0;

                document.getElementById('stopRate').textContent = m.stopRate + '%';
                document.getElementById('blockRate').textContent = m.blockRate + '%';
                document.getElementById('escalateRate').textContent = m.escalateRate + '%';

                // Top reasons
                const reasonsDiv = document.getElementById('topReasons');
                if (m.topReasons && m.topReasons.length > 0) {
                    reasonsDiv.innerHTML = m.topReasons.map(r => `
                        <div class="reason-item">
                            <span class="policy-reason">${r.reason}</span>
                            <span class="reason-count">${r.count}</span>
                        </div>
                    `).join('');
                } else {
                    reasonsDiv.innerHTML = '<div class="empty-state">Nenhuma razão registrada</div>';
                }
            }
        } catch (e) {
            console.error('Error loading metrics:', e);
        }
    }
};
