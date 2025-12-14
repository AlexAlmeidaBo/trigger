// Campaigns Module
const Campaigns = {
    selectedContacts: [],
    activeCampaignId: null,
    sentCount: 0,
    failedCount: 0,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Select contacts
        document.getElementById('selectContactsBtn').addEventListener('click', () => this.showContactModal());
        document.getElementById('closeContactModal').addEventListener('click', () => this.hideContactModal());
        document.getElementById('cancelContactSelect').addEventListener('click', () => this.hideContactModal());
        document.getElementById('confirmContactSelect').addEventListener('click', () => this.confirmContactSelection());

        // Campaign actions
        document.getElementById('startCampaignBtn').addEventListener('click', () => this.startCampaign());
        document.getElementById('stopCampaignBtn').addEventListener('click', () => this.stopCampaign());
    },

    updateUI() {
        // Update message preview
        const message = Messages.getMessage();
        const previewEl = document.getElementById('campaignMessagePreview');

        if (message) {
            previewEl.innerHTML = message.replace(/\n/g, '<br>');
        } else {
            previewEl.innerHTML = '<p class="preview-placeholder">Configure a mensagem na seção "Mensagens"</p>';
        }

        // Update selected contacts count
        document.querySelector('#selectedContactsSummary .count').textContent = this.selectedContacts.length;
    },

    showContactModal() {
        const modal = document.getElementById('contactSelectModal');
        const listEl = document.getElementById('modalContactsList');
        const footer = modal.querySelector('.modal-footer');

        if (Contacts.contacts.length === 0) {
            Toast.warning('Importe contatos primeiro');
            return;
        }

        modal.classList.remove('hidden');

        // Update footer with selection controls
        footer.className = 'modal-footer modal-footer-actions';
        footer.innerHTML = `
            <div class="footer-left">
                <button class="btn btn-select-all" onclick="Campaigns.selectAllContacts()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
                    Todos
                </button>
                <button class="btn btn-clear" onclick="Campaigns.clearContactSelection()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Limpar
                </button>
                <div class="selection-count" id="modalSelectedCount">
                    <span class="count-number">${this.selectedContacts.length}</span> de ${Contacts.contacts.length}
                </div>
            </div>
            <div class="footer-right">
                <button class="btn btn-secondary" id="cancelContactSelect">Cancelar</button>
                <button class="btn btn-primary" id="confirmContactSelect">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Confirmar
                </button>
            </div>
        `;

        // Re-bind events for the new buttons
        footer.querySelector('#cancelContactSelect').addEventListener('click', () => this.hideContactModal());
        footer.querySelector('#confirmContactSelect').addEventListener('click', () => this.confirmContactSelection());

        // Helper function to get contact initials
        const getInitials = (name, phone) => {
            if (name && name !== phone) {
                const parts = name.trim().split(' ');
                if (parts.length >= 2) {
                    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                }
                return name.substring(0, 2).toUpperCase();
            }
            return phone ? phone.slice(-2) : '??';
        };

        // Build contact cards only (no header actions)
        const contactsHtml = Contacts.contacts.map(contact => `
            <label class="modal-contact-item">
                <input type="checkbox" 
                       class="modal-contact-cb" 
                       data-id="${contact.id}"
                       onchange="Campaigns.updateModalCount()"
                       ${this.selectedContacts.includes(contact.id) ? 'checked' : ''}>
                <div class="contact-avatar">${getInitials(contact.name, contact.phone)}</div>
                <div class="contact-info">
                    <strong>${contact.name || contact.phone}</strong>
                    <small>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        ${Contacts.formatPhone(contact.phone)}
                    </small>
                </div>
            </label>
        `).join('');

        listEl.innerHTML = contactsHtml;
    },

    selectAllContacts() {
        document.querySelectorAll('.modal-contact-cb').forEach(cb => cb.checked = true);
        this.updateModalCount();
    },

    clearContactSelection() {
        document.querySelectorAll('.modal-contact-cb').forEach(cb => cb.checked = false);
        this.updateModalCount();
    },

    updateModalCount() {
        const checked = document.querySelectorAll('.modal-contact-cb:checked').length;
        const total = Contacts.contacts.length;
        const countEl = document.getElementById('modalSelectedCount');
        if (countEl) {
            countEl.innerHTML = `<span class="count-number">${checked}</span> de ${total}`;
        }
    },

    hideContactModal() {
        document.getElementById('contactSelectModal').classList.add('hidden');
    },

    confirmContactSelection() {
        const checkboxes = document.querySelectorAll('.modal-contact-cb:checked');
        this.selectedContacts = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));

        this.updateUI();
        this.hideContactModal();

        Toast.success(`${this.selectedContacts.length} contatos selecionados`);
    },

    async startCampaign() {
        // Validations
        const message = Messages.getMessage();
        if (!message.trim()) {
            Toast.warning('Configure uma mensagem primeiro');
            App.navigateTo('messages');
            return;
        }

        if (this.selectedContacts.length === 0) {
            Toast.warning('Selecione ao menos um contato');
            return;
        }

        if (!WhatsApp.isConnected) {
            Toast.warning('Conecte o WhatsApp primeiro');
            App.navigateTo('connection');
            return;
        }

        // Get delay config
        const name = document.getElementById('campaignName').value || `Campanha ${new Date().toLocaleString()}`;
        const delayMin = parseInt(document.getElementById('delayMin')?.value) || 5;
        const delayMax = parseInt(document.getElementById('delayMax')?.value) || 15;
        const batchSize = parseInt(document.getElementById('batchSize')?.value) || 10;
        const batchDelayMin = parseInt(document.getElementById('batchDelayMin')?.value) || 30;
        const batchDelayMax = parseInt(document.getElementById('batchDelayMax')?.value) || 60;
        const variationLevel = Messages.getVariationLevel();
        console.log('[DEBUG] Texto Mágico enabled:', Messages.useAiVariation, 'variationLevel:', variationLevel);

        // Confirm
        const confirmMsg = `Enviar mensagem para ${this.selectedContacts.length} contatos?\n\n` +
            `• Delay: ${delayMin}-${delayMax} segundos entre mensagens\n` +
            `• Pausa: ${batchDelayMin}-${batchDelayMax} seg após cada ${batchSize} mensagens`;
        if (!confirm(confirmMsg)) return;

        try {
            Toast.info('Iniciando campanha...');

            const result = await API.post('/messages/campaigns', {
                name,
                message,
                contactIds: this.selectedContacts,
                delayConfig: {
                    delayMin,
                    delayMax,
                    batchSize,
                    batchDelayMin,
                    batchDelayMax
                },
                variationLevel
            });

            if (result.success) {
                this.activeCampaignId = result.campaignId;
                this.sentCount = 0;
                this.failedCount = 0;
                this.showProgress();
                Toast.success('Campanha iniciada!');
            } else {
                Toast.error(result.error || 'Erro ao iniciar campanha');
            }
        } catch (err) {
            Toast.error('Erro ao iniciar campanha');
        }
    },

    showProgress() {
        document.getElementById('progressContainer').classList.add('hidden');
        document.getElementById('progressActive').classList.remove('hidden');

        document.getElementById('progressTotal').textContent = this.selectedContacts.length;
        document.getElementById('progressCurrent').textContent = '0';
        document.getElementById('progressFailed').textContent = '0';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressLog').innerHTML = '';
    },

    handleProgress(data) {
        if (data.campaignId !== this.activeCampaignId) return;

        // Update counts
        if (data.status === 'sent') {
            this.sentCount++;
        } else if (data.status === 'failed') {
            this.failedCount++;
        }

        document.getElementById('progressCurrent').textContent = this.sentCount;
        document.getElementById('progressFailed').textContent = this.failedCount;

        // Update progress bar
        const progress = (data.current / data.total) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;

        // Add log entry
        const log = document.getElementById('progressLog');
        const time = new Date().toLocaleTimeString();
        const statusClass = data.status === 'sent' ? 'success' : 'failed';
        const statusText = data.status === 'sent' ? '✓' : '✗';

        log.innerHTML += `
            <div class="log-entry ${statusClass}">
                <span class="log-time">[${time}]</span>
                <span>${statusText} ${data.contact}</span>
                ${data.error ? `<small> - ${data.error}</small>` : ''}
            </div>
        `;

        // Auto-scroll log
        log.scrollTop = log.scrollHeight;
    },

    handleComplete(data) {
        if (data.campaignId !== this.activeCampaignId) return;

        this.activeCampaignId = null;

        const statusMsg = data.status === 'completed'
            ? `Campanha concluída! ${data.sent} enviadas, ${data.failed} falhas.`
            : `Campanha interrompida. ${data.sent} enviadas, ${data.failed} falhas.`;

        if (data.failed > 0) {
            Toast.warning(statusMsg);
        } else {
            Toast.success(statusMsg);
        }

        // Reload reports (always refresh)
        Reports.loadStats();
    },

    async stopCampaign() {
        if (!this.activeCampaignId) return;

        if (!confirm('Parar a campanha atual?')) return;

        try {
            await API.post(`/messages/campaigns/${this.activeCampaignId}/stop`);
            Toast.info('Campanha interrompida');
        } catch (err) {
            Toast.error('Erro ao parar campanha');
        }
    }
};
