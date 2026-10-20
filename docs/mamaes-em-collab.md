# Mamães em Collab

Parcerias com mães criadoras de conteúdo: ficha de cada criadora, formulário próprio, cupom de R$ 5 por 30 dias e comissão de R$ 3 por venda.

## Onde fica

| Peça | Arquivo |
|---|---|
| Regras (cupom, validade, comissões, vagas, formulário) | `services/collab.js` (+ testes em `services/collab.test.js`) |
| Painel Admin → CRM → Mamães em Collab (`/admin/collab`) | `components/admin/collab/` + `services/collabService.ts` |
| Formulário público `/mamaes-em-collab` (link privado, `noindex`) | `components/CollabFormPage.tsx`; gravação em `functions/collab.js` via `POST /api/event-form` com `action: 'collab'` |
| Cupom no pagamento do ManyChat | `functions/manychat-handler.js` (campo `coupon`; ver `docs/manychat-integration.md`) |
| Comissão como custo no Financeiro | `services/financeCalculations.js` (`collabCostForMonth`) e `services/reports.js` |

Dados: `collabPartners` (fichas), `collabPayouts` (comissões pagas, `parceira_segunda-feira`), `siteConfig/collab` (limites de vagas) e, nos pedidos, `collab` (cupom usado) e `collabGrant` (benefício concedido). Tudo só para administradores (`firestore.rules`); o formulário grava pelo servidor.

## Fluxo

1. **Ficha**: a equipe cadastra a criadora (Nova parceira) ou envia o link do formulário (botão "Link do formulário"). O envio cria a ficha como "Formulário recebido", ou atualiza a ficha que já existia com o mesmo WhatsApp ou @ (sem mexer em status, cupom e notas).
2. **Seleção**: critérios marcados à mão na ficha; sem pontuação.
3. **Benefício**: "Conceder serviço" na ficha abre um pedido sem valor no Kanban para a criadora e ocupa uma vaga (aba Vagas; limites editáveis).
4. **Collab**: datas na ficha. Condições definidas → prazo de produção (+15 dias). Reel publicado → validade do cupom e permanência mínima (+30 dias).
5. **Cupom**: o código da ficha é o mesmo do campo CUPOM no ManyChat. A aba Cupons mostra quanto falta para cada um vencer (amarelo: 7 dias ou menos).
6. **Vendas**: o pagamento com cupom chega pelo ManyChat já com o desconto e a comissão; ver avisos no topo do painel.
7. **Comissões (semanal, manual)**: aba Comissões, semana de segunda a domingo pela data de **conclusão** do pedido. "Enviar relatório" abre o WhatsApp da criadora com o resumo (data, serviço e comissão; nenhum dado do cliente). Depois do Pix, "Marcar como pago". Venda paga não volta como pendente.

## Regras de valor

- Desconto: R$ 5 sai do valor pago (`totalPaid`); o faturamento é o que entrou no caixa.
- Comissão: R$ 3 por pedido com cupom de uma parceira, contada como custo no mês/semana da conclusão (como o custo de edição). Reabrir e concluir de novo não duplica.
- Cupom vencido, usado antes do Reel, de parceira cancelada ou desconhecido: o pedido entra normalmente e aparece em "Avisos de cupom" para a equipe decidir (manter/vincular ou sem comissão).
- Evento presencial com cupom: só registra; o desconto é abatido no valor do evento, sem comissão automática.
- Valores fixos em `services/collab.js` (`COLLAB_DISCOUNT`, `COLLAB_COMMISSION`); cada pedido guarda os valores do dia, então mudar a constante não altera o passado.

## Pendências

- O termo do formulário (`TERMS_SECTIONS`, versão `minuta-2026-10`) é **minuta**: precisa da revisão do jurídico antes de enviar o link às criadoras. Ao trocar o texto, trocar também `TERMS_VERSION`.
- Comissão de pedido de evento presencial não é automática (o evento é faturado pelo livro de lançamentos).
