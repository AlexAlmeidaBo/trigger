// WhatsApp Connection Module
const WhatsApp = {
    isConnected: false,
    qrRequested: false,

    init() {
        this.bindEvents();
        this.checkStatusAndConnect();
    },

    bindEvents() {
        document.getElementById('reconnectBtn').addEventListener('click', () => this.requestNewQR());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Pairing Code Events
        const pairingBtn = document.getElementById('pairingCodeBtn');
        if (pairingBtn) {
            pairingBtn.addEventListener('click', () => this.openPairingModal());
        }

        document.getElementById('closePairingModal')?.addEventListener('click', () => this.closePairingModal());
        document.getElementById('cancelPairing')?.addEventListener('click', () => this.closePairingModal());
        document.getElementById('generateCodeBtn')?.addEventListener('click', () => this.requestPairingCode());

        // Format phone input
        const phoneInput = document.getElementById('pairingPhone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
            });
        }
    },

    openPairingModal() {
        document.getElementById('pairingModal').classList.remove('hidden');
        document.getElementById('pairingInputStep').classList.remove('hidden');
        document.getElementById('pairingCodeStep').classList.add('hidden');
        document.getElementById('pairingPhone').value = '';
        document.getElementById('generateCodeBtn').style.display = 'block';
    },

    closePairingModal() {
        document.getElementById('pairingModal').classList.add('hidden');
    },

    async requestPairingCode() {
        const phoneInput = document.getElementById('pairingPhone');
        const phone = phoneInput.value.trim();

        if (!phone || phone.length < 10) {
            Toast.warning('Digite um número de telefone válido com DDD');
            return;
        }

        const generateBtn = document.getElementById('generateCodeBtn');
        const loading = document.getElementById('pairingLoading');
        const codeDisplay = document.getElementById('pairingCodeDisplay');

        generateBtn.disabled = true;
        generateBtn.textContent = 'Gerando...';

        try {
            const result = await API.post('/whatsapp/pairing-code', { phoneNumber: phone });

            if (result.success) {
                // Show code step
                document.getElementById('pairingInputStep').classList.add('hidden');
                document.getElementById('pairingCodeStep').classList.remove('hidden');
                generateBtn.style.display = 'none';

                // Display code
                const code = result.code; // Format: XXXX-XXXX
                const chars = code.replace('-', '').split('');

                codeDisplay.innerHTML = '';
                chars.forEach((char, index) => {
                    if (index === 4) {
                        const sep = document.createElement('span');
                        sep.className = 'code-separator';
                        sep.textContent = '-';
                        codeDisplay.appendChild(sep);
                    }
                    const span = document.createElement('span');
                    span.className = 'code-digit';
                    span.textContent = char;
                    codeDisplay.appendChild(span);
                });

                Toast.success('Código gerado com sucesso!');
            } else {
                throw new Error(result.error || 'Erro ao gerar código');
            }
        } catch (err) {
            console.error(err);
            Toast.error(err.message || 'Erro ao gerar código de pareamento');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Gerar Código';
        }
    },

    async checkStatusAndConnect() {
        try {
            const result = await API.get('/whatsapp/status');
            this.handleStatus(result);

            // Se já está conectado, não faz nada
            // Se está desconectado, apenas mostra o status - usuário clica em Reconectar manualmente
            // Isso evita reiniciar a sessão ao dar F5
        } catch (err) {
            console.error('Error checking status:', err);
        }
    },

    async checkStatus() {
        try {
            const result = await API.get('/whatsapp/status');
            this.handleStatus(result);
        } catch (err) {
            console.error('Error checking status:', err);
        }
    },

    handleQR(qrCode) {
        const qrImage = document.getElementById('qrImage');
        const qrPlaceholder = document.getElementById('qrPlaceholder');

        if (qrCode) {
            qrImage.src = qrCode;
            qrImage.classList.remove('hidden');
            qrPlaceholder.style.display = 'none';
        }

        this.updateStatusUI('qr');
    },

    handleStatus(data) {
        const status = data.status;
        this.isConnected = status === 'connected';

        this.updateStatusUI(status);

        if (status === 'connected') {
            Toast.success('WhatsApp conectado com sucesso!');
            document.getElementById('qrImage').classList.add('hidden');
            document.getElementById('qrPlaceholder').style.display = 'flex';

            // Show account info
            if (data.accountInfo) {
                const phone = data.accountInfo.phoneNumber;
                const name = data.accountInfo.name || 'WhatsApp';
                const formattedPhone = this.formatPhone(phone);

                document.querySelector('.qr-placeholder p').innerHTML = `
                    <strong>${name}</strong><br>
                    <span style="color: var(--text-muted); font-size: 0.9rem;">${formattedPhone}</span>
                `;
                document.querySelector('.qr-placeholder svg').innerHTML = '<polyline points="20 6 9 17 4 12"/>';
            } else {
                document.querySelector('.qr-placeholder p').textContent = 'Conectado!';
                document.querySelector('.qr-placeholder svg').innerHTML = '<polyline points="20 6 9 17 4 12"/>';
            }
        } else if (status === 'qr' && data.qrCode) {
            this.handleQR(data.qrCode);
        }
    },

    formatPhone(phone) {
        if (!phone) return '';
        // Format as +55 (11) 99999-9999
        const clean = phone.replace(/\D/g, '');
        if (clean.length === 13) {
            return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
        } else if (clean.length === 12) {
            return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
        }
        return phone;
    },

    updateStatusUI(status) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        const connectionTitle = document.getElementById('connectionTitle');

        statusDot.className = 'status-dot';

        const statusMap = {
            connected: {
                class: 'connected',
                text: 'Conectado',
                title: 'WhatsApp Conectado'
            },
            disconnected: {
                class: 'disconnected',
                text: 'Desconectado',
                title: 'Conecte seu WhatsApp'
            },
            qr: {
                class: 'connecting',
                text: 'Aguardando QR',
                title: 'Escaneie o QR Code'
            },
            authenticating: {
                class: 'connecting',
                text: 'Autenticando...',
                title: 'Autenticando...'
            },
            error: {
                class: 'disconnected',
                text: 'Erro',
                title: 'Erro de Conexão'
            }
        };

        const info = statusMap[status] || statusMap.disconnected;
        statusDot.classList.add(info.class);
        statusText.textContent = info.text;
        connectionTitle.textContent = info.title;
    },

    async requestNewQR() {
        try {
            Toast.info('Gerando QR Code...');
            await API.post('/whatsapp/reconnect');
        } catch (err) {
            Toast.error('Erro ao gerar QR Code');
        }
    },

    async logout() {
        try {
            await API.post('/whatsapp/logout');
            Toast.success('Desconectado com sucesso');
            this.updateStatusUI('disconnected');
            this.qrRequested = false; // Permite gerar novo QR após logout
        } catch (err) {
            Toast.error('Erro ao desconectar');
        }
    }
};
