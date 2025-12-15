/**
 * Texto Mágico UI Components
 * 
 * Tooltip and examples modal for explaining Texto Mágico feature
 */

const TextoMagico = {
    // Official definition
    DEFINITION: 'Texto Mágico = respostas humanas prontas, calibradas por nicho, que o agente usa sem parecer robô.',

    // Examples by niche
    EXAMPLES: [
        {
            niche: 'Religioso (Pastoral)',
            icon: '🙏',
            messages: [
                'Que bom te ouvir! Deus te abençoe sempre.',
                'Fico feliz que você compartilhou isso comigo. Estou aqui.',
                'Entendo... às vezes o coração pesa. Vamos conversar.'
            ]
        },
        {
            niche: 'Político (Provocador)',
            icon: '🗳️',
            messages: [
                'Interessante sua visão... e o que te faz pensar assim?',
                'Hm, discordo. Mas me conta mais.',
                'Olha, cada um tem sua opinião. O importante é debater.'
            ]
        },
        {
            niche: 'Emagrecimento (Empático)',
            icon: '💪',
            messages: [
                'Entendo como é difícil... cada passo conta!',
                'Não se culpe. Amanhã é um novo dia.',
                'Faz sentido o que você está sentindo. Vamos devagar.'
            ]
        }
    ],

    // Create tooltip element
    createTooltip(targetElement) {
        const tooltip = document.createElement('div');
        tooltip.className = 'texto-magico-tooltip';
        tooltip.innerHTML = `
            <span class="tooltip-icon">ℹ️</span>
            <div class="tooltip-content">
                <p>${this.DEFINITION}</p>
                <a href="#" onclick="TextoMagico.showExamples(); return false;">Ver exemplos</a>
            </div>
        `;

        if (targetElement) {
            targetElement.appendChild(tooltip);
        }

        return tooltip;
    },

    // Show examples modal
    showExamples() {
        // Remove existing modal if any
        const existing = document.getElementById('textoMagicoModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'textoMagicoModal';
        modal.className = 'texto-magico-modal';
        modal.innerHTML = `
            <div class="texto-magico-modal-content">
                <div class="modal-header">
                    <h2>✨ Texto Mágico - Exemplos</h2>
                    <button class="modal-close" onclick="TextoMagico.closeExamples()">×</button>
                </div>
                <div class="modal-body">
                    <p class="modal-description">${this.DEFINITION}</p>
                    <div class="examples-grid">
                        ${this.EXAMPLES.map(ex => `
                            <div class="example-card">
                                <div class="example-header">
                                    <span class="example-icon">${ex.icon}</span>
                                    <h3>${ex.niche}</h3>
                                </div>
                                <div class="example-messages">
                                    ${ex.messages.map(msg => `
                                        <div class="example-bubble">"${msg}"</div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeExamples();
        });
    },

    // Close examples modal
    closeExamples() {
        const modal = document.getElementById('textoMagicoModal');
        if (modal) modal.remove();
    },

    // Add tooltip to all Texto Mágico mentions
    init() {
        // Find elements that mention Texto Mágico
        const elements = document.querySelectorAll('[data-feature="texto-magico"]');
        elements.forEach(el => this.createTooltip(el));
    }
};

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TextoMagico.init());
} else {
    TextoMagico.init();
}
