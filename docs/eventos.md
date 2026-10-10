# Eventos: formulário manual, Financeiro e Google Agenda

Serviços da categoria **Presencial** usam o formulário manual de evento em Kanban → Novo pedido / Editar pedido
(`components/admin/EventOrderFields.tsx`, regras em `services/eventForm.js`). A leitura de PDF foi removida.
Campos opcionais: data de nascimento e PCD/PNE (`eventForm.birthDate` / `pcd`); o PCD aparece na descrição do Google Agenda quando "Sim".
Pedidos antigos e os criados pelo ManyChat não mudam: continuam sendo faturados pelo valor do pedido na conclusão.

Dados do formulário ficam em `orders/{id}.eventForm` (+ `childName`, `eventDate`); `content` recebe um resumo legível.
Valor de entrada = 50% do total até ser editado à mão; depois disso é preservado (botão "Recalcular 50%").

Pedidos presenciais criados pelo ManyChat (só cliente e WhatsApp) entram como rascunho (`eventDraft`); ver `docs/manychat-integration.md`. O formulário do evento completa o pedido, e a entrada é lançada nesse momento.

## Importar formulário (PDF) e vídeos com desconto

No Novo pedido de um serviço Presencial, **Importar formulário (PDF)** lê o PDF do "Formulário da Missão" (Google Forms impresso) no navegador (`pdfjs-dist`, sem OCR; `services/eventFormImport.js`) e só preenche o formulário; nada é criado até **Criar Pedido**. Preenche: aniversariante, nascimento, data, horário, local, nome do responsável (cliente, se vazio) e os vídeos. **Não lê** o que é opção marcada no PDF (tipo do evento/#formulário, PCD, autorização de imagem, teias extras) nem o WhatsApp, que o formulário não traz: continuam manuais.

O mesmo botão e a seção de vídeos existem em **Editar pedido** de eventos (inclusive o rascunho do ManyChat): ao editar, o importador **nunca altera cliente nem WhatsApp**, só os campos do evento, e os vídeos marcados viram pedidos ao salvar.

Seção **Vídeos com desconto**: cada vídeo marcado (Especial de Aniversário, Convite) cria, depois do evento, um pedido próprio com **R$ 0,00** (o valor já está no total do evento), pago hoje, com o status inicial e o prazo do serviço. O serviço é achado pelo título (`Vídeo Especial de Aniversário`, `Vídeo Convite`) e precisa estar ativo e configurado. Se o evento for criado e um vídeo falhar, o aviso diz qual criar à mão. Esses pedidos não geram lançamento no livro de eventos.

## Financeiro

Pedidos de evento têm um livro imutável `financeEntries` (regras em `firestore.rules`), com ID determinístico:

| ID | Quando | Valor | Data |
|---|---|---|---|
| `evt-{pedido}-entry` | criação (mesma transação do pedido) | valor de entrada | criação |
| `evt-{pedido}-final` | **primeira** conclusão | valor total − entrada já lançada (= entrada, no padrão 50%) | conclusão |
| `evt-{pedido}-cost` | **primeira** conclusão | custo, categoria "Despesa evento" | conclusão |

- Cada ID existe no máximo uma vez (create-only nas regras + checagem na transação de `updateOrder`): repetir, reabrir/concluir de novo ou concorrência não duplicam.
- **Alterar valores depois dos lançamentos gera AJUSTES**, nunca reescreve o histórico. Ao salvar a edição, a diferença entra como nova linha com sinal, datada do momento da alteração (o Financeiro do mês da alteração reflete o novo valor), e o modal pede confirmação mostrando o que será lançado:
  - `evt-{pedido}-adjrev-{n}` (receita) e `evt-{pedido}-adjcost-{n}` (Despesa evento); `n` é um contador no pedido (`eventLedger.seq`), então a mesma alteração nunca é lançada duas vezes.
  - **Antes da conclusão** só a entrada conta: mudar a entrada ajusta a receita. **Depois da conclusão** a receita total passa a ser o valor total (entrada + 2ª parcela + ajustes) e a despesa, o custo atual.
  - A 2ª parcela da conclusão fecha o total sobre a entrada efetiva (entrada + ajustes).
  - No Extrato os ajustes aparecem como "Ajuste de receita" / "Ajuste de Despesa evento"; ajuste que reduz receita aparece como saída e o que reduz despesa, como entrada. Não contam como serviço a mais.
  - Excluir o pedido remove todos os seus lançamentos, ajustes incluídos.
- Conclusão sem valor total/custo válidos é recusada com erro explícito, sem lançar nada.
- Excluir o pedido remove seus lançamentos (as regras só permitem apagar quando o pedido deixa de existir na mesma transação).
- O Financeiro lê o livro no mesmo listener dos pedidos concluídos (`subscribeCompletedOrders`); "Despesa evento" entra em Despesas e no Extrato.
- **Deploy das regras é pré-requisito**: sem `financeEntries` publicado, criar evento e abrir o Financeiro falham.

## Google Agenda (envio manual)

Botão **Enviar para Google Agenda** nos detalhes do pedido → `POST /api/calendar-events` com `{ action: 'sync', orderId }` (`api/calendar-events.ts`,
`functions/google-calendar.js`). O servidor valida o administrador, lê o pedido salvo e chama a Calendar API v3 com uma
conta de serviço; só responde sucesso depois da confirmação do Google. O ID do evento é derivado do ID do pedido, então
reenviar atualiza o mesmo evento (e `orders/{id}.googleCalendar` guarda `eventId`, `calendarId`, `htmlLink`, `syncedAt`).

Pré-requisitos externos (não dá para fazer pelo código):

1. No Google Cloud do projeto, **ativar a Google Calendar API**.
2. Usar uma conta de serviço (pode ser a do Firebase Admin, `FIREBASE_SERVICE_ACCOUNT_KEY`, ou outra em `GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY`).
3. **Compartilhar a agenda** com o e-mail da conta de serviço, com permissão "Fazer alterações em eventos".
4. Definir `GOOGLE_CALENDAR_ID` (Configurações da agenda → ID da agenda) e a chave (JSON ou Base64) na Vercel. Nunca no frontend.

Erros (credencial ausente, sem permissão, agenda não encontrada, limite, indisponibilidade) aparecem no botão com mensagem própria.
Fuso: `America/Sao_Paulo`; duração fixa de 1 hora a partir do horário de início.

## Módulo Calendário (`/admin/calendario`)

Item fixo do menu, logo abaixo de Principal. Visualizações mês/semana/dia, destaque "Compromissos do dia" no topo (acompanha a data selecionada), busca e Novo evento/editar/excluir. Usa a **mesma** conta de serviço, `GOOGLE_CALENDAR_ID` e escopo do envio de pedidos (nenhuma credencial nova).

- API: `POST /api/calendar-events` (`api/calendar-events.ts`, `functions/google-calendar.js`) com `action` = `list | create | update | delete`, só para administradores. Só responde ok depois da confirmação do Google; erros viram mensagens claras.
- Eventos criados no módulo são independentes: nada é gravado no Firestore (sem pedido, missão ou lançamento). Edição usa `PATCH`, exclusão usa `DELETE` (410 = já excluído conta como concluído).
- Eventos de pedidos são reconhecidos pelo ID (`hc` + sha1). **Não existe sincronização da agenda para o pedido** (o fluxo é só pedido → Google): editar/excluir o evento aqui não altera o pedido, e reenviar o pedido pelo Kanban recria/sobrescreve o evento. A tela avisa isso. Excluir um evento nunca apaga pedido, missão ou lançamento.
- Busca: o parâmetro `q` do Google procura em título, descrição (onde estão cliente e criança nos eventos de pedido), local e participantes, sempre dentro de um período (padrão: 3 meses atrás a 10 meses à frente; máx. 400 dias por consulta).
- Limites: 250 eventos por página, até 5 páginas por consulta (1250); acima disso a tela avisa que o resultado é parcial. Eventos de vários dias aparecem em todos os dias, mas só se editam no Google Agenda.
- Cache: o navegador guarda cada período por 2 minutos (`services/calendarService.ts`), compartilhado entre o widget da Principal e o Calendário; editar, excluir ou enviar um pedido ao Google Agenda invalida o cache e recarrega. Não há polling.
