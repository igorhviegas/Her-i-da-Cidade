# Módulo Missões: operação

## Rotina diária (Vercel Cron, gratuito)

`vercel.json` agenda `GET /api/missions-cron` às `0 3 * * *` (03:00 UTC = 00:00 de Brasília). O endpoint (`api/missions-cron.ts`) roda `runMissionsSync`: gera as ocorrências do dia, marca as perdidas e cria os avisos de missões e tarefas.

Para ativar:

1. Na Vercel, em *Settings → Environment Variables*, crie `CRON_SECRET` (string aleatória de 16+ caracteres). A Vercel o envia como `Authorization: Bearer <CRON_SECRET>`. Sem a variável, o endpoint responde 500 e não executa.
2. As credenciais do Firebase Admin já usadas por `/api/manychat` (`FIREBASE_SERVICE_ACCOUNT_KEY` ou equivalentes) também são usadas aqui.
3. Faça o deploy. Em *Settings → Cron Jobs* o job deve aparecer. Os logs ficam em *Logs*, filtrando por `/api/missions-cron`.

Limitações:

- No plano **Hobby** o cron roda no máximo 1×/dia e a Vercel pode disparar em qualquer minuto da hora marcada (entre 00:00 e 00:59 de Brasília). A entrega é *best effort* e pode, raramente, falhar ou duplicar.
- A rotina é idempotente (ID da ocorrência = `tarefa_data`) e recupera dias perdidos até 62 dias; por isso atraso, falha ou duplicidade não geram dados errados.
- Quando o CRM é aberto (e a cada 10 minutos com ele aberto) a mesma sincronização roda no navegador. Se o cron falhar, o efeito só aparece ao abrir o CRM.
- Não há função agendada no Firebase: o cron da Vercel é o único agendador (Cloud Scheduler exigiria o plano Blaze). `functions/missions-sync.js` é a rotina compartilhada, chamada por `/api/missions-cron`.

## Histórico de atividades (`activityLog`)

Cada atividade concluída vira um documento permanente, criado uma única vez (ID = `tipo_referência`) e que as regras do Firestore não deixam alterar nem apagar. Ele guarda `difficulty` como retrato do momento da conclusão (configuração em `siteConfig/gamification`). O registro é gravado na mesma transação da conclusão.

| Tipo | Quando | Dificuldade |
|---|---|---|
| `order_completed` | primeira vez que o pedido fica Concluído (manual, quadro, ManyChat) | `service_<serviceId>` |
| `script_ready` | primeira vez que o roteiro fica Pronto para gravar | `script_created` |
| `mission` | missão concluída | da própria missão |
| `task_occurrence` | ocorrência de tarefa concluída | da própria tarefa |
| `goal_completed` | meta atingida no ciclo | — |

Reabrir e concluir de novo, editar ou excluir o pedido/roteiro/missão de origem não altera nem remove o registro. Pedidos e roteiros concluídos **antes** deste recurso não têm registro (não houve preenchimento retroativo).
