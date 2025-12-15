# SOP Operacional - Cockpit de Conversas

## Acesso
Abra: `http://localhost:3000/cockpit.html`

---

## Priorização de Conversas

### Por Status (ordem decrescente de urgência):
1. 🔴 **ESCALATED** - Precisa atenção humana AGORA
2. 🟡 **HUMAN_TAKEN** - Humano assumiu, acompanhar
3. 🟢 **NONE** - Agente funcionando

### Quando Assumir (HUMAN_TAKEN):
- `BOT_SUSPECT` - Lead desconfia que é bot
- `AUDIO_MESSAGE` - Enviou áudio (agente não processa)
- `UPSET` - Lead irritado/agressivo
- `suicidio/depressao` - Risco psicológico

### Quando Devolver ao Agente:
- Lead voltou a interagir normalmente
- Dúvida foi esclarecida
- Desconfiança resolvida

### Quando Silenciar:
- Lead pediu para parar
- Conversa finalizada
- Spam detectado

---

## Uso de Tags

| Tag | Quando Usar |
|-----|-------------|
| `LEAD_QUENTE` | Demonstrou interesse real |
| `LEAD_MORNO` | Interesse moderado |
| `LEAD_FRIO` | Sem interesse claro |
| `LEAD_CANSADO` | Muitas mensagens sem engajamento |
| `LEAD_AUTOMATICO` | Conversa fluindo bem |
| `LEAD_DESCONFIADO` | Questionou autenticidade |
| `PRONTO_PARA_CTA` | Pronto para call-to-action |
| `PRECISA_FOLLOW_UP` | Agendar retorno |
| `NAO_INCOMODAR` | Não enviar mais mensagens |

---

## Notas Internas (não visíveis ao lead)
Use para:
- Contexto da conversa
- Histórico de interações
- Próximos passos
- Observações importantes

---

## Métricas Importantes

| Métrica | Alvo Ideal |
|---------|------------|
| Stop Rate | < 30% |
| Block Rate | < 5% |
| Escalate Rate | < 10% |

### Red Flags:
- Escalate Rate > 20% = Revisar cérebro
- Block Rate > 10% = PolicyLayer muito restritivo
- Stop Rate > 50% = Mensagens curtas/encerradoras

---

## Rotina Diária

1. **Início do dia:** Verificar escaladas pendentes
2. **A cada 2h:** Atualizar inbox, resolver escaladas
3. **Fim do dia:** Revisar métricas, anotar ajustes

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Muitas escaladas | Revisar regras de escalonamento |
| Agente bloqueando muito | Revisar forbidden words |
| Lead reclamando | Assumir imediatamente |
| Áudio enviado | Sempre assumir |
