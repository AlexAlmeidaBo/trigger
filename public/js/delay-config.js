// Inject advanced delay config into campaign form
document.addEventListener('DOMContentLoaded', function() {
    // Wait for page load
    setTimeout(function() {
        const delayForm = document.querySelector('#campaigns .form-group:has(#delayValue)');
        if (delayForm) {
            delayForm.innerHTML = `
                <label>Delay entre Mensagens</label>
                <div class="delay-range" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span>De</span>
                    <input type="number" id="delayMin" value="5" min="1" max="300" style="width:70px;text-align:center">
                    <span>a</span>
                    <input type="number" id="delayMax" value="15" min="1" max="300" style="width:70px;text-align:center">
                    <span>segundos</span>
                </div>
                <small>Intervalo aleatório entre cada mensagem</small>
            `;
            
            // Add batch config after
            const batchHtml = `
                <div class="form-group">
                    <label>Pausa após Lote</label>
                    <div class="delay-range" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span>Após</span>
                        <input type="number" id="batchSize" value="10" min="1" max="100" style="width:70px;text-align:center">
                        <span>msgs, pausar de</span>
                        <input type="number" id="batchDelayMin" value="30" min="5" max="600" style="width:70px;text-align:center">
                        <span>a</span>
                        <input type="number" id="batchDelayMax" value="60" min="5" max="600" style="width:70px;text-align:center">
                        <span>seg</span>
                    </div>
                    <small>Pausa maior a cada X mensagens para evitar bloqueios</small>
                </div>
            `;
            delayForm.insertAdjacentHTML('afterend', batchHtml);
        }
    }, 500);
});
