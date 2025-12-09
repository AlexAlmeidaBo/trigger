// Messages Module
const Messages = {
    message: '',
    variations: [],
    variationLevel: 'none',

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

        // Variation level
        document.querySelectorAll('input[name="variationLevel"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.variationLevel = e.target.value;
            });
        });

        // Generate variations
        document.getElementById('generateVariationsBtn').addEventListener('click', () => this.generateVariations());
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

    async generateVariations() {
        if (!this.message.trim()) {
            Toast.warning('Digite uma mensagem primeiro');
            return;
        }

        if (this.variationLevel === 'none') {
            Toast.info('Selecione um nível de variação');
            return;
        }

        const btn = document.getElementById('generateVariationsBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> Gerando...';
        btn.disabled = true;

        Toast.info('Gerando variações com IA...');

        try {
            const result = await API.post('/messages/variations', {
                message: this.message,
                level: this.variationLevel
            });

            if (result.success && result.variations.length > 0) {
                this.variations = result.variations;
                this.renderVariations();
                Toast.success(`${result.variations.length} variação(ões) gerada(s)!`);
            } else {
                Toast.error(result.error || 'Nenhuma variação foi gerada');
            }
        } catch (err) {
            console.error('Error generating variations:', err);
            Toast.error('Erro ao gerar variações');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    renderVariations() {
        const container = document.getElementById('variationsContainer');
        const list = document.getElementById('variationsList');

        if (this.variations.length === 0) {
            list.classList.add('hidden');
            return;
        }

        list.classList.remove('hidden');
        container.innerHTML = this.variations.map((v, i) => `
            <div class="variation-item" onclick="Messages.useVariation(${i})" title="Clique para usar esta variação">
                ${this.escapeHtml(v)}
            </div>
        `).join('');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    useVariation(index) {
        const variation = this.variations[index];
        if (variation) {
            document.getElementById('messageContent').value = variation;
            this.message = variation;
            this.updateCharCount();
            this.updatePreview();
            Toast.success('Variação aplicada');
        }
    },

    getMessage() {
        return this.message;
    },

    getVariationLevel() {
        return this.variationLevel;
    }
};
