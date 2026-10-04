# Instagram Analytics (admin → Instagram)

Espelha no Firestore o perfil e as últimas 100 publicações da conta profissional via **Instagram API com Instagram Login** (`graph.instagram.com`, v23.0 por padrão; mude com `INSTAGRAM_API_VERSION`). Sem scraping nem APIs não oficiais.

## Fluxo
- `POST /api/instagram-sync` (botão "Sincronizar agora"): exige ID token de administrador; intervalo mínimo de 60 s entre tentativas (concluídas ou não). Resposta: `status` = `completed` | `running` (outra execução em andamento) | `cooldown` (`afterFailure` indica se a última tentativa falhou).
- `GET /api/instagram-sync` (Vercel Cron, 1x/dia às 09:00 UTC): exige `Authorization: Bearer $CRON_SECRET`.
- O servidor grava `instagramMeta/profile` e `instagramPosts/{id}`; o painel só lê (regras: leitura admin, escrita `false`). O token renovado fica em `instagramPrivate/token` (nenhum acesso pelo cliente).
- Concorrência: cada execução (cron ou manual) reserva `instagramPrivate/lock` em transação, com prazo de 120 s (execução interrompida se libera sozinha); só quem reservou libera.
- Consistência: `instagramPosts` não é apagado; o painel considera só os documentos com o `syncedAt` do perfil (conjunto da última sincronização). Visualizações que falham de forma transitória ou por permissão mantêm o valor anterior, marcado como "desatualizado"; só viram `null` quando a Meta responde que a métrica não existe. O perfil registra `insights` (contagem por resultado) e `warning`.
- O token vem de `INSTAGRAM_ACCESS_TOKEN` (somente servidor) e é renovado automaticamente a cada 30 dias.

## Configuração externa (necessária; não feita pelo código)
1. Conta do Instagram do Herói da Cidade deve ser **Profissional** (Comercial ou Criador).
2. Em developers.facebook.com: criar um app (tipo Business) e adicionar o produto **Instagram → API setup with Instagram login**.
3. Permissões: `instagram_business_basic` e `instagram_business_manage_insights` (para visualizações). Em modo de desenvolvimento, funcionam sem App Review para contas com função no app (adicione a conta como *Instagram Tester* e aceite o convite no Instagram). App Review só é exigido para contas de terceiros.
4. Gerar o token da conta no painel do app e trocá-lo por um de **longa duração** (60 dias): `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=<APP_SECRET>&access_token=<TOKEN_CURTO>`.
5. Definir `INSTAGRAM_ACCESS_TOKEN` (e confirmar `CRON_SECRET`) na Vercel e republicar. Para trocar de token, basta atualizar a variável (ela prevalece sobre o token renovado salvo).
6. Publicar `firestore.rules` (nova regra das coleções `instagram*`). Sem isso o painel não consegue ler.

## Balanço diário (seguidores, curtidas e visualizações)
- Calculado no servidor, no mesmo batch da sincronização (falha não altera nada). Referências em `instagramPrivate/daily`; o saldo exibido em `instagramMeta/profile.daily` (painel e widget da Principal só leem).
- O dia é o de Brasília (America/Sao_Paulo). A **primeira sincronização bem-sucedida de cada dia** vira a referência ("hoje" = desde ela; o painel mostra "desde HH:mm" se for depois das 02:00). Seguidores: atual − referência (líquido). Curtidas/visualizações: soma por publicação de (atual − referência), só onde as duas pontas existem; publicação nascida depois da referência entra com referência 0; publicação que sai do conjunto não gera saldo; visualizações desatualizadas ficam de fora ("parcial").
- Cron: `0 3 * * *` (00:00–00:59 em Brasília no plano Hobby) cria a referência perto da meia-noite; `0 9 * * *` segue como atualização da manhã. Se o cron falhar, a 1ª sincronização do dia (manual ou da manhã) cria a referência; o cálculo não depende do cron.
- Sem sincronização no dia, o painel mostra "Aguardando a 1ª sincronização de hoje" (nunca o saldo de ontem).

## Métricas e limitações
- Disponíveis: seguidores, nº de publicações, curtidas, comentários, visualizações (`views` por mídia), tipo, data, legenda, miniatura.
- Curtidas/comentários/visualizações exibidos são **soma das publicações carregadas** (até 100), não o total histórico. Métrica ausente aparece como "Indisponível" e fica fora de somas e rankings (ex.: curtidas ocultas pelo autor; `views` pode falhar em mídias antigas).
- Publicações fora das últimas 100 (ou removidas) permanecem no banco, mas fora dos indicadores; a coleção cresce e o painel a lê inteira (limpeza/consulta filtrada fica para depois).
- Cron diário por limite do plano Hobby da Vercel; o cron e o botão não somam histórico (sem série temporal nesta versão).
- Erros tratados: token ausente/expirado (código 190), limite de requisições (4/17/32/613), indisponibilidade; o último erro aparece no painel e os dados antigos são preservados.

## Não validado
Pendências adicionais: a classificação de erros de insights (permissão = códigos 10/200–299; "não existe" = HTTP 400 código 100) e o efeito da renovação sobre o token antigo vêm de suposições e precisam ser confirmados com respostas reais da Meta.

A integração nunca foi executada contra a API real da Meta (sem credenciais): os testes usam `fetch`/Firestore simulados. Confirme nomes de campos/métrica e permissões com o primeiro sync real.
