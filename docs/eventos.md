# Eventos: formulário manual, Financeiro e Google Agenda

Serviços da categoria **Presencial** usam o formulário manual de evento em Kanban → Novo pedido / Editar pedido
(`components/admin/EventOrderFields.tsx`, regras em `services/eventForm.js`). A leitura de PDF foi removida.
Pedidos antigos e os criados pelo ManyChat não mudam: continuam sendo faturados pelo valor do pedido na conclusão.

Dados do formulário ficam em `orders/{id}.eventForm` (+ `childName`, `eventDate`); `content` recebe um resumo legível.
Valor de entrada = 50% do total até ser editado à mão; depois disso é preservado (botão "Recalcular 50%").

## Financeiro

Pedidos de evento têm um livro imutável `financeEntries` (regras em `firestore.rules`), com ID determinístico:

| ID | Quando | Valor | Data |
|---|---|---|---|
| `evt-{pedido}-entry` | criação (mesma transação do pedido) | valor de entrada | criação |
| `evt-{pedido}-final` | **primeira** conclusão | valor total − entrada já lançada (= entrada, no padrão 50%) | conclusão |
| `evt-{pedido}-cost` | **primeira** conclusão | custo, categoria "Despesa evento" | conclusão |

- Cada ID existe no máximo uma vez (create-only nas regras + checagem na transação de `updateOrder`): repetir, reabrir/concluir de novo ou concorrência não duplicam.
- Editar total/entrada/custo depois **não altera** o que já foi lançado (o modal de edição avisa). A 2ª parcela fecha o total sobre a entrada efetivamente lançada.
- Conclusão sem valor total/custo válidos é recusada com erro explícito, sem lançar nada.
- Excluir o pedido remove seus lançamentos (as regras só permitem apagar quando o pedido deixa de existir na mesma transação).
- O Financeiro lê o livro no mesmo listener dos pedidos concluídos (`subscribeCompletedOrders`); "Despesa evento" entra em Despesas e no Extrato.
- **Deploy das regras é pré-requisito**: sem `financeEntries` publicado, criar evento e abrir o Financeiro falham.

## Google Agenda (envio manual)

Botão **Enviar para Google Agenda** nos detalhes do pedido → `POST /api/google-calendar` (`api/google-calendar.ts`,
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
