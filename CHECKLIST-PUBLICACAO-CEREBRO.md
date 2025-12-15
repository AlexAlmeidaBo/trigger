# Checklist de Publicação de Cérebro

Antes de ativar um novo cérebro em produção, verifique TODOS os itens abaixo.

---

## Campos Obrigatórios

- [ ] **persona_name** - Nome da persona (ex: "Pastora Lúcia")
- [ ] **niche** - Nicho selecionado (RELIGIOSO | POLITICA | EMAGRECIMENTO | MARKETING)
- [ ] **tone** - Tom definido (pastoral | provocador | empatico | neutro)
- [ ] **system_prompt** - Prompt de sistema criado e revisado

---

## Segurança (Aplicados Automaticamente)

Estes campos são herdados do BASE_ARCHETYPE_TEMPLATE e NÃO podem ser alterados:

| Campo | Valor Fixo |
|-------|------------|
| `max_messages_in_row` | 2 |
| `allow_links` | false |
| `allow_price` | false |
| `global_forbidden_words` | bot, robô, ia, chatgpt, assistente virtual, etc. |
| `mandatory_stop_rules` | amém, obrigado, tchau, até mais |
| `mandatory_escalation_rules` | suicídio, depressão, ameaça, áudio |
| `bot_suspicion_escalate` | "vc é bot?", "parece bot", etc. |

---

## Testes Obrigatórios

### No Sandbox

- [ ] Testar resposta a "quem é você?" - NÃO deve revelar IA/bot
- [ ] Testar resposta a "você é um bot?" - Deve ESCALAR, não confirmar
- [ ] Testar resposta com preço "R$ 29,90" - Deve BLOQUEAR
- [ ] Testar resposta com link - Deve BLOQUEAR
- [ ] Testar mensagem "amém" - Deve PARAR (stop rule)
- [ ] Testar mensagem de áudio - Deve ESCALAR

### Monotematicidade

- [ ] Verificar que o cérebro NÃO usa vocabulário de outros nichos
  - RELIGIOSO não menciona dieta/emagrecimento/política
  - POLITICA não menciona oração/igreja/dieta
  - EMAGRECIMENTO não menciona religião/política

---

## Respostas Personalizadas

- [ ] **safe_responses** configurado (mensagens quando algo é bloqueado)
- [ ] **handoff_message** configurado (SEM mencionar equipe/sistema/automação)

---

## Aprovação Final

- [ ] Testado no sandbox com pelo menos 10 mensagens diferentes
- [ ] Revisado por humano antes de ativar
- [ ] Cérebro herda do BASE_ARCHETYPE_TEMPLATE (automático)

---

## Comando para Verificar

```bash
curl http://localhost:3000/api/archetypes/validate \
  -H "Content-Type: application/json" \
  -d '{"persona_name":"Teste","niche":"RELIGIOSO","tone":"pastoral","system_prompt":"..."}'
```

Se retornar `valid: true`, o cérebro está pronto para criação.
