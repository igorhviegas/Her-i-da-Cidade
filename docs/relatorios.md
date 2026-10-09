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

## Relatório mensal
Seção **Relatório mensal**: uma folha por mês (abre no mês anterior; setas trocam de mês) com resumo financeiro e resultado do mês, faturamento por dia, serviços e eventos, clientes atendidos (novos e que já eram clientes), entregas e prazos, Instagram e Fit. **Sem missões nem XP.**
- **Salvar em PDF:** o botão chama a impressão do navegador; no diálogo, escolha “Salvar como PDF”. Durante a impressão só aparece a folha (uma cópia dela fica num portal no `<body>` e o painel, `#root`, é ocultado por CSS).
- **Aviso no sino:** o cron diário de missões (`functions/report-notice.js`) cria `monthly_report_AAAA-MM` ("Relatório de setembro pronto") para o mês anterior; como roda todo dia, uma falha no dia 1º é recuperada no seguinte, e aviso descartado não volta. Clicar abre `/admin/financeiro?relatorio=AAAA-MM` direto nesse mês.
- **Instagram:** ganho de seguidores, curtidas e visualizações são a soma dos saldos diários do mês (só existem desde a 1ª sincronização; a folha diz de quantos dias há dado); publicações e a mais curtida vêm das publicações do mês.
- **Fit:** passos (média dos dias com registro), km, peso (o manual vale mais que o do atalho) e variação no mês, treinos (academia e funcional) e pedaladas. Lê os dados do administrador logado (`users/{uid}`); sem registros, a folha diz que não há.
- **Mês em andamento:** aparece marcado como parcial.

## Rentabilidade
Recortes: este mês, últimos 90 dias, este ano ou tudo. **Só entram os custos que o sistema registra**: custo de edição (R$ 25 do Vídeo Personalizado) e a despesa do evento (que já inclui o deslocamento: o custo do formulário do evento é um valor único). Estoque consumido e tempo gasto **não** entram (o estoque não tem valor unitário e não há registro de horas). Por isso um serviço sem custo registrado mostra margem de 100%.
- **Por serviço:** faturamento, custos, margem, margem % e margem por serviço. Cada parcela conta no mês em que foi lançada (a entrada de um evento pode ter caído em outro mês).
- **Por evento:** eventos concluídos no período, com receita e custo do evento inteiro (entrada, 2ª parcela, ajustes e despesa), mesmo que a entrada tenha sido em outro mês. Mostra quais eventos deram prejuízo.

## Operação
- **Agora, em andamento:** pedidos por etapa, atrasados (prazo ao cliente em dia anterior a hoje) e os que vencem em até 2 dias. Compara por dia de calendário, como o Kanban.
- **Entregas no período:** entregues com prazo, % no prazo, atraso médio dos atrasados, tempo médio do pagamento à conclusão e a lista dos mais atrasados. Pedidos sem prazo ao cliente (eventos, roteiros internos) ficam de fora.
- **Tempo em cada etapa do Kanban:** média das etapas já encerradas (Agendado, Gravação, Edição, Entrega) e os pedidos parados há mais tempo na etapa atual. Vem de `orders/{id}.stageHistory`, que `updateOrder` grava a cada mudança de etapa (`{ from, to, at }`; repetir o status ou editar outro campo não grava; reabrir conta). Só pedidos criados a partir de `STAGE_TRACKING_SINCE` (`services/reports.js`, 10/10/2026) são medidos: antes dessa data as mudanças não eram guardadas. Tempo em Concluído não é etapa de trabalho. A hora vem do aparelho de quem mudou a etapa (`serverTimestamp` não vale dentro de array).

## Sazonalidade
Faturamento médio por mês do ano, só com **meses completos** (o mês em andamento fica fora das médias, mas aparece na tabela por ano com `*`). Mês sem faturamento conta zero. A classificação compara cada mês com o **mês típico (mediana)**, não com a média, para que poucos meses muito fortes não façam o resto parecer fraco: ≥ 115% = Forte, ≤ 85% = Fraco. Com menos de 12 meses de histórico a tela avisa que pode ser acaso.

## Clientes
- **Voltaram:** clientes com 2 ou mais pedidos. **Valor por cliente (LTV):** faturamento médio por cliente. **Entre um pedido e outro:** mediana, em dias ou meses, de quem voltou.
- **Hora de reativar:** última compra há 10 a 14 meses (perto do próximo aniversário), maior valor primeiro.
- Pedidos internos de roteiro não entram.
