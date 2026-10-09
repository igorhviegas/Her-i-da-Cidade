# Relatórios (Financeiro → Relatórios)

Aba do Financeiro com relatórios de dinheiro e clientes. **Missões e XP ficam de fora de propósito.** Cálculos puros em `services/reports.js` (testados em `services/reports.test.js`), sobre os mesmos itens do Financeiro (`buildRevenueEntries`: pedidos concluídos e o livro de eventos). Não há leitura nova no Firestore: usa o listener que o Financeiro já mantém.

## Dia, semana e mês
Seletor Dia / Semana / Mês, com setas e "Hoje" (independente do seletor de mês do topo da página). Semana = segunda a domingo.

| Número | Definição |
|---|---|
| Faturamento | Soma dos itens com data de faturamento no período (a mesma regra do Resumo: conclusão, ou eventos pelo livro). |
| Serviços | Pedidos distintos no período. Entrada e 2ª parcela de um evento contam como **um** serviço; ajuste de receita não conta. |
| Ticket médio | Faturamento ÷ serviços do período. Evento dividido entre dois meses entra nos dois (parcial em cada). |
| Custos | Custo de edição (Vídeo Personalizado) + despesas de eventos do livro. No **mês**, soma também as despesas fixas. |
| Resultado | Faturamento − custos. Em dia e semana **não há despesas fixas** (são mensais): o resultado é operacional. |
| vs. período anterior | Variação do faturamento e dos serviços contra o dia/semana/mês imediatamente anterior. |

## Sazonalidade
Faturamento médio por mês do ano, só com **meses completos** (o mês em andamento fica fora das médias, mas aparece na tabela por ano com `*`). Mês sem faturamento conta zero. A classificação compara cada mês com o **mês típico (mediana)**, não com a média, para que poucos meses muito fortes não façam o resto parecer fraco: ≥ 115% = Forte, ≤ 85% = Fraco. Com menos de 12 meses de histórico a tela avisa que pode ser acaso.

## Clientes
- **Voltaram:** clientes com 2 ou mais pedidos. **Valor por cliente (LTV):** faturamento médio por cliente. **Entre um pedido e outro:** mediana, em dias ou meses, de quem voltou.
- **Hora de reativar:** última compra há 10 a 14 meses (perto do próximo aniversário), maior valor primeiro.
- Pedidos internos de roteiro não entram.

## Ainda não feito
- **Rentabilidade por serviço e por evento:** hoje só existem o custo de edição (R$ 25 fixo) e o custo digitado no formulário do evento. Estoque consumido (sem valor unitário nos materiais), deslocamento (não é gravado por pedido) e tempo gasto (não existe) dependem de novos campos.
- **Saúde operacional:** prazo médio de entrega e atrasados saem dos dados atuais; "tempo parado em cada etapa" exige gravar a data de cada mudança de etapa a partir de agora (o histórico não existe).
- **Relatório mensal em PDF** com Instagram e Fit.
