// Reports Module
const Reports = {
    init() {
        this.loadStats();
    },

    async loadStats() {
        try {
            // Load general stats
            const statsResult = await API.get('/reports/stats');
            if (statsResult.success) {
                this.updateStatsCards(statsResult.stats);
            }

            // Load campaigns
            const campaignsResult = await API.get('/reports/campaigns');
            if (campaignsResult.success) {
                this.renderCampaigns(campaignsResult.campaigns);
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    },

    updateStatsCards(stats) {
        document.getElementById('statContacts').textContent = stats.totalContacts || 0;
        document.getElementById('statCampaigns').textContent = stats.totalCampaigns || 0;
        document.getElementById('statSent').textContent = stats.totalSent || 0;
        document.getElementById('statFailed').textContent = stats.totalFailed || 0;
    },

    renderCampaigns(campaigns) {
        const tbody = document.getElementById('campaignsTableBody');
        const emptyState = document.getElementById('emptyCampaigns');

        if (campaigns.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        tbody.innerHTML = campaigns.map(campaign => {
            const statusClass = campaign.status;
            const statusLabel = this.getStatusLabel(campaign.status);
            const date = new Date(campaign.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <tr>
                    <td><strong>${campaign.name}</strong></td>
                    <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                    <td>${campaign.sent_count || 0}</td>
                    <td>${campaign.failed_count || 0}</td>
                    <td>${campaign.successRate || 0}%</td>
                    <td>${date}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="Reports.viewDetails(${campaign.id})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                        <a class="btn btn-secondary btn-sm" href="/api/reports/export/${campaign.id}" download>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </a>
                    </td>
                </tr>
            `;
        }).join('');
    },

    getStatusLabel(status) {
        const labels = {
            pending: 'Pendente',
            running: 'Em andamento',
            completed: 'Concluída',
            stopped: 'Interrompida',
            failed: 'Falhou'
        };
        return labels[status] || status;
    },

    async viewDetails(campaignId) {
        try {
            const result = await API.get(`/reports/campaigns/${campaignId}`);

            if (result.success) {
                this.showDetailsModal(result.campaign, result.logs, result.summary);
            }
        } catch (err) {
            Toast.error('Erro ao carregar detalhes');
        }
    },

    showDetailsModal(campaign, logs, summary) {
        // Create modal dynamically
        const existingModal = document.getElementById('detailsModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'detailsModal';
        modal.className = 'modal';

        modal.innerHTML = `
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3>${campaign.name}</h3>
                    <button class="modal-close" onclick="document.getElementById('detailsModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="stats-grid" style="margin-bottom: 20px;">
                        <div class="stat-card">
                            <div class="stat-info">
                                <span class="stat-value" style="color: var(--primary);">${summary.sent}</span>
                                <span class="stat-label">Enviadas</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-info">
                                <span class="stat-value" style="color: var(--danger);">${summary.failed}</span>
                                <span class="stat-label">Falhas</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-info">
                                <span class="stat-value" style="color: var(--text-muted);">${summary.pending}</span>
                                <span class="stat-label">Pendentes</span>
                            </div>
                        </div>
                    </div>
                    
                    <h4 style="margin-bottom: 12px;">Log de Envios</h4>
                    <div class="contacts-table-wrapper" style="max-height: 300px;">
                        <table class="contacts-table">
                            <thead>
                                <tr>
                                    <th>Contato</th>
                                    <th>Telefone</th>
                                    <th>Status</th>
                                    <th>Erro</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${logs.map(log => `
                                    <tr>
                                        <td>${log.contact_name || '-'}</td>
                                        <td>${log.contact_phone || '-'}</td>
                                        <td><span class="status-badge ${log.status}">${this.getStatusLabel(log.status)}</span></td>
                                        <td>${log.error_message || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
};
