# Estoque de consumíveis (Financeiro → Estoque)

Materiais usados nos eventos presenciais (Teia, Moldura, Certificado, Medalha, Figurinhas…). **Não é patrimônio** e não entra em nenhum cálculo do Financeiro.

## Coleções

| Coleção | Conteúdo | Regras |
|---|---|---|
| `stockMaterials/{id}` | nome, categoria, unidade, `balance`, `defaultPerEvent`, `minLevel`, `active`, `lastMovementId`, `openMissionId` | admin; sem exclusão; `balance` só muda junto com uma movimentação (`lastMovementId` → `stockMovements`, mesmo material, `balanceAfter` igual ao novo saldo) |
| `stockMovements/{id}` | material, tipo, quantidade, `delta`, `balanceAfter`, data, `orderId?`, observação, `createdBy` | admin cria; **imutável** (sem update/delete). Correção = novo ajuste |
| `stockConsumptions/{orderId}` | `status` `consumed`/`reversed`, `cycle`, linhas baixadas | admin; sem exclusão |

Quantidades são inteiras. Tipos: `purchase`, `consumption`, `adjustment_in`, `adjustment_out`, `reversal`.

## Conclusão de evento presencial

"Presencial" = serviço com categoria `Presencial`. `updateOrder` (único ponto que conclui pedidos: Kanban por arrastar, seletor ou botão Concluir) exige `materialConsumption` e, **na mesma transação** do pedido, baixa o estoque. O Kanban abre o formulário de conferência (padrão já preenchido). Sem estoque suficiente a operação inteira é recusada, sem baixa parcial nem saldo negativo.

- Ids determinísticos: `consume_{pedido}_{ciclo}_{material}` → impedem baixa duplicada (cliques repetidos, abas simultâneas).
- Reabrir o pedido gera `reversal_{pedido}_{ciclo}_{material}` devolvendo o consumo; concluir de novo abre um novo ciclo.
- Excluir um pedido concluído **não** devolve materiais (foram usados); o histórico mantém o `orderId`.
- Criar pedido presencial já concluído é barrado (`createOrder`).
- ManyChat só cria serviços digitais; não passa por este fluxo.

## Missões de reposição

Na mesma transação de qualquer movimentação, se `saldo <= minLevel` e o material não tem missão de reposição **pendente** (`openMissionId` apontando para uma missão `pending`), cria-se uma missão em `missions` (`source: 'stock'`, `materialId`). Concluída a missão e caindo de novo, nasce outra.

## Testes

`npm test` (lógica pura) e `npm run test:rules` (emulador: regras, consumo, duplicidade, estorno, missões). O emulador exige Java 21+.

## Conclusão excepcional (estoque insuficiente)

Quem tem papel `admin` ou `superadmin` (e `active: true`) em `/admins/{uid}` pode concluir mesmo com falta, depois de uma confirmação explícita no modal. As regras do Firestore (`canOverrideStock()`) exigem o mesmo critério; o papel `editor` continua bloqueado.

- Baixa-se só o disponível (nunca saldo negativo). A diferença vira `stockPendings/{pedido}_{ciclo}_{material}` (`status: open`), que **não é movimentação**. A movimentação de consumo guarda `requested` e `shortfall`; `stockConsumptions/{pedido}` guarda `exceptional`, `exceptionApprovedBy` e `shortfalls`.
- Material zerado sem movimentação só gera a pendência (e a missão de reposição, se ainda não houver uma pendente).
- Reabrir devolve apenas o que foi baixado e muda as pendências do ciclo para `voided` (permanecem como histórico). Concluir de novo abre outro ciclo.
- Limite das regras: elas garantem quem pode registrar pendências/consumo excepcional e que o saldo nunca fica negativo, mas não conseguem conferir se a quantidade "necessária" informada pelo cliente do app é a real.

## Importação de PDF (Novo pedido)

Ver `services/pdfExtract.js` (texto nativo; OCR por página quando a página não tem texto), `services/pdfFormParser.js` (campos) e `components/admin/ImportPdfPanel.tsx` (revisão). pdf.js e Tesseract são carregados só ao escolher um arquivo; o PDF não sai do navegador nem é armazenado. O Tesseract baixa o motor e o idioma `por` de CDN na primeira execução. O mapeamento **não foi validado com um PDF real do formulário** (nenhum exemplo disponível).
