// Modal/Popup System
const Modal = {
    overlay: null,

    init() {
        // Create modal overlay if not exists
        if (!document.getElementById('modalOverlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'modalOverlay';
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-content">
                    <div class="modal-icon" id="modalIcon">🤖</div>
                    <div class="modal-title" id="modalTitle">Título</div>
                    <div class="modal-message" id="modalMessage">Mensagem</div>
                    <button class="modal-btn" id="modalBtn">OK</button>
                </div>
            `;
            document.body.appendChild(overlay);

            // Close on button click
            document.getElementById('modalBtn').addEventListener('click', () => this.close());

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.close();
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.close();
            });
        }
        this.overlay = document.getElementById('modalOverlay');
    },

    show({ icon = '✨', title = '', message = '', buttonText = 'OK' }) {
        this.init();
        document.getElementById('modalIcon').textContent = icon;
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalMessage').textContent = message;
        document.getElementById('modalBtn').textContent = buttonText;
        this.overlay.classList.add('active');
    },

    close() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
        }
    },

    // Convenience methods
    info(title, message) {
        this.show({ icon: '💡', title, message });
    },

    success(title, message) {
        this.show({ icon: '✅', title, message });
    },

    warning(title, message) {
        this.show({ icon: '⚠️', title, message });
    },

    comingSoon(feature) {
        this.show({
            icon: '🚀',
            title: 'Em Breve!',
            message: `${feature} estará disponível em breve. Fique ligado nas novidades!`,
            buttonText: 'Entendi'
        });
    }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Modal.init());
} else {
    Modal.init();
}

// Export for global use
window.Modal = Modal;
