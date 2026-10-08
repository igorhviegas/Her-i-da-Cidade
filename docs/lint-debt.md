# Dívida de lint (baseline após o burn-down)

Gerado a partir de `bun run lint`. Total: **187 avisos, 0 erros**. Nenhum `eslint-disable` foi adicionado: o que resta aparece como aviso.

Para zerar uma regra, corrija os itens abaixo e promova a regra de `warn` para `error` em `eslint.config.mjs`.

## complexity — 83

Reduzir exige reestruturar ramificações (tabelas de lookup, early returns), não mover código. Fica em `functions/`, `api/` e `services/` (pedidos, financeiro, autenticação, ManyChat, Google Agenda), sem teste de unidade que garanta equivalência.

- `functions/google-calendar.js` (5): linhas 134, 154, 248, 274, 315
- `functions/manychat-handler.js` (5): linhas 49, 120, 177, 218, 254
- `functions/missions-core.js` (5): linhas 65, 156, 260, 315, 388
- `functions/video-call.js` (5): linhas 116, 134, 217, 247, 326
- `functions/instagram-sync.js` (4): linhas 60, 109, 139, 163
- `services/videosService.ts` (4): linhas 22, 115, 204, 387
- `components/admin/AdminDashboard.tsx` (3): linhas 67, 109, 153
- `functions/missions-alexa.js` (3): linhas 65, 113, 181
- `services/ordersService.ts` (3): linhas 40, 122, 302
- `App.tsx` (2): linhas 48, 70
- `api/alexa.ts` (2): linhas 38, 83
- `services/eventFinance.js` (2): linhas 55, 75
- `services/homeContentService.ts` (2): linhas 77, 198
- `services/instagramDaily.js` (2): linhas 20, 58
- `services/serviceCatalog/serviceWrites.ts` (2): linhas 25, 114
- `services/travelCost.js` (2): linhas 34, 73
- `api/calendar-events.ts` (1): linhas 19
- `api/fit-ingest.ts` (1): linhas 14
- `api/google-calendar.ts` (1): linhas 19
- `api/instagram-sync.ts` (1): linhas 16
- `api/manychat.ts` (1): linhas 20
- `api/missions-cron.ts` (1): linhas 12
- `api/travel-route.ts` (1): linhas 26
- `api/upload-thumbnail.ts` (1): linhas 140
- `api/video-call.ts` (1): linhas 18
- `components/admin/AdminContentPage.tsx` (1): linhas 23
- `functions/activity-log.js` (1): linhas 17
- `functions/admin-auth.js` (1): linhas 5
- `functions/firebase-admin.js` (1): linhas 7
- `functions/fit-health.js` (1): linhas 37
- `functions/missions-manychat.js` (1): linhas 13
- `functions/travel-route.js` (1): linhas 89
- `functions/xp.js` (1): linhas 51
- `server.ts` (1): linhas 96
- `services/agentService.ts` (1): linhas 106
- `services/blobUploadService.ts` (1): linhas 8
- `services/clientsService.ts` (1): linhas 133
- `services/contentScriptsService.ts` (1): linhas 139
- `services/eventForm.js` (1): linhas 33
- `services/financeCalculations.js` (1): linhas 170
- `services/fitCheckin.js` (1): linhas 17
- `services/fitRide.js` (1): linhas 16
- `services/fitWorkout.js` (1): linhas 70
- `services/instagramCalendar.js` (1): linhas 26
- `services/orderReference.js` (1): linhas 26
- `services/serviceCatalog/firestoreErrors.ts` (1): linhas 30
- `services/serviceCatalog/serviceDocument.ts` (1): linhas 10
- `services/serviceCatalog/serviceQueries.ts` (1): linhas 16

## @typescript-eslint/no-explicit-any — 47

Tipos reais exigem modelar o formato dos dados (documentos do Firestore, `Request | any` nos handlers de `api/` que aceitam fakes nos testes). Tentado por arquivo: só ficou o que o `tsc` aceitou sem erro novo.

- `services/missionsService.ts` (5): linhas 46, 303, 322, 323, 334
- `api/calendar-events.ts` (4): linhas 20, 21, 39, 39
- `api/alexa.ts` (3): linhas 61, 83, 83
- `api/travel-route.ts` (3): linhas 16, 27, 28
- `lib/firestore.ts` (3): linhas 106, 108, 108
- `services/videosService.ts` (3): linhas 344, 387, 447
- `api/fit-ingest.ts` (2): linhas 15, 16
- `api/google-calendar.ts` (2): linhas 20, 21
- `api/instagram-sync.ts` (2): linhas 17, 18
- `api/manychat.ts` (2): linhas 134, 134
- `api/missions-cron.ts` (2): linhas 13, 14
- `api/video-call.ts` (2): linhas 19, 20
- `server.ts` (2): linhas 134, 162
- `components/admin/AdminFitWorkoutsPage.tsx` (1): linhas 121
- `components/admin/EventOrderFields.tsx` (1): linhas 13
- `functions/firebase-admin.d.ts` (1): linhas 1
- `services/blobUploadService.ts` (1): linhas 40
- `services/categoriesService.ts` (1): linhas 68
- `services/clientsService.ts` (1): linhas 22
- `services/contentScriptsService.ts` (1): linhas 27
- `services/eventFinance.d.ts` (1): linhas 17
- `services/financeCalculations.d.ts` (1): linhas 1
- `services/fitDataService.ts` (1): linhas 14
- `services/serviceCatalog/serviceDocument.ts` (1): linhas 10
- `services/serviceCatalog/serviceWrites.ts` (1): linhas 122

## max-statements — 34

Mesma natureza de `complexity`: o corpo da função precisa ser repensado.

- `functions/manychat-handler.js` (3): linhas 120, 218, 254
- `services/videosService.ts` (3): linhas 115, 204, 387
- `App.tsx` (2): linhas 48, 70
- `components/admin/AdminDashboard.tsx` (2): linhas 109, 153
- `server.ts` (2): linhas 96, 159
- `services/ordersService.ts` (2): linhas 72, 302
- `services/serviceCatalog/serviceWrites.ts` (2): linhas 25, 114
- `api/fit-ingest.ts` (1): linhas 14
- `api/google-calendar.ts` (1): linhas 19
- `api/instagram-sync.ts` (1): linhas 16
- `api/manychat.ts` (1): linhas 20
- `api/travel-route.ts` (1): linhas 26
- `api/upload-thumbnail.ts` (1): linhas 140
- `components/agente/useAgentPlayer.ts` (1): linhas 10
- `functions/instagram-sync.js` (1): linhas 163
- `functions/missions-alexa.js` (1): linhas 113
- `functions/missions-core.js` (1): linhas 260
- `functions/missions-manychat.js` (1): linhas 13
- `functions/video-call.js` (1): linhas 217
- `services/blobUploadService.ts` (1): linhas 8
- `services/instagramCalendar.js` (1): linhas 26
- `services/instagramDaily.js` (1): linhas 20
- `services/missionsService.ts` (1): linhas 349
- `services/serviceCatalog/serviceQueries.ts` (1): linhas 16
- `services/travelCost.js` (1): linhas 34

## quality/max-lines — 12

Arquivos acima de 350 linhas: é o trabalho do prompt 09 (lote seguinte).

- `components/admin/AdminFitWorkoutsPage.tsx` (1): linhas 1
- `functions/google-calendar.js` (1): linhas 1
- `functions/manychat-handler.js` (1): linhas 1
- `functions/manychat-services.test.js` (1): linhas 1
- `functions/missions-core.js` (1): linhas 1
- `functions/missions-core.test.js` (1): linhas 1
- `functions/video-call.js` (1): linhas 1
- `functions/video-call.test.js` (1): linhas 1
- `services/missionsService.ts` (1): linhas 1
- `services/ordersService.ts` (1): linhas 1
- `services/videosService.ts` (1): linhas 1
- `tests/api-instagram-sync.test.js` (1): linhas 1

## max-params — 8

Trocar a assinatura (objeto de opções) altera todos os chamadores: não é mecânico.

- `services/financeCalculations.test.js` (4): linhas 8, 184, 185, 213
- `functions/manychat-handler.js` (1): linhas 12
- `functions/missions-core.js` (1): linhas 390
- `functions/missions-core.test.js` (1): linhas 305
- `services/eventFinance.js` (1): linhas 36

## max-nested-callbacks — 1

Reestruturação de callbacks aninhados.

- `context/XpContext.tsx` (1): linhas 64

## max-lines-per-function — 1

Última função de componente acima de 150 linhas.

- `functions/manychat-handler.js` (1): linhas 218

## max-depth — 1

Reestruturação de aninhamento.

- `server.ts` (1): linhas 137
