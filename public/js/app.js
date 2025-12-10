// Main Application Module
const App = {
    currentSection: 'connection',
    ws: null,
    selectedContacts: [],
    messageContent: '',
    user: null,

    async init() {
        // Check authentication first
        if (!await this.checkAuth()) {
            return; // Will redirect to login
        }

        this.displayUser();
        this.setupNavigation();
        this.setupWebSocket();
        this.initModules();
        this.setupLogout();
        this.setupMobileMenu();
    },

    async checkAuth() {
        // Admin emails that bypass all checks
        const ADMIN_EMAILS = ['alec.almeida201@gmail.com'];

        // Skip check if on login/landing pages
        const currentPath = window.location.pathname;
        if (currentPath.includes('login') || currentPath.includes('landing')) {
            return true;
        }

        // Check if user is logged in
        if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
            window.location.href = '/login.html';
            return false;
        }

        // Get user data
        if (typeof Auth !== 'undefined') {
            this.user = Auth.getUser();
        }

        // Skip all checks for admin accounts
        if (this.user && ADMIN_EMAILS.includes(this.user.email)) {
            console.log('Admin account detected');
            this.isPremium = true;
            return true;
        }

        // Freemium model: allow access but fetch limits
        try {
            const response = await Auth.fetchWithAuth('/api/subscription/limits');
            if (response.ok) {
                const limits = await response.json();
                this.isPremium = limits.isPremium;
                this.userLimits = limits;
                console.log('User limits:', limits);
            }
        } catch (e) {
            console.log('Could not fetch limits:', e);
            this.isPremium = false;
        }

        return true;
    },

    displayUser() {
        // If user info exists, display it in sidebar
        if (this.user) {
            const sidebarFooter = document.querySelector('.sidebar-footer');
            if (sidebarFooter) {
                const userInfo = document.createElement('div');
                userInfo.className = 'user-info';
                userInfo.innerHTML = `
                    <div class="user-avatar">
                        ${this.user.photoURL
                        ? `<img src="${this.user.photoURL}" alt="${this.user.displayName}">`
                        : `<span>${(this.user.displayName || this.user.email || 'U')[0].toUpperCase()}</span>`
                    }
                    </div>
                    <div class="user-details">
                        <span class="user-name">${this.user.displayName || this.user.email}</span>
                        <button class="btn-logout" id="logoutBtn">Sair</button>
                    </div>
                `;
                sidebarFooter.insertBefore(userInfo, sidebarFooter.firstChild);
            }
        }

        // Show plan banner
        this.showPlanBanner();
    },

    showPlanBanner() {
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (!sidebarFooter) return;

        // Remove existing banner if any
        const existingBanner = document.querySelector('.plan-banner');
        if (existingBanner) existingBanner.remove();

        const isPremium = this.isPremium;
        const limits = this.userLimits || { messagesRemaining: 15, dailyLimit: 15 };

        const banner = document.createElement('div');
        banner.className = `plan-banner ${isPremium ? 'premium' : ''}`;

        if (isPremium) {
            banner.innerHTML = `
                <div class="plan-badge premium">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span>Plano PRO</span>
                </div>
                <div class="plan-limit">Mensagens ilimitadas</div>
            `;
        } else {
            banner.innerHTML = `
                <div class="plan-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                    <span>Plano Gratuito</span>
                </div>
                <div class="plan-limit">${limits.messagesRemaining}/${limits.dailyLimit} msgs restantes hoje</div>
                <a href="https://pay.kirvano.com/245a1b99-0627-4f2b-93fa-adf5dc52ffee" class="upgrade-btn" target="_blank">
                    ⚡ Upgrade PRO - R$27,90/mês
                </a>
            `;
        }

        sidebarFooter.insertBefore(banner, sidebarFooter.firstChild);
    },

    setupLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn && typeof Auth !== 'undefined') {
            logoutBtn.addEventListener('click', () => {
                Auth.logout();
            });
        }
    },

    setupMobileMenu() {
        const menuToggle = document.getElementById('mobileMenuToggle');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        if (!menuToggle || !sidebar) return;

        // Toggle menu
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        });

        // Close menu when clicking overlay
        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }

        // Close menu when clicking nav item on mobile
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    if (overlay) overlay.classList.remove('active');
                }
            });
        });
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.navigateTo(section);
            });
        });
    },

    navigateTo(section) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        // Update sections
        document.querySelectorAll('.section').forEach(sec => {
            sec.classList.toggle('active', sec.id === section);
        });

        this.currentSection = section;

        // Trigger section-specific updates
        if (section === 'contacts') Contacts.loadContacts();
        if (section === 'reports') Reports.loadStats();
        if (section === 'campaigns') Campaigns.updateUI();
    },

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}`);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWSMessage(data);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting...');
            setTimeout(() => this.setupWebSocket(), 3000);
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket error:', err);
        };
    },

    handleWSMessage(data) {
        switch (data.type) {
            case 'qr':
                WhatsApp.handleQR(data.qrCode);
                break;
            case 'status':
                WhatsApp.handleStatus(data);
                break;
            case 'campaign_progress':
                Campaigns.handleProgress(data);
                break;
            case 'campaign_complete':
                Campaigns.handleComplete(data);
                break;
            case 'agent_reply':
                if (typeof Agent !== 'undefined') Agent.handleAgentReply(data);
                break;
        }
    },

    initModules() {
        WhatsApp.init();
        Contacts.init();
        Messages.init();
        Campaigns.init();
        Reports.init();
        if (typeof GroupSearch !== 'undefined') GroupSearch.init();
        if (typeof Agent !== 'undefined') Agent.init();
    }
};

// Toast Notification System
const Toast = {
    container: document.getElementById('toastContainer'),

    show(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success(message) { this.show(message, 'success'); },
    error(message) { this.show(message, 'error'); },
    warning(message) { this.show(message, 'warning'); },
    info(message) { this.show(message, 'info'); }
};

// API Helper with Auth
const API = {
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (typeof Auth !== 'undefined') {
            const token = Auth.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }
        return headers;
    },

    async get(url) {
        const response = await fetch(`/api${url}`, {
            headers: this.getHeaders()
        });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return { success: false };
        }
        return response.json();
    },

    async post(url, data) {
        const response = await fetch(`/api${url}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return { success: false };
        }
        return response.json();
    },

    async delete(url) {
        const response = await fetch(`/api${url}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return { success: false };
        }
        return response.json();
    },

    async upload(url, formData) {
        const headers = {};
        if (typeof Auth !== 'undefined') {
            const token = Auth.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }
        const response = await fetch(`/api${url}`, {
            method: 'POST',
            headers,
            body: formData
        });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return { success: false };
        }
        return response.json();
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

