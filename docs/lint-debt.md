# Dívida de lint (baseline após o burn-down)

Gerado por `npm run lint:debt` (a partir do ESLint). Total: **237 avisos, 0 erros**. Nenhum `eslint-disable` foi adicionado: o que resta aparece como aviso.

Para zerar uma regra, corrija os itens abaixo e promova a regra de `warn` para `error` em `eslint.config.mjs`.




## complexity — 108

Reduzir exige reestruturar ramificações (tabelas de lookup, early returns), não mover código. Fica em `functions/`, `api/` e `services/` (pedidos, financeiro, autenticação, ManyChat, Google Agenda), sem teste de unidade que garanta equivalência.

- `functions/google-calendar.js` (5): linhas 135, 155, 249, 275, 316
- `functions/manychat-handler.js` (5): linhas 49, 120, 177, 223, 259
- `functions/missions-core.js` (5): linhas 65, 156, 260, 315, 388
- `functions/video-call.js` (5): linhas 116, 134, 217, 247, 327
- `functions/instagram-sync.js` (4): linhas 60, 109, 139, 163
- `services/videosService.ts` (4): linhas 22, 115, 204, 387
- `components/admin/AdminDashboard.tsx` (3): linhas 71, 117, 165
- `functions/missions-alexa.js` (3): linhas 65, 113, 181
- `services/ordersService.ts` (3): linhas 44, 126, 306
- `api/alexa.ts` (2): linhas 38, 83
- `api/calendar-events.ts` (2): linhas 23, 56
- `App.tsx` (2): linhas 55, 81
- `services/eventFinance.js` (2): linhas 55, 75
- `services/homeContentService.ts` (2): linhas 77, 198
- `services/instagramDaily.js` (2): linhas 20, 58
- `services/serviceCatalog/serviceWrites.ts` (2): linhas 25, 114
- `services/travelCost.js` (2): linhas 34, 73
- `api/fit-ingest.ts` (1): linhas 14
- `api/instagram-sync.ts` (1): linhas 29
- `api/manychat.ts` (1): linhas 20
- `api/travel-route.ts` (1): linhas 26
- `api/upload-thumbnail.ts` (1): linhas 109
- `api/video-call.ts` (1): linhas 29
- `components/admin/AdminClientAreaPage.tsx` (1): linhas 28
- `components/admin/AdminContentPage.tsx` (1): linhas 23
- `components/admin/AdminInstagramPage.tsx` (1): linhas 19
- `components/admin/adminPages/KartRaceForm.tsx` (1): linhas 15
- `components/admin/adminPages/ReportsPeriod.tsx` (1): linhas 45
- `components/admin/AdminScriptsPage.tsx` (1): linhas 14
- `components/admin/EditOrderModal.tsx` (1): linhas 30
- `components/admin/FinanceManychat.tsx` (1): linhas 49
- `components/admin/InstagramCalendar.tsx` (1): linhas 76
- `components/admin/instagramPlanning/CampaignForm.tsx` (1): linhas 14
- `components/admin/instagramPlanning/DayPanel.tsx` (1): linhas 14
- `components/admin/instagramPlanning/InstagramCampaigns.tsx` (1): linhas 17
- `components/admin/orders/InviteArtPanel.tsx` (1): linhas 23
- `components/admin/orders/orderDetails.ts` (1): linhas 24
- `components/admin/ordersFlow/useOrderStatus.ts` (1): linhas 56
- `components/admin/TeleprompterModal.tsx` (1): linhas 68
- `components/admin/videoAdmin/AdminTabContent.tsx` (1): linhas 53
- `components/kart/KartApp.tsx` (1): linhas 26
- `components/kart/KartPilotPage.tsx` (1): linhas 102
- `components/kart/KartRacePage.tsx` (1): linhas 18
- `components/kart/KartRanking.tsx` (1): linhas 61
- `functions/activity-log.js` (1): linhas 17
- `functions/admin-auth.js` (1): linhas 5
- `functions/firebase-admin.js` (1): linhas 7
- `functions/fit-health.js` (1): linhas 37
- `functions/missions-manychat.js` (1): linhas 13
- `functions/travel-route.js` (1): linhas 89
- `functions/xp.js` (1): linhas 51
- `services/agentService.ts` (1): linhas 106
- `services/audioRequest.js` (1): linhas 34
- `services/blobUploadService.ts` (1): linhas 8
- `services/clientsService.ts` (1): linhas 133
- `services/contentScriptsService.ts` (1): linhas 180
- `services/eventForm.js` (1): linhas 33
- `services/financeCalculations.js` (1): linhas 176
- `services/fitCheckin.js` (1): linhas 17
- `services/fitRide.js` (1): linhas 16
- `services/fitWorkout.js` (1): linhas 70
- `services/instagramCalendar.js` (1): linhas 28
- `services/instagramPlanning.js` (1): linhas 91
- `services/inviteArt.js` (1): linhas 63
- `services/kartCompare.js` (1): linhas 37
- `services/kartService.ts` (1): linhas 68
- `services/manychatWallet.js` (1): linhas 81
- `services/orderReference.js` (1): linhas 26
- `services/pdfExtract.js` (1): linhas 30
- `services/serviceCatalog/firestoreErrors.ts` (1): linhas 30
- `services/serviceCatalog/serviceDocument.ts` (1): linhas 11
- `services/serviceCatalog/serviceQueries.ts` (1): linhas 16

## @typescript-eslint/no-explicit-any — 54

Tipos reais exigem modelar o formato dos dados (documentos do Firestore, `Request | any` nos handlers de `api/` que aceitam fakes nos testes). Tentado por arquivo: só ficou o que o `tsc` aceitou sem erro novo.

- `api/calendar-events.ts` (6): linhas 24, 25, 26, 44, 44, 58
- `services/reports.d.ts` (6): linhas 36, 37, 41, 41, 47, 49
- `services/missionsService.ts` (5): linhas 46, 303, 322, 323, 334
- `api/video-call.ts` (4): linhas 13, 13, 30, 31
- `api/alexa.ts` (3): linhas 61, 83, 83
- `api/travel-route.ts` (3): linhas 16, 27, 28
- `lib/firestore.ts` (3): linhas 105, 107, 107
- `services/videosService.ts` (3): linhas 344, 387, 447
- `api/fit-ingest.ts` (2): linhas 15, 16
- `api/instagram-sync.ts` (2): linhas 30, 31
- `api/manychat.ts` (2): linhas 134, 134
- `services/pdfExtract.d.ts` (2): linhas 6, 7
- `components/admin/AdminFitWorkoutsPage.tsx` (1): linhas 121
- `components/admin/EventOrderFields.tsx` (1): linhas 13
- `functions/firebase-admin.d.ts` (1): linhas 1
- `server.ts` (1): linhas 21
- `services/blobUploadService.ts` (1): linhas 40
- `services/categoriesService.ts` (1): linhas 68
- `services/clientsService.ts` (1): linhas 22
- `services/contentScriptsService.ts` (1): linhas 28
- `services/eventFinance.d.ts` (1): linhas 17
- `services/financeCalculations.d.ts` (1): linhas 1
- `services/fitDataService.ts` (1): linhas 14
- `services/serviceCatalog/serviceDocument.ts` (1): linhas 11
- `services/serviceCatalog/serviceWrites.ts` (1): linhas 122

## max-statements — 42

Mesma natureza de `complexity`: o corpo da função precisa ser repensado.

- `functions/manychat-handler.js` (3): linhas 120, 223, 259
- `services/videosService.ts` (3): linhas 115, 204, 387
- `App.tsx` (2): linhas 55, 81
- `components/admin/AdminDashboard.tsx` (2): linhas 117, 165
- `components/kart/kartStoryCanvas.ts` (2): linhas 63, 108
- `services/ordersService.ts` (2): linhas 76, 306
- `services/serviceCatalog/serviceWrites.ts` (2): linhas 25, 114
- `api/fit-ingest.ts` (1): linhas 14
- `api/instagram-sync.ts` (1): linhas 29
- `api/manychat.ts` (1): linhas 20
- `api/travel-route.ts` (1): linhas 26
- `api/upload-thumbnail.ts` (1): linhas 109
- `api/video-call.ts` (1): linhas 29
- `components/admin/AdminClientAreaPage.tsx` (1): linhas 28
- `components/admin/AdminInstagramPage.tsx` (1): linhas 19
- `components/admin/AdminMissionsPage.tsx` (1): linhas 44
- `components/admin/EditOrderModal.tsx` (1): linhas 30
- `components/admin/ordersFlow/useOrderStatus.ts` (1): linhas 56
- `components/agente/useAgentPlayer.ts` (1): linhas 11
- `components/publicSite/AudioRequestModal.tsx` (1): linhas 36
- `functions/instagram-sync.js` (1): linhas 163
- `functions/missions-alexa.js` (1): linhas 113
- `functions/missions-core.js` (1): linhas 260
- `functions/missions-manychat.js` (1): linhas 13
- `functions/video-call.js` (1): linhas 217
- `services/blobUploadService.ts` (1): linhas 8
- `services/instagramCalendar.js` (1): linhas 28
- `services/instagramDaily.js` (1): linhas 20
- `services/manychatWallet.js` (1): linhas 81
- `services/missionsService.ts` (1): linhas 349
- `services/pdfExtract.js` (1): linhas 30
- `services/serviceCatalog/serviceQueries.ts` (1): linhas 16
- `services/travelCost.js` (1): linhas 34

## max-params — 16

Trocar a assinatura (objeto de opções) altera todos os chamadores: não é mecânico.

- `services/financeCalculations.test.js` (4): linhas 8, 197, 198, 226
- `services/kart.test.js` (3): linhas 65, 106, 149
- `components/admin/orders/inviteArtCanvas.ts` (2): linhas 47, 55
- `components/kart/kartStoryCanvas.ts` (1): linhas 15
- `functions/manychat-handler.js` (1): linhas 12
- `functions/missions-core.js` (1): linhas 390
- `functions/missions-core.test.js` (1): linhas 305
- `services/eventFinance.js` (1): linhas 36
- `services/instagramPlanning.test.js` (1): linhas 8
- `services/manychatWallet.test.js` (1): linhas 5

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

## max-lines-per-function — 4

Última função de componente acima de 150 linhas.

- `components/admin/AdminClientAreaPage.tsx` (1): linhas 28
- `components/admin/FinanceManychat.tsx` (1): linhas 49
- `components/publicSite/AudioRequestModal.tsx` (1): linhas 36
- `functions/manychat-handler.js` (1): linhas 223

## max-nested-callbacks — 1

Reestruturação de callbacks aninhados.

- `context/XpContext.tsx` (1): linhas 64
