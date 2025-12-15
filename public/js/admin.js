/**
 * Admin Dashboard - Frontend Logic
 */

const Admin = {
    // State
    refreshInterval: null,

    // Initialize
    async init() {
        await this.loadOverview();
        await this.loadPlans();
        await this.loadLogs();
        await this.loadActiveMonitor();

        // Update timestamp
        this.updateTimestamp();

        // Auto-refresh every 30 seconds
        this.refreshInterval = setInterval(() => this.refresh(), 30000);
    },

    // Refresh all data
    async refresh() {
        await this.loadOverview();
        await this.loadPlans();
        await this.loadLogs();
        await this.loadActiveMonitor();
        this.updateTimestamp();
    },

    // Update last update timestamp
    updateTimestamp() {
        document.getElementById('lastUpdate').textContent =
            `Última atualização: ${new Date().toLocaleTimeString('pt-BR')}`;
    },

    // Load system overview
    async loadOverview() {
        try {
            // Get metrics from various endpoints
            const [metricsRes, archetypesRes] = await Promise.all([
                fetch('/api/conversations/metrics/advanced'),
                fetch('/api/archetypes')
            ]);

            const metrics = await metricsRes.json();
            const archetypes = await archetypesRes.json();

            if (metrics.success) {
                document.getElementById('totalConversations').textContent = metrics.metrics.total || 0;
                document.getElementById('escalatedCount').textContent = metrics.metrics.byStatus?.ESCALATED || 0;
            }

            if (archetypes.success) {
                document.getElementById('totalArchetypes').textContent = archetypes.archetypes?.length || 0;
            }

            // Get campaigns and messages count
            try {
                const campaignsRes = await fetch('/api/campaigns');
                const campaigns = await campaignsRes.json();
                document.getElementById('totalCampaigns').textContent = campaigns.campaigns?.length || 0;
            } catch (e) {
                document.getElementById('totalCampaigns').textContent = '-';
            }

            // Estimate messages today (from reports if available)
            try {
                const reportsRes = await fetch('/api/reports/today');
                const reports = await reportsRes.json();
                document.getElementById('totalMessages').textContent = reports.sent || 0;
            } catch (e) {
                document.getElementById('totalMessages').textContent = '-';
            }

            // Users count (estimate from subscriptions if available)
            document.getElementById('totalUsers').textContent = '-';

        } catch (e) {
            console.error('Error loading overview:', e);
        }
    },

    // Load plans distribution
    async loadPlans() {
        try {
            const res = await fetch('/api/admin/plans-distribution');
            const data = await res.json();

            if (data.success) {
                document.getElementById('freeUsers').textContent = data.distribution?.FREE || 0;
                document.getElementById('mensalUsers').textContent = data.distribution?.MENSAL || 0;
                document.getElementById('vitalicioUsers').textContent = data.distribution?.VITALICIO || 0;

                // Calculate MRR
                const mensalCount = data.distribution?.MENSAL || 0;
                const vitalicioCount = data.distribution?.VITALICIO || 0;

                document.getElementById('mensalMrr').textContent =
                    `R$ ${(mensalCount * 27.90).toFixed(2).replace('.', ',')}`;
                document.getElementById('vitalicioTotal').textContent =
                    `R$ ${(vitalicioCount * 299).toFixed(2).replace('.', ',')}`;
            }
        } catch (e) {
            // Fallback - set to 0
            document.getElementById('freeUsers').textContent = '0';
            document.getElementById('mensalUsers').textContent = '0';
            document.getElementById('vitalicioUsers').textContent = '0';
        }
    },

    // Load policy logs
    async loadLogs() {
        try {
            const res = await fetch('/api/audit/logs?limit=20');
            const data = await res.json();

            const tbody = document.getElementById('logsBody');

            if (!data.success || !data.logs || data.logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum log encontrado</td></tr>';
                return;
            }

            tbody.innerHTML = data.logs.map(log => `
                <tr>
                    <td>${new Date(log.timestamp).toLocaleTimeString('pt-BR')}</td>
                    <td><span class="action-badge ${log.action}">${log.action}</span></td>
                    <td>${log.reason || '-'}</td>
                    <td>#${log.conversation_id}</td>
                </tr>
            `).join('');

        } catch (e) {
            console.error('Error loading logs:', e);
        }
    },

    // Load active conversations monitor
    async loadActiveMonitor() {
        try {
            const res = await fetch('/api/conversations/filter/inbox?status=ESCALATED&status=HUMAN_TAKEN');
            const data = await res.json();

            const container = document.getElementById('activeMonitor');

            if (!data.success || !data.conversations || data.conversations.length === 0) {
                container.innerHTML = '<div class="empty-state">Nenhuma conversa ativa no momento</div>';
                return;
            }

            container.innerHTML = data.conversations.slice(0, 12).map(conv => `
                <div class="monitor-item ${conv.handoff_status === 'ESCALATED' ? 'escalated' : 'human'}">
                    <span class="monitor-status">${conv.handoff_status === 'ESCALATED' ? '🔴' : '🟡'}</span>
                    <div class="monitor-info">
                        <div class="monitor-name">${conv.contact_name || conv.contact_phone}</div>
                        <div class="monitor-last">${conv.archetype?.persona_name || 'Sem cérebro'}</div>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            console.error('Error loading monitor:', e);
        }
    },

    // Quick Actions
    async reseedArchetypes() {
        if (!confirm('Recriar todos os cérebros padrão?')) return;

        try {
            const res = await fetch('/api/archetypes/reseed', { method: 'POST' });
            const data = await res.json();
            alert(data.success ? 'Cérebros recriados!' : 'Erro: ' + data.error);
            this.refresh();
        } catch (e) {
            alert('Erro ao recriar cérebros');
        }
    },

    async clearRateLimits() {
        if (!confirm('Limpar todos os rate limits?')) return;

        try {
            const res = await fetch('/api/admin/clear-rate-limits', { method: 'POST' });
            const data = await res.json();
            alert(data.success ? 'Rate limits limpos!' : 'Erro: ' + data.error);
        } catch (e) {
            alert('Erro ao limpar rate limits');
        }
    },

    exportAllLogs() {
        window.open('/api/audit/logs/export', '_blank');
    },

    async pauseAllAgents() {
        if (!confirm('⚠️ PAUSAR TODOS OS AGENTES?')) return;

        try {
            const res = await fetch('/api/admin/pause-all', { method: 'POST' });
            const data = await res.json();
            alert(data.success ? 'Todos os agentes pausados!' : 'Erro: ' + data.error);
        } catch (e) {
            alert('Erro ao pausar agentes');
        }
    },

    async resumeAllAgents() {
        if (!confirm('Retomar todos os agentes?')) return;

        try {
            const res = await fetch('/api/admin/resume-all', { method: 'POST' });
            const data = await res.json();
            alert(data.success ? 'Todos os agentes retomados!' : 'Erro: ' + data.error);
        } catch (e) {
            alert('Erro ao retomar agentes');
        }
    },

    async clearDatabase() {
        if (!confirm('⚠️ ATENÇÃO: Isso vai APAGAR todos os dados! Continuar?')) return;
        if (!confirm('TEM CERTEZA ABSOLUTA? Esta ação é IRREVERSÍVEL!')) return;

        try {
            const res = await fetch('/api/admin/clear-database', { method: 'POST' });
            const data = await res.json();
            alert(data.success ? 'Database limpo!' : 'Erro: ' + data.error);
            this.refresh();
        } catch (e) {
            alert('Erro ao limpar database');
        }
    }
};
