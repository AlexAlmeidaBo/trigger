// Messages Module
const Messages = {
    message: '',
    variations: [],
    useAiVariation: false,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const textarea = document.getElementById('messageContent');

        // Message input
        textarea.addEventListener('input', (e) => {
            this.message = e.target.value;
            this.updateCharCount();
            this.updatePreview();
        });

        // Toolbar buttons
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.dataset.format;
                const insert = btn.dataset.insert;

                if (format) this.applyFormat(format);
                if (insert) this.insertText(insert);
            });
        });

        // AI Variation toggle
        const aiToggle = document.getElementById('enableAiVariation');
        if (aiToggle) {
            aiToggle.addEventListener('change', (e) => {
                this.useAiVariation = e.target.checked;
            });
        }
    },

    applyFormat(format) {
        const textarea = document.getElementById('messageContent');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        const formats = {
            bold: { prefix: '*', suffix: '*' },
            italic: { prefix: '_', suffix: '_' },
            strike: { prefix: '~', suffix: '~' }
        };

        const fmt = formats[format];
        if (!fmt) return;

        const newText = `${fmt.prefix}${selectedText}${fmt.suffix}`;
        textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);

        this.message = textarea.value;
        this.updatePreview();

        // Restore cursor
        textarea.focus();
        textarea.setSelectionRange(start + 1, end + 1);
    },

    insertText(text) {
        const textarea = document.getElementById('messageContent');
        const start = textarea.selectionStart;

        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(start);
        this.message = textarea.value;
        this.updatePreview();

        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
    },

    updateCharCount() {
        document.getElementById('charCount').textContent = this.message.length;
    },

    updatePreview() {
        const preview = document.getElementById('messagePreview');

        if (!this.message.trim()) {
            preview.innerHTML = '<p class="preview-placeholder">Digite uma mensagem para ver o preview</p>';
            return;
        }

        // Convert WhatsApp formatting to HTML
        let html = this.message
            .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
            .replace(/_([^_]+)_/g, '<em>$1</em>')
            .replace(/~([^~]+)~/g, '<s>$1</s>')
            .replace(/\[nome\]/gi, '<span class="variable-tag">João</span>')
            .replace(/\[telefone\]/gi, '<span class="variable-tag">+55 11 99999-9999</span>')
            .replace(/\n/g, '<br>');

        preview.innerHTML = html;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    getMessage() {
        return this.message;
    },

    getVariationLevel() {
        // Returns 'medium' when AI variation is enabled, 'none' otherwise
        return this.useAiVariation ? 'medium' : 'none';
    }
};
