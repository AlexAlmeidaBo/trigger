// WhatsApp Connection Module
const WhatsApp = {
    isConnected: false,

    init() {
        this.bindEvents();
        this.checkStatus();
    },

    bindEvents() {
        document.getElementById('reconnectBtn').addEventListener('click', () => this.reconnect());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
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
            document.querySelector('.qr-placeholder p').textContent = 'Conectado!';
            document.querySelector('.qr-placeholder svg').innerHTML = '<polyline points="20 6 9 17 4 12"/>';
        } else if (status === 'qr' && data.qrCode) {
            this.handleQR(data.qrCode);
        }
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

    async reconnect() {
        try {
            Toast.info('Reconectando...');
            await API.post('/whatsapp/reconnect');
        } catch (err) {
            Toast.error('Erro ao reconectar');
        }
    },

    async logout() {
        try {
            await API.post('/whatsapp/logout');
            Toast.success('Desconectado com sucesso');
            this.updateStatusUI('disconnected');
        } catch (err) {
            Toast.error('Erro ao desconectar');
        }
    }
};
