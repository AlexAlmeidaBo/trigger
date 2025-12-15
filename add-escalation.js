const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'public', 'index.html');
// Read with explicit UTF-8 encoding
let html = fs.readFileSync(indexPath, 'utf8');

const escalationSection = `
                <!-- Escalated Conversations Section -->
                <div class="escalation-section" style="margin-top: 24px;">
                    <div class="card">
                        <div class="card-header">
                            <h3>⚠️ Conversas Escaladas</h3>
                            <div class="metrics-badges">
                                <span class="badge badge-warning" id="metricEscalated">0 escaladas</span>
                                <span class="badge badge-info" id="metricHumanTaken">0 assumidas</span>
                                <button class="btn btn-sm btn-secondary" onclick="Agent.loadEscalated(); Agent.loadMetrics();">Atualizar</button>
                            </div>
                        </div>
                        <div class="escalated-list" id="escalatedList">
                            <div class="empty-state" style="padding: 24px; text-align: center; color: var(--text-muted);">
                                <p>Nenhuma conversa escalada</p>
                                <small>Conversas que precisam de atencao humana aparecerao aqui</small>
                            </div>
                        </div>
                    </div>
                </div>`;

// Find the closing </section> before </main>
const sectionCloseIndex = html.lastIndexOf('</section>');
if (sectionCloseIndex > -1) {
    // Insert before </section>
    html = html.slice(0, sectionCloseIndex) + escalationSection + '\n            ' + html.slice(sectionCloseIndex);
    // Write back with explicit UTF-8 encoding
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('Escalation section added with UTF-8 encoding!');
} else {
    console.log('Could not find insertion point');
}
