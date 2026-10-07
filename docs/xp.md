# Perfil, XP e níveis (Painel Admin)

O avatar do topo abre `/admin/perfil` ("Ficha do Herói"): nome de exibição (Firebase Auth `updateProfile`, usado em "Olá, {nome}!"), nível, XP e atributos (seguidores, faturamento, gastos, missões, metas, pedidos), todos lidos das fontes reais. Faturamento e gastos têm ocultar/mostrar (mesma preferência do indicador do topo).

## Regras (`functions/xp.js`)
| Origem | XP |
|---|---|
| Pedido concluído | valor do pedido (`totalPaid`) × 10; pedido interno de roteiro vale 0 |
| Conteúdo publicado (`contentScripts.publicationStatus = published`) | 2.000 |
| Instagram | visualização 1, curtida 2, comentário 3, seguidor 10 |
| Missão, tarefa e roteiro pronto | pela dificuldade: 1=100, 2=250, 3=500, 4=750, 5=1.000 |
| Meta atingida | mensal 5.000, semanal 1.000, diária 100 |

Nível: o nível 1 custa 500 XP e cada nível custa 25% a mais que o anterior (`500 × 1,25^(N−1)`), sem limite. O nível é derivado do XP total; nada de nível é gravado.

## Como o XP é guardado
`XP total = xpBaseline/main + eventos do activityLog posteriores à criação dele`.

- **Linha de base (`xpBaseline/main`)**: botão "Calcular XP inicial" no Perfil soma todo o histórico existente (Instagram conta 100%: seguidores e o acumulado de views/curtidas/comentários de todos os posts já sincronizados) e grava **uma única vez** (as regras negam alteração/exclusão). Guarda também os IDs de pedidos e conteúdos já contados, para que reabrir e concluir de novo um pedido antigo não pague duas vezes.
- **Eventos (`activityLog`)**: pedidos (com `meta.value`), missões, tarefas, roteiros, metas (com `meta.period`) e conteúdo publicado (`content_published`, um por roteiro) já são gravados na mesma transação da ação, com ID determinístico, uma única vez; editar ou excluir a origem não altera o XP. O XP de cada evento é calculado na leitura (`xpOfEvent`); mudar um peso reescreve o histórico dos eventos.
- **Instagram**: a sincronização (servidor) só premia o que **subiu** desde a anterior (por publicação, comparando com o valor guardado antes de sobrescrever) e os seguidores acima do maior valor já premiado (`instagramPrivate/xp`). Queda não tira XP; cair e voltar não paga de novo; métrica ausente nunca vira 0. O XP do dia fica em `activityLog/instagram_AAAA-MM-DD`. Sem baseline, nada é premiado.

## Para ativar
1. Publicar `firestore.rules` (nova regra `xpBaseline`).
2. Fazer o deploy.
3. Abrir `/admin/perfil` e confirmar "Ativar com este XP".

Limites conhecidos: o histórico de missões, tarefas e metas só existe desde 02/10/2026; o histórico do Instagram é o último valor por publicação (não há série temporal); falha ao calcular o XP numa sincronização do Instagram não derruba a sincronização e aquela rodada de XP se perde.
