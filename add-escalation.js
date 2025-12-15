const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'public', 'index.html');
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

// Find the agent-logs-card closing and section closing
const target = /<\/div>\s*<\/div>\s*<\/section>\s*<\/main>/;
const replacement = `</div>
                </div>
${escalationSection}
            </section>

        </main>`;

if (html.match(target)) {
    html = html.replace(target, replacement);
    fs.writeFileSync(indexPath, html);
    console.log('Escalation section added successfully!');
} else {
    console.log('Target pattern not found, trying alternative...');
    // Try simpler approach - find </section> before </main>
    const simpler = html.indexOf('</section>\r\n\r\n        </main>');
    if (simpler > -1) {
        const before = html.substring(0, simpler);
        const after = html.substring(simpler);
        html = before.replace(/<\/div>\s*<\/div>\s*$/m, `</div>\n                </div>\n${escalationSection}`) + after;
        fs.writeFileSync(indexPath, html);
        console.log('Escalation section added via alternative method!');
    } else {
        console.log('Could not find insertion point');
    }
}
