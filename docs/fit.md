# Fit — Apple Saúde (recebimento dos totais diários + tela)

O servidor grava os totais diários (abaixo) e a tela **Fit** (`/admin/fit`, menu Pessoal → Fit) os lê: passos, distância e peso em 7, 30 ou 90 dias.

## Tela (`components/admin/AdminFitPage.tsx`)
- Indicadores: último dia com passos (o de hoje é parcial), média de passos, distância total e peso com a variação do período. Gráficos de passos e distância por dia (barras) e de peso (pontos + média móvel de 7 dias), em SVG, sem biblioteca.
- Dia sem registro aparece apagado e fica fora das médias: **ausente não é zero**. As séries e médias são puras e testadas (`services/fitDaily.js`).
- Somente leitura; os dados vêm de `users/{uid}/fitDaily` (`services/fitService.ts`).

## Privacidade (`firestore.rules`)
`match /users/{uid}/fitDaily/{day}`: lê só quem é administrador **e** dono do caminho (`request.auth.uid == uid`); nenhum cliente grava. Outro administrador não lê os dados do dono. Qualquer outro caminho sob `users/` segue negado. Verificado no emulador (14 casos: dono, outro admin, usuário comum, visitante, escrita e outros caminhos); o teste versionado é `tests/firestore-rules-fit.test.js` (`npm run test:rules`). **É preciso publicar o `firestore.rules`** para a tela conseguir ler.

## Fluxo
Apple Saúde → app **Health Auto Export** (automação REST) → `POST /api/fit-ingest` → `users/{FIT_OWNER_UID}/fitDaily/{AAAA-MM-DD}`.

- Autenticação: `Authorization: Bearer $FIT_INGEST_TOKEN` (comparação em tempo constante). O token só **escreve**; não lê nada.
- O dono vem de `FIT_OWNER_UID` (UID do Firebase Auth), nunca do payload: um payload com outro `uid` ou caminho é ignorado.
- Upsert por dia com `merge`: o que veio sobrescreve (o dia de hoje chega parcial e depois completo; nunca soma), o que não veio é preservado. Reenviar o mesmo período é seguro.
- A resposta traz só contagens (`days`, `accepted`, `ignoredMetrics`, `invalid`, `workoutsIgnored`); nem a resposta nem os logs trazem dado de saúde.

## O que é guardado (`functions/fit-health.js`)
| Métrica do app | Campo | Unidades aceitas |
|---|---|---|
| `step_count` | `steps` | count |
| `walking_running_distance` | `walkRunKm` | km, m, mi |
| `cycling_distance` | `cyclingKm` | km, m, mi |
| `active_energy` / `basal_energy_burned` | `activeKcal` / `basalKcal` | kcal, kJ |
| `apple_exercise_time` | `exerciseMin` | min |
| `weight_body_mass` | `weightKg` | kg, lb (última pesagem do dia) |

Qualquer outra métrica (marcha, velocidade, lances de escada…) é descartada. Dia sem registro fica sem o campo (ausente ≠ zero). O dia é o **local** do texto da data (`2026-10-07 00:00:00 -0300` → `2026-10-07`), sem converter para UTC. Valores fora do plausível, unidade desconhecida ou métrica diária não resumida são descartados e contados em `invalid`.

**Treinos (`workouts`) não são gravados**: o formato real ainda não foi validado (o export de teste não tinha nenhum). Só são contados em `workoutsIgnored`.

## Ativar
1. Gerar um segredo aleatório de 32+ caracteres e definir na Vercel `FIT_INGEST_TOKEN` e `FIT_OWNER_UID` (UID do seu usuário no Firebase Auth, o mesmo de `admins/{uid}`). Republicar.
2. No Health Auto Export: *Automations → REST API* (Premium ou teste de 7 dias):
   - URL: `https://<seu-domínio>/api/fit-ingest`
   - Cabeçalho: `Authorization` = `Bearer <FIT_INGEST_TOKEN>`
   - Formato JSON, **versão 2**, **Summarize Data ligado** (totais por dia; sem isso as métricas diárias são descartadas), agrupamento por dia.
   - Métricas: as da tabela. Período: "Previous 7 Days" ou "Default".
3. Rodar manualmente pelo widget e conferir a resposta (`ok: true`, `days > 0`) e o Firestore.

## Limites conhecidos
- O iOS só deixa o app ler o Saúde com o iPhone **desbloqueado** e não garante o horário: o envio é eventual, não em tempo real.
- Dois envios fora de ordem: vale o último a chegar (não há carimbo de envio no payload).
- Duas fontes separadas no mesmo dia (ex.: iPhone e Watch): fica a maior para não contar passos duas vezes. **Não validado** com dados reais (só há iPhone).
- No `npm run dev` o Express limita o corpo a 100 KB (`express.json`); na Vercel o limite é maior.
- Na Vercel, `api/` agora tem 11 funções (o plano Hobby limita o total; confirmar o limite vigente).

## Próximos passos
Check-ins de academia e funcional, peso manual, upload do FIT do MyWhoosh (histórico de ciclismo), formato de treinos quando houver um real, deduplicação entre fontes (mesma atividade vinda de FIT, Strava e Saúde: chave por fonte + id; entre fontes, esporte + início em UTC + duração).
