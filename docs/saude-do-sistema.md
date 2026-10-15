# Saúde do sistema e mensagens de WhatsApp

## Cartão "Saúde do sistema" (Principal)

Mostra, com cor e "há quanto tempo", se as rotinas que rodam sozinhas estão em dia. Entra no fim da ordem dos widgets da Principal (a ordem que você já salvou não muda; dá para reorganizar em "Reorganizar").

| Linha | De onde vem | Atenção | Problema |
|---|---|---|---|
| Rotina diária (missões e avisos) | `systemStatus/missions`, gravado pelo cron `/api/instagram-sync?job=missions` | sem execução há 36 h | sem execução há 72 h, ou a última falhou (mostra o motivo) |
| Instagram | `instagramMeta/profile` (`syncedAt`, `lastError`) | última sincronização há 36 h | há 72 h, ou token inválido |
| Token do Instagram | `tokenExpiresAt` | 15 dias ou menos | 3 dias ou menos, ou expirado |
| Backup do banco | `systemStatus/backup`: o cron lista os backups pela Firestore Admin API | último backup há 36 h | há 72 h, ou nenhum backup |
| Avaliações do Google | teste de `/api/reviews` ao abrir o painel | sem resposta (o site mostra só o link) | |

Cinza = sem informação (não conta para o nível geral): é o que aparece até a primeira rotina depois do deploy, ou quando o backup não pôde ser conferido.

### Como funciona
- O cron das 00:00 (Brasília) registra `systemStatus/missions` (`ok`, `lastRunAt`, `lastOkAt`, `detail`) e `systemStatus/backup` (`latestAt`, `count`). `functions/system-status.js`; **nunca derruba a rotina**: se registrar falhar, a rotina segue igual e a resposta não muda.
- O registro só é gravado se houver credencial do servidor configurada (`hasAdminCredentials`), então testes e ambientes sem credencial não tentam o Firestore.
- Regras: `systemStatus` é **somente leitura para administradores**; só o servidor (Admin SDK) grava.

### Backup "Não verificado"
O cron usa a mesma conta de serviço do Admin SDK (`FIREBASE_SERVICE_ACCOUNT_KEY`) para listar os backups. Se o cartão mostrar *"a conta de serviço não pode listar backups"*, conceda a ela o papel **Visualizador de backups do Cloud Datastore** (`roles/datastore.backupsViewer`) no projeto `heroi-da-cidade` (Google Cloud → IAM). Sem isso o backup continua sendo feito normalmente; só deixa de ser conferido aqui.

## Mensagens de WhatsApp prontas (`services/clientMessages.js`)

Os botões só **abrem o WhatsApp do cliente com a mensagem pronta** (`wa.me`); quem aperta "enviar" é você. Sem telefone válido, o botão não aparece. Usam a mesma regra de telefone do envio de entrega (`whatsappPhone`, inclusive número internacional com `+`).

- **Reativação:** Financeiro → Relatórios → Clientes → "Hora de reativar" → botão **Chamar** (clientes cuja última compra foi há 10 a 14 meses).
- **Pedido de avaliação:** no pedido **concluído**, botão **Pedir avaliação** (rodapé dos detalhes do pedido). A mensagem leva o link de avaliação do Google (`GOOGLE_REVIEW_URL`) e o nome da criança, quando houver.

Para mudar o texto das mensagens, edite `reactivationMessage` e `reviewRequestMessage` em `services/clientMessages.js` (testadas em `services/clientMessages.test.js`).
