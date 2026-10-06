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

## Checklist nas missões

Missões (To-do list) aceitam um checklist opcional (`missions/{id}.checklist = [{ id, text, done }]`). No formulário: "Adicionar checklist", itens editáveis/removíveis e "+ Adicionar item"; na lista, cada item pode ser marcado/desmarcado direto (transação em `toggleChecklistItem`). Concluir a missão não depende dos itens. Missões sem checklist não mudam; recorrência, dificuldade e pontuação não foram alteradas.

## Missão automática "Check list do evento"

A rotina diária (`/api/missions-cron` → `runMissionsSync` → `functions/event-missions.js`) cria, no dia de cada evento presencial **completo** (`eventForm` preenchido e sem `eventDraft`), a missão "Check list do evento" (dificuldade 1, prazo = data + horário do evento em Brasília, checklist com Traje, Certificados, Medalhas, Figurinhas, Microfone, Faceshell e Caixa de som, todos desmarcados). Vem de `orders` com `eventDate` no dia atual; eventos independentes do Calendário não passam por aqui.

- Sem duplicidade: ID `missions/evento-checklist-{pedidoId}` criado com `create()` (falha se existir). Rodar de novo, editar/reabrir o pedido ou concluir a missão não cria outra. Eventos futuros só geram missão no próprio dia.
- Data alterada depois: o prazo da missão pendente é remarcado só quando a data do evento muda; o checklist nunca é sobrescrito. Se a data for alterada para hoje antes de existir missão, ela é criada no próximo ciclo.
- Pedido excluído depois da criação: a missão é mantida (com o progresso) e marcada `orderState: 'deleted'` (selo "Pedido excluído"); apagar é decisão do usuário. Não há status "cancelado" em pedidos.
- Se o pedido for excluído/alterado antes do dia, nada é criado.
- Sem nova configuração: reutiliza o cron e o `CRON_SECRET` já existentes. Se a execução do dia falhar, rode de novo (idempotente) com `curl -H "Authorization: Bearer $CRON_SECRET" https://<domínio>/api/missions-cron` no mesmo dia. Limitação: não há catch-up ao abrir o CRM; no plano Hobby o cron roda em qualquer minuto entre 00:00 e 00:59. Excluir a missão no dia do evento e o cron disparar duplicado nesse mesmo dia pode recriá-la.

## Metas automáticas do Instagram

Usam só os dados que a sincronização do Instagram já grava no Firestore (`instagramMeta/profile`, `instagramPosts`, `instagramStats`); o CRM nunca chama a Meta.

| Indicador | O que conta no ciclo |
|---|---|
| Ganho de seguidores | seguidores atuais − retrato diário do primeiro dia do ciclo (`instagramStats`); pode ser negativo |
| Publicações feitas | publicações com data dentro do ciclo |
| Curtidas / comentários / visualizações | soma dos totais atuais das **publicações feitas dentro do ciclo** (métrica ausente fica fora da soma) |

- O retrato diário (`instagramStats/{dia}`) é a referência de seguidores da 1ª sincronização de cada dia, gravada uma única vez pelo servidor. Se o 1º retrato do ciclo é posterior ao início, a meta mostra "contando desde dd/mm". Antes do primeiro retrato (ou do primeiro sync) a meta mostra o aviso e valor 0. **O histórico só existe a partir da publicação desta versão.**
- Limites da fonte: só as últimas 100 publicações sincronizadas; o total de cada publicação continua crescendo depois do ciclo; o valor só muda quando a sincronização roda (cron 00:00 e 09:00 UTC, ou "Sincronizar agora"). Cada meta mostra a data/hora dos dados do Instagram.
- Publicar `firestore.rules` com a nova regra `instagramStats` (leitura admin, escrita `false`) antes de usar o indicador de seguidores; sem ela a leitura é negada.
