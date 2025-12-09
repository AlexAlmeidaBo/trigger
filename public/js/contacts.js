// Contacts Management Module
const Contacts = {
    contacts: [],

    init() {
        this.bindEvents();
        this.loadContacts();
    },

    bindEvents() {
        // File import
        document.getElementById('fileImport').addEventListener('change', (e) => this.handleFileImport(e));

        // Group import
        document.getElementById('importGroupBtn').addEventListener('click', () => this.showGroupModal());
        document.getElementById('closeGroupModal').addEventListener('click', () => this.hideGroupModal());

        // Clear contacts
        document.getElementById('clearContactsBtn').addEventListener('click', () => this.clearContacts());

        // Select all
        document.getElementById('selectAllContacts').addEventListener('change', (e) => this.selectAll(e.target.checked));
    },

    async loadContacts() {
        try {
            const result = await API.get('/contacts');
            if (result.success) {
                this.contacts = result.contacts;
                this.renderContacts();
            }
        } catch (err) {
            console.error('Error loading contacts:', err);
        }
    },

    renderContacts() {
        const tbody = document.getElementById('contactsTableBody');
        const emptyState = document.getElementById('emptyContacts');
        const countEl = document.getElementById('contactCount');

        if (this.contacts.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            countEl.textContent = '0 contatos';
            return;
        }

        emptyState.classList.add('hidden');
        countEl.textContent = `${this.contacts.length} contatos`;

        tbody.innerHTML = this.contacts.map(contact => `
            <tr>
                <td><input type="checkbox" class="contact-checkbox" data-id="${contact.id}"></td>
                <td>${contact.name || '-'}</td>
                <td>${this.formatPhone(contact.phone)}</td>
                <td>${contact.group_name || '-'}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="Contacts.deleteContact(${contact.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    formatPhone(phone) {
        if (!phone) return '-';
        // Format Brazilian phone
        if (phone.length === 13 && phone.startsWith('55')) {
            return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
        }
        return phone;
    },

    async handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const result = await API.upload('/contacts/import', formData);

            if (result.success) {
                Toast.success(`${result.imported} contatos importados!`);
                this.showImportStatus(result.message);
                this.loadContacts();
            } else {
                Toast.error(result.error || 'Erro ao importar');
            }
        } catch (err) {
            Toast.error('Erro ao importar arquivo');
        }

        // Reset input
        e.target.value = '';
    },

    showImportStatus(message) {
        const statusEl = document.getElementById('importStatus');
        const messageEl = document.getElementById('importMessage');

        messageEl.textContent = message;
        statusEl.classList.remove('hidden');

        setTimeout(() => statusEl.classList.add('hidden'), 5000);
    },

    async showGroupModal() {
        if (!WhatsApp.isConnected) {
            Toast.warning('Conecte o WhatsApp primeiro');
            return;
        }

        const modal = document.getElementById('groupModal');
        const groupsList = document.getElementById('groupsList');

        modal.classList.remove('hidden');
        groupsList.innerHTML = '<div class="loading">Carregando grupos...</div>';

        try {
            const result = await API.get('/contacts/groups');

            if (result.success && result.groups.length > 0) {
                groupsList.innerHTML = result.groups.map(group => `
                    <div class="group-item" onclick="Contacts.importFromGroup('${group.id}', '${group.name}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <div>
                            <strong>${group.name}</strong>
                            <small>${group.participantsCount || '?'} participantes</small>
                        </div>
                    </div>
                `).join('');
            } else {
                groupsList.innerHTML = '<div class="empty-state"><p>Nenhum grupo encontrado</p></div>';
            }
        } catch (err) {
            groupsList.innerHTML = '<div class="empty-state"><p>Erro ao carregar grupos</p></div>';
        }
    },

    hideGroupModal() {
        document.getElementById('groupModal').classList.add('hidden');
    },

    async importFromGroup(groupId, groupName) {
        try {
            Toast.info('Importando contatos do grupo...');

            const result = await API.post('/contacts/import-group', { groupId, groupName });

            if (result.success) {
                Toast.success(`${result.imported} contatos importados!`);
                this.hideGroupModal();
                this.loadContacts();
            } else {
                Toast.error(result.error || 'Erro ao importar');
            }
        } catch (err) {
            Toast.error('Erro ao importar do grupo');
        }
    },

    async deleteContact(id) {
        if (!confirm('Remover este contato?')) return;

        try {
            await API.delete(`/contacts/${id}`);
            Toast.success('Contato removido');
            this.loadContacts();
        } catch (err) {
            Toast.error('Erro ao remover contato');
        }
    },

    async clearContacts() {
        if (!confirm('Remover todos os contatos?')) return;

        try {
            await API.delete('/contacts');
            Toast.success('Todos os contatos removidos');
            this.loadContacts();
        } catch (err) {
            Toast.error('Erro ao limpar contatos');
        }
    },

    selectAll(checked) {
        document.querySelectorAll('.contact-checkbox').forEach(cb => {
            cb.checked = checked;
        });
    },

    getSelectedIds() {
        const checkboxes = document.querySelectorAll('.contact-checkbox:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
    }
};
