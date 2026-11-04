# Google · Perfil da Empresa (admin → Google)

Aba do painel que espelha no Firestore as **avaliações** e o **desempenho** do Perfil da Empresa (visualizações, ligações, cliques no site e pedidos de rota). **Fase 1: somente leitura.** Responder avaliações e publicar postagens/fotos são as fases 2 e 3 (ainda não feitas); por ora o botão "Responder no Google" abre o painel do próprio Google.

Mesmo desenho do Instagram (`docs/instagram.md`): o servidor grava, o painel só lê.

## Fluxo
- `POST /api/google-business` (botão "Sincronizar agora"): exige ID token de administrador; intervalo mínimo de 60 s entre tentativas. Resposta: `status` = `completed` | `cooldown`. Sem cron (a Vercel Hobby limita os agendamentos): a sincronização é manual.
- O servidor grava `googleMeta/profile` (nota, total, não respondidas, última sincronização/erro), `googleMeta/daily` (30 dias de desempenho) e `googleReviews/{id}`. Regras: leitura admin, escrita `false`.
- O painel só lista as avaliações do `syncedAt` do perfil (conjunto da última sincronização); documentos antigos ficam no banco.
- Falha nas métricas **não** perde as avaliações: o perfil guarda `metricsError`.
- Limites: até 600 avaliações por sincronização (as mais recentes); o Google fecha cada dia de desempenho com atraso (a janela termina em ontem).
- Sem lock entre execuções simultâneas (grava o mesmo conteúdo); sem renovação de token a gerenciar: usa o refresh token do OAuth.

## Configuração externa (necessária; não feita pelo código)
1. **Acesso à API do Perfil da Empresa.** Em um projeto do Google Cloud (pode ser o do Deslocamento), ative as APIs do Perfil da Empresa (Account Management, Business Information, Business Profile Performance e a **Google My Business API**, que ainda serve as avaliações) e envie o formulário de pedido de acesso do Google. Sem a aprovação a cota é zero e as chamadas devolvem 403 (`permission`).
2. **OAuth:** crie um *OAuth client ID* (aplicativo da Web) e uma tela de consentimento. Em modo "Teste" o Google expira o refresh token em 7 dias: publique a tela em **"Em produção"** (aparece o aviso de app não verificado; para uso próprio é aceitável).
3. **Refresh token:** autorize a conta gerente do perfil com o escopo `https://www.googleapis.com/auth/business.manage` (ex.: OAuth Playground com as suas credenciais) e guarde o refresh token.
4. **IDs:** `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts` devolve `accounts/NNN`; `GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/NNN/locations?readMask=name,title` devolve `locations/MMM`.
5. **Vercel (Production e Preview):** `GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET`, `GOOGLE_BUSINESS_REFRESH_TOKEN`, `GOOGLE_BUSINESS_ACCOUNT_ID` (só o número `NNN`), `GOOGLE_BUSINESS_LOCATION_ID` (só o número `MMM`). Republique.
6. Publicar `firestore.rules` **a partir da `main`** (nova regra de `googleMeta` e `googleReviews`). Sem isso o painel não consegue ler.

## Códigos de erro (mostrados no painel)
`not_configured` (variáveis ausentes), `token_invalid` (refresh token expirado/revogado ou cliente errado), `permission` (API não aprovada ou conta sem acesso ao perfil), `rate_limited`, `unavailable`, `api_error`.

## Privacidade (LGPD)
As avaliações trazem o nome público de quem avaliou e o texto. Ficam em `googleReviews`, legíveis só por administradores; nada disso vai ao site público (o carrossel da home continua usando a Places API, `docs/avaliacoes.md`).

## Não validado
A integração **nunca foi executada contra a API real** do Google (sem credenciais/aprovação): os testes (`functions/google-business.test.js`) usam `fetch` e Firestore simulados, com os formatos de resposta da documentação (`reviews`, `averageRating`, `totalReviewCount`, `multiDailyMetricTimeSeries`). Confirme nomes de campos, métricas e a necessidade da API legada de avaliações com a primeira sincronização real.

## Próximas fases
- **Fase 2:** responder avaliações pelo CRM (`PUT .../reviews/{id}/reply`) e aviso no sino para nota 3 ou menos.
- **Fase 3:** postagens e fotos (as postagens aceitam foto; vídeo só por mídia, com limite de tamanho/duração: confirmar antes).
