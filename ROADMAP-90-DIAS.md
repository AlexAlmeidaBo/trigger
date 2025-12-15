# Roadmap 90 Dias - WA Sender SaaS

## Fase 1: Fundação (Semanas 1-4)

### Semana 1-2: Infraestrutura
- [ ] Deploy em produção (Railway/Render/VPS)
- [ ] Configurar domínio personalizado
- [ ] SSL/HTTPS
- [ ] Variáveis de ambiente seguras
- [ ] Backup automatizado do banco

### Semana 3-4: Pagamentos
- [ ] Integrar gateway de pagamento (Stripe/Kirvano)
- [ ] Webhook de pagamentos funcionando
- [ ] Upgrade/downgrade de planos
- [ ] Trial de 7 dias para Starter
- [ ] E-mails transacionais (boas-vindas, recibos)

---

## Fase 2: Produto (Semanas 5-8)

### Semana 5-6: Onboarding
- [ ] Wizard de primeira campanha
- [ ] Templates de mensagem prontos
- [ ] Tour guiado pelo painel
- [ ] Vídeos tutoriais curtos

### Semana 7-8: UX e Polimento
- [ ] Notificações em tempo real (WebSocket)
- [ ] Dashboard mobile responsivo
- [ ] Temas claro/escuro
- [ ] Shortcuts de teclado

---

## Fase 3: Escala (Semanas 9-12)

### Semana 9-10: Performance
- [ ] Fila de mensagens (Redis/Bull)
- [ ] Cache de respostas frequentes
- [ ] Otimização de queries
- [ ] Monitoring (Sentry/LogRocket)

### Semana 11-12: Multi-tenant
- [ ] Isolamento completo por cliente
- [ ] Métricas por tenant
- [ ] White-label para Agency
- [ ] Sub-contas para agências

---

## KPIs para Acompanhar

| Métrica | Meta Fase 1 | Meta Fase 2 | Meta Fase 3 |
|---------|-------------|-------------|-------------|
| Usuários cadastrados | 100 | 500 | 2000 |
| Conversões FREE→STARTER | 10% | 15% | 20% |
| Churn mensal | < 10% | < 8% | < 5% |
| Uptime | 99% | 99.5% | 99.9% |
| Tempo resposta API | < 500ms | < 300ms | < 200ms |

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Ban do WhatsApp | QR code próprio do cliente, delays humanizados |
| Abuso do serviço | Rate limiting, terms of service |
| Vazamento de persona | Policy Layer blindado |
| Escala | Infra elástica, filas |

---

## Próximos Passos Imediatos

1. **Hoje**: Deploy básico funcionando
2. **Esta semana**: Integrar pagamentos
3. **Próxima semana**: Onboarding flow
4. **Mês 1**: 50 usuários pagantes
