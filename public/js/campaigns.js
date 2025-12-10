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

        if (Contacts.contacts.length === 0) {
            Toast.warning('Importe contatos primeiro');
            return;
        }

        modal.classList.remove('hidden');

        // Build HTML with select all buttons
        const actionsHtml = `
            <div class="modal-selection-actions" style="margin-bottom: 16px; display: flex; gap: 12px; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                <button class="btn btn-secondary btn-sm" id="selectAllBtn" onclick="Campaigns.selectAllContacts()">
                    ✓ Selecionar Todos
                </button>
                <button class="btn btn-secondary btn-sm" id="clearSelectionBtn" onclick="Campaigns.clearContactSelection()">
                    ✗ Limpar Seleção
                </button>
                <span style="margin-left: auto; color: var(--primary); font-weight: 600;" id="modalSelectedCount">${this.selectedContacts.length} de ${Contacts.contacts.length}</span>
            </div>
        `;

        const contactsHtml = Contacts.contacts.map(contact => `
            <label class="modal-contact-item">
                <input type="checkbox" 
                       class="modal-contact-cb" 
                       data-id="${contact.id}"
                       onchange="Campaigns.updateModalCount()"
                       ${this.selectedContacts.includes(contact.id) ? 'checked' : ''}>
                <div>
                    <strong>${contact.name || contact.phone}</strong>
                    <small>${Contacts.formatPhone(contact.phone)}</small>
                </div>
            </label>
        `).join('');

        listEl.innerHTML = actionsHtml + contactsHtml;
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
            countEl.textContent = `${checked} de ${total}`;
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
