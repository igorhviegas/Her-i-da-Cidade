# Instagram Analytics — Guia da primeira sincronização real

Documentação da Meta e da Vercel consultada em **03/10/2026**. Este guia não foi executado contra a conta real: nenhuma chamada à Meta, nenhuma sincronização, nenhum deploy, nenhuma regra publicada e nenhuma variável alterada. Onde a documentação não deu certeza, está marcado.

## 0. Status atualizado (03/10/2026) — o que já foi feito e o que sobrou para você

**Já feito por mim (verificado):**
- Commit `70ed310` e push da branch `claude/stoic-kare-00f48a`; **Pull Request #25** aberto: https://github.com/igorhviegas/Her-i-da-Cidade/pull/25 (**não mergeado**; mergear em `main` dispara o deploy de produção).
- **Deploy de preview na Vercel concluído com sucesso**: isso confirma que o `vercel.json` (os dois crons e `maxDuration: 60`) é aceito pelo plano atual.
- **Regras do Firestore comparadas com as publicadas (somente leitura, via Firebase CLI):** as regras publicadas hoje no banco `(default)` do projeto `heroi-da-cidade` (versão de 02/10/2026) são **idênticas** às de `main`; a branch só **acrescenta** o bloco do Instagram (16 linhas). Publicar é, portanto, uma mudança aditiva e segura. (Existe também uma segunda versão de regras, de 17/09/2026, ligada a um banco nomeado `ai-studio-…`; ela não é afetada.)
- **Teste das regras no emulador local** (novo: `tests/firestore-rules-instagram.test.js`, já incluído em `npm run test:rules`): 3 testes passam — admin lê `instagramMeta`/`instagramPosts`; ninguém escreve pelo cliente; `instagramPrivate` (token e reserva) não é acessível nem pelo admin. Isso substitui a necessidade do "Rules Playground" (Etapa 22), que passa a ser só uma conferência opcional.
- `npm test`: 191 passam, 0 falham.

**Bloqueado para mim (negado pelo sistema de permissões): publicar as regras em produção.** Fica para você, em 1 comando (Etapa 21 abaixo).

**O que continua dependendo só de você** (nesta ordem):
1. **Etapa 21** — publicar as regras (1 comando, ou colar no console).
2. **Etapas 1–12** (conta, app Meta, permissões, token) — exigem seu login no Instagram/Meta.
3. **Etapa E (Testes 1–10)** — exigem o token. **Pare se os Testes 3 ou 4 falharem** e me envie o erro.
4. **Etapa 14–15** — conferir/cadastrar variáveis na Vercel (não tenho acesso ao painel nem à CLI da Vercel).
5. **Etapa 16** — mergear o PR #25 (ou me pedir) para ir à produção, **depois** das regras e do token.
6. **Etapas 24–29** — primeira sincronização e conferência.

**Legenda de confiança** (usada em todo o guia)
- **[DOC]** Confirmado pela documentação oficial consultada.
- **[CONTA]** Depende de configuração da conta ou do aplicativo.
- **[TESTE]** Só se confirma com um token real (os testes da Etapa E).
- **[NC]** Não confirmado: não encontrei evidência suficiente.

---

## 1. Resumo do estado atual

### O que existe no código (verificado no repositório)

| Item | Estado |
|---|---|
| Método de autenticação | **Instagram API com Instagram Login** (`graph.instagram.com`), token de usuário do Instagram (não é Facebook Login e não precisa de Página do Facebook [DOC]). |
| Versão da Graph API | `v23.0` por padrão; pode ser trocada pela variável `INSTAGRAM_API_VERSION`, sem mexer no código. A documentação atual mostra `v25.0` [DOC]. |
| Chamadas feitas | `GET /me?fields=user_id,username,followers_count,media_count`; `GET /me/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=50` (até 2 páginas = 100 publicações); `GET /{media-id}/insights?metric=views` para cada publicação (lotes de 10); `GET /refresh_access_token?grant_type=ig_refresh_token`. |
| Permissões exigidas | `instagram_business_basic` (perfil e mídia) e `instagram_business_manage_insights` (visualizações). |
| Token | Variável `INSTAGRAM_ACCESS_TOKEN` (somente servidor). Na primeira renovação bem-sucedida, o token novo passa a ficar em `instagramPrivate/token` (Firestore, sem acesso do cliente). Se você trocar a variável por um token novo, ele prevalece sobre o salvo. |
| Renovação | Tentada quando o token salvo tem mais de 30 dias ou nunca foi renovado. Falha de renovação (ex.: token com menos de 24 h) não derruba a sincronização: o token atual segue em uso. |
| Sincronização manual | Botão "Sincronizar agora" → `POST /api/instagram-sync` com o ID token do administrador. Intervalo mínimo de 60 s entre tentativas. |
| Sincronização automática | `GET /api/instagram-sync` pelo cron da Vercel, 1x/dia (`0 9 * * *` = 09:00 UTC = 06:00 em Brasília), com `Authorization: Bearer $CRON_SECRET`. |
| Concorrência | Reserva atômica em `instagramPrivate/lock` (prazo de 120 s). |
| Painel | `/admin/instagram`: seguidores, publicações, curtidas/comentários/visualizações (soma das publicações da última sincronização), líderes, lista ordenável, avisos e erros. |
| Regras do Firestore | `instagramMeta` e `instagramPosts`: leitura só de administrador, escrita negada ao cliente. `instagramPrivate`: leitura e escrita negadas. Presentes em `firestore.rules` (diferença para `main`: só estas 16 linhas). |
| Testes | `npm test`: **191 passam, 0 falham** (reexecutado em 03/10/2026). Build do Vite compila. O passo do `esbuild` do `npm run build` falha **nesta máquina** por um atalho quebrado deixado pelo `bun install`; rodado direto, o bundle do servidor gera sem erro. Não é um problema do módulo. |

### O que ainda falta
1. **O módulo existe apenas nesta cópia de trabalho.** Nada foi commitado, enviado ou implantado: em produção, `/admin/instagram` ainda não existe. Precisa de commit, push e deploy (com a sua autorização).
2. Regras do Firestore ainda não publicadas (e comparação com as publicadas).
3. Conta, aplicativo, permissões e token da Meta (nada disso foi verificado; não tenho acesso).
4. Variáveis na Vercel.
5. Testes reais de API (principalmente `media_product_type`, `caption` e `views`).
6. Primeira sincronização e conferência dos números.

### Três riscos que podem bloquear a primeira sincronização (leia antes de começar)

1. **`caption` e `media_product_type` podem não existir no Instagram Login [DOC conflitante → TESTE].** A tabela de campos de *IG Media* (consultada duas vezes, mais uma busca) lista os dois como "não disponíveis" com Instagram Login (só Facebook Login). Já um exemplo de requisição do próprio fluxo Instagram Login pede `caption`. Os dois trechos se contradizem. Se a Meta recusar qualquer campo da lista, **a chamada `/me/media` inteira falha** (erro `#100`) e nenhuma publicação é gravada. O código atual pede os dois campos. O Teste 3 e o Teste 4 resolvem isso em minutos. Se falharem, **não contorne por conta própria**: me chame com o resultado (a correção é pequena: tirar o campo e inferir Reel por `media_type=VIDEO`, mas aí a legenda ou a distinção Reel/vídeo mudam, e isso é uma decisão sua).
2. **Carrosséis não têm insights [DOC].** A documentação diz que insights de mídia do tipo álbum não estão disponíveis. O código trata "400 com código 100" como "não existe" (→ `Indisponível`, sem aviso). Se a Meta responder com outro código para carrosséis, o painel vai tratar como falha temporária e mostrar o aviso "N consultas de visualizações falharam" em toda sincronização. O Teste 8 mostra qual é a resposta real.
3. **Credenciais do Firebase Admin no servidor.** A sincronização grava no Firestore pelo Admin SDK. Sem `FIREBASE_SERVICE_ACCOUNT_KEY` (ou o par `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`) o servidor tenta credenciais padrão do Google, que na Vercel não existem, e a sincronização falha com erro 500. O ManyChat e o cron de missões já usam essas variáveis; se funcionam em produção, já estão lá [CONTA].

---

## 2. Compatibilidade com a Meta (confronto código × documentação)

| Ponto | Classificação | Evidência / observação |
|---|---|---|
| Instagram Login aceita conta profissional (Comercial ou Criador), sem Página do Facebook | **[DOC]** | Visão geral da API com Instagram Login. |
| Aplicativo precisa ser do tipo **Business** | **[DOC]** | Guia "get started": se o app atual não for Business, é preciso criar outro. |
| Escopos atuais: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_messages`, `instagram_business_manage_comments` (os antigos `business_*` foram descontinuados em 27/01/2025) | **[DOC]** | Visão geral e Business Login. |
| Insights de mídia exigem `instagram_business_basic` **e** `instagram_business_manage_insights` | **[DOC]** | Referência de insights de mídia. Observação: a lista de escopos da visão geral não cita `manage_insights`; as páginas se contradizem. Confirmar no painel quais escopos o token recebe → **[TESTE]**. |
| `GET /me` com `user_id`, `username`, `followers_count`, `media_count` | **[TESTE]** | Não obtive a tabela de campos de perfil (a página de referência retornou 404). Teste 1. |
| `GET /me/media`: `id`, `media_type`, `media_url`, `permalink`, `thumbnail_url`, `timestamp`, `like_count`, `comments_count` | **[DOC]** | Disponíveis no Instagram Login. `thumbnail_url` só existe para VIDEO; `media_url` some se houver material com direitos autorais; `timestamp` vem em ISO 8601 UTC; `like_count` é omitido se o autor ocultou as curtidas. |
| `caption` | **[DOC conflitante → TESTE]** | Ver risco 1. |
| `media_product_type` | **[DOC: "não disponível" no Instagram Login → TESTE]** | Ver risco 1. É o campo que distingue Reel de vídeo. |
| `media_type` (valores IMAGE, VIDEO, CAROUSEL_ALBUM) | **[DOC]** | |
| Limite/máximo do parâmetro `limit` e paginação de `/me/media` | **[NC]** | Não encontrei na documentação. O Teste 5 mostra `paging.next`. |
| Métrica `views` em Feed e Reels | **[DOC]** | Lista de métricas por formato (Feed e Reels incluem `views`). |
| `views` em carrossel | **[DOC: insights de álbum indisponíveis → TESTE]** | Risco 2. |
| `views` em Reels antigos / imagens antigas | **[TESTE]** | A documentação cita limitações para mídias criadas antes de certas datas, sem detalhar. |
| Estrutura da resposta de insights (`data[0].values[0].value`) | **[NC → TESTE]** | O exemplo de resposta não veio na documentação que consegui ler. O código assume o formato clássico de métricas de mídia. Se vier outro formato (ex.: `total_value`), o painel mostrará todas as visualizações como `Indisponível`, com o aviso "A Meta informou que as visualizações não estão disponíveis". Teste 6. |
| Dados de insights podem atrasar até 48 h | **[DOC]** | Visualizações recentes podem ser menores que no app do Instagram. |
| Métricas orgânicas (`likes`, `comments`, `views`) excluem anúncios | **[DOC]** | Diferença esperada em publicações impulsionadas. |
| Token gerado no painel do app já é de **longa duração (60 dias)** | **[DOC]** | "Access tokens from the App Dashboard are long-lived and are valid for 60 days". A troca `ig_exchange_token` só é necessária para tokens curtos (1 h) do Business Login. |
| Renovação: `GET /refresh_access_token?grant_type=ig_refresh_token`; token com **≥ 24 h** de vida, não expirado, escopo `instagram_business_basic`; novo prazo de 60 dias; resposta com `access_token`, `token_type`, `expires_in` | **[DOC]** | Casa com o código. |
| O token antigo continua válido depois da renovação? | **[NC]** | A documentação não diz. O código grava o token novo e passa a usá-lo; o risco só existiria numa corrida entre duas execuções, que a reserva atômica impede. |
| Acesso Standard (padrão) basta para contas que você possui/administra e adicionou ao app; Advanced (com App Review e verificação da empresa) só para contas de terceiros | **[DOC]** | Para o Herói da Cidade (conta própria) não deve ser necessária revisão do app. |
| Modo Desenvolvimento × Live | **[NC]** | A documentação consultada não detalha. Pelo critério acima (conta própria + Standard), espera-se funcionar em desenvolvimento; confirme no painel (Etapa B, passo 8). |
| Limite de chamadas: `4800 × nº de impressões em 24 h` | **[DOC]** | Uma sincronização faz ~105 chamadas por dia (+ cliques manuais); está bem abaixo do que se espera. |
| Versão `v23.0` ainda aceita | **[NC]** | A documentação atual mostra `v25.0`. Meta costuma manter versões por cerca de 2 anos; não encontrei a data de fim da `v23.0`. Teste 10 compara as duas. |

---

## 3. Pré-requisitos (tenha em mãos)

- Acesso de **proprietário/administrador** à conta do Instagram do Herói da Cidade (login e senha, e o celular para o código de verificação).
- Uma conta pessoal do **Facebook** para entrar no Meta for Developers (a Meta exige login do Facebook para criar apps; ela não precisa estar ligada ao Instagram).
- Acesso de administrador ao projeto da **Vercel** e ao projeto **Firebase `heroi-da-cidade`** (confirmado em `.firebaserc` e `firebase-applet-config.json`).
- Um e-mail de administrador já cadastrado na coleção `admins` do Firestore (é o mesmo login do painel `/admin`).
- PowerShell neste computador (os comandos abaixo são para Windows).
- Um **gerenciador de senhas ou bloco de notas local** para guardar o token temporariamente. **Nunca cole o token, o App Secret ou a chave do Firebase no chat, em e-mails ou em documentos compartilhados.**

---

## 4. Etapas manuais

> Faça na ordem. Não avance sem cumprir a "Conclusão" de cada etapa. Nomes de menus marcados com "(confirmado)" vêm da documentação; os demais podem variar na interface atual da Meta — nesses casos, procure o item equivalente.

### Etapa A — Preparar a conta do Instagram

**Etapa 1 — Confirmar que a conta é profissional**
- **Onde:** aplicativo do Instagram no celular (ou instagram.com no navegador).
- **Passo a passo:**
  1. Entre na conta do Herói da Cidade e abra o perfil.
  2. Toque no menu (☰) → **Configurações e atividade**.
  3. Procure **Tipo de conta e ferramentas** (em algumas versões, "Conta" ou "Conta profissional").
  4. Veja se aparece **"Mudar para conta pessoal"** (significa que **já é profissional**) ou **"Mudar para conta profissional"** (significa que **ainda é pessoal**).
- **Resultado esperado:** conta profissional, do tipo **Comercial** ou **Criador de conteúdo** (ambos servem [DOC]).
- **Se der erro:** se for pessoal, toque em **Mudar para conta profissional**, escolha a categoria e o tipo (Comercial ou Criador). Isso muda a conta; confirme com quem administra o perfil antes. Contas pessoais não funcionam com a API [DOC].
- **Conclusão:** o perfil mostra que é profissional.

**Etapa 2 — Anotar o nome de usuário e o tipo**
- **Onde:** mesma tela.
- **Passo a passo:** anote o `@usuario` exato e se é Comercial ou Criador.
- **Resultado esperado:** você terá o `@usuario` para comparar com o que a API devolver (`username`).
- **Conclusão:** `@usuario` anotado.

**Etapa 3 — Conferir acessos**
- **Onde:** Configurações e atividade → **Tipo de conta e ferramentas** (ou Centro de Contas, se aparecer).
- **Passo a passo:** confirme que você consegue entrar com o login principal da conta (não apenas como colaborador de outra ferramenta). Vínculo com Página do Facebook **não é necessário** para o Instagram Login [DOC]; não crie nem altere vínculos sem necessidade.
- **Se der erro:** se a verificação em duas etapas bloquear o login, resolva antes de seguir.
- **Conclusão:** você consegue entrar na conta no navegador e no celular.

### Etapa B — Criar ou configurar o aplicativo da Meta

**Etapa 4 — Entrar no Meta for Developers**
- **Onde:** https://developers.facebook.com
- **Passo a passo:** clique em **Log In** (canto superior direito), entre com sua conta do Facebook. Se for a primeira vez, aceite os termos e conclua o registro de desenvolvedor (pode pedir e-mail e telefone).
- **Resultado esperado:** o menu **My Apps / Meus aplicativos** aparece no topo.
- **Se der erro:** se pedir verificação, conclua; use a conta que será a "dona" do app.
- **Conclusão:** você vê a lista (talvez vazia) de aplicativos.

**Etapa 5 — Verificar se já existe um aplicativo**
- **Onde:** **My Apps**.
- **Passo a passo:** procure um app com nome do Herói da Cidade ou relacionado ao Instagram. Se existir, abra-o e vá ao menu da esquerda; veja se há um item **Instagram**.
- **Resultado esperado:** ou você encontra um app **do tipo Business** com o produto Instagram, ou segue para a Etapa 6 para criar um.
- **Se der erro/dúvida:** se o app existente **não** for do tipo Business, é preciso criar outro [DOC]. Não reutilize app de outra finalidade (ex.: de login ou ManyChat) sem saber o que ele faz.
- **Conclusão:** você decidiu entre "usar o app existente" e "criar um novo".

**Etapa 6 — Criar o aplicativo (se necessário)**
- **Onde:** **My Apps → Create App** (Criar app).
- **Passo a passo:**
  1. Dê um nome (sugestão: `Heroi da Cidade Analytics`) e informe um e-mail de contato.
  2. No assistente de casos de uso, escolha o que corresponde a **gerenciar mensagens e conteúdo do Instagram** (o nome exato muda; procure algo como "Manage messaging & content on Instagram" ou, se não achar, **Other**).
  3. Quando pedir o **tipo de app**, escolha **Business**.
  4. Se pedir portfólio empresarial, você pode pular ou associar um existente.
  5. Conclua em **Create app** (pode pedir sua senha do Facebook — digite apenas no site da Meta).
- **Resultado esperado:** o painel do app abre, com o menu lateral à esquerda.
- **Se der erro:** se não houver opção Business, tente o caso de uso **Other** e depois escolha **Business**.
- **Conclusão:** você está dentro do painel de um app **Business**.

**Etapa 7 — Adicionar o produto Instagram (Instagram Login)**
- **Onde:** painel do app, menu lateral.
- **Passo a passo:**
  1. Se não houver **Instagram** no menu, clique em **Add Product / Adicionar produto** e adicione **Instagram**.
  2. No menu lateral, abra **Instagram → API setup with Instagram business login** (**nome confirmado pela documentação**).
- **Resultado esperado:** abre uma página com seções como "Generate access tokens" (gerar tokens de acesso) e configuração de webhooks/Business Login.
- **Se der erro:** se só aparecer "API setup with Facebook login", o app não está com o caso de uso correto; volte à Etapa 6 e escolha o caso de uso de Instagram.
- **Conclusão:** a página "API setup with Instagram business login" está aberta.

**Etapa 8 — Anotar o modo do app e requisitos de acesso**
- **Onde:** painel do app (topo da página costuma mostrar um seletor **App Mode: Development / Live**) e **App settings → Basic**.
- **Passo a passo:** anote o modo atual. Não precisa publicar o app: para conta própria, o acesso Standard (padrão) basta [DOC]. Não solicite App Review nem Verificação da Empresa a menos que a Meta exija.
- **Resultado esperado:** modo Development (ou Live) anotado.
- **Se der erro:** se algo disser que "esta permissão exige análise" ao tentar gerar o token com sua própria conta, anote a mensagem exata e me envie (sem tokens).
- **Conclusão:** modo do app anotado.

### Etapa C — Permissões e conta de teste

**Etapa 9 — Adicionar a conta do Instagram ao app**
- **Onde:** **Instagram → API setup with Instagram business login**, seção **Generate access tokens** (nome aproximado).
- **Passo a passo:**
  1. Clique em **Add account** (Adicionar conta).
  2. Entre com a conta do Herói da Cidade e autorize.
  3. A conta passa a aparecer na lista, com o `@usuario`.
- **Resultado esperado:** a conta aparece listada, com botão **Generate token** ao lado (**nome confirmado**).
- **Se der erro:** se a conta for de outra pessoa (ou o app for novo e o login for de outro usuário), convide-a em **App roles → Roles → Add People → Instagram Testers** (nome aproximado), e a conta convidada precisa **aceitar o convite no Instagram** (Configurações → **Apps e sites** → **Convites de testador**). Isso só é necessário se quem faz o login no app não for o dono da conta.
- **Conclusão:** a conta do Herói da Cidade aparece na lista do app.

**Etapa 10 — Permissões necessárias**
- **Onde:** no momento de gerar o token (Etapa 11) a Meta mostra as permissões concedidas; também em **App Review → Permissions and Features** (nome aproximado).
- **Passo a passo:** o código precisa de **`instagram_business_basic`** e **`instagram_business_manage_insights`**. Não são necessárias as de publicar conteúdo, mensagens ou comentários — não as habilite se puder escolher.
- **Resultado esperado:** na tela de autorização do Instagram aparecem pedidos como "Acessar informações do perfil e da mídia" e "Acessar insights" (rótulos aproximados).
- **Se der erro:** se `instagram_business_manage_insights` **não** aparecer entre as permissões, anote isso e vá direto ao Teste 6/7: a ausência explicaria views indisponíveis. Não é necessário App Review para uma conta que você administra (acesso Standard) [DOC].
- **Conclusão:** você sabe quais permissões o token receberá.

### Etapa D — Gerar e validar o token

**Etapa 11 — Gerar o token**
- **Onde:** **Instagram → API setup with Instagram business login → Generate access tokens**.
- **Passo a passo:**
  1. Clique em **Generate token** ao lado da conta (**confirmado**).
  2. Entre no Instagram se pedido e **autorize** as permissões.
  3. Copie o token **diretamente para o gerenciador de senhas**. A tela costuma mostrar o token uma vez.
- **O que preencher:** nada ainda; o token é um segredo.
- **Resultado esperado:** um texto longo (token). Pela documentação, tokens gerados no painel têm **60 dias** [DOC].
- **Se der erro:** se o botão estiver desabilitado, a conta ainda não foi adicionada (Etapa 9) ou o convite de testador não foi aceito.
- **Conclusão:** token guardado em local seguro. **Não o envie a ninguém.**

**Etapa 12 — Anotar a data de validade**
- **Onde:** seu calendário.
- **Passo a passo:** crie um lembrete para **50 dias** após hoje ("renovar/gerar novo token do Instagram"). O sistema tenta renovar sozinho, mas só consegue com o token ainda válido e com mais de 24 h.
- **Conclusão:** lembrete criado.

### Etapa E — Testar as chamadas da API (só leitura)

> Estes testes **não alteram nada** (são apenas leituras no Instagram) e **não tocam seu Firestore**. Eu não consegui confirmar que o Graph API Explorer da Meta funciona com `graph.instagram.com`; por isso use PowerShell (`curl.exe`), que é o método que a documentação usa.

**Preparação segura do token (PowerShell, uma vez por sessão)**

```powershell
# O token fica só na memória desta janela do PowerShell (não vai para o histórico do chat nem para arquivos).
$env:IG_TOKEN = Read-Host "Cole o token (ficará visível só neste terminal)"
$env:IG_V = "v23.0"
# Ao terminar TUDO, apague:
# Remove-Item Env:IG_TOKEN
```

Todas as chamadas abaixo usam `curl.exe` (com `.exe`, para não cair no alias do PowerShell). Para ver a resposta formatada, acrescente ` | ConvertFrom-Json | ConvertTo-Json -Depth 8`. **Ao me enviar resultados, apague sempre o `access_token`, IDs de mídia só se quiser, e qualquer URL com `access_token=`.**

**Teste 1 — Perfil**
- **Objetivo:** confirmar que o token pertence à conta certa e que os campos do perfil existem.
- **Requisição:**
  ```powershell
  curl.exe -s "https://graph.instagram.com/$env:IG_V/me?fields=user_id,username,followers_count,media_count&access_token=$env:IG_TOKEN"
  ```
- **Resultado esperado:** um JSON com `user_id`, `username` (o `@` anotado na Etapa 2), `followers_count` e `media_count`.
- **Como interpretar:** `username` e seguidores devem bater com o app do Instagram. `media_count` é o total de publicações do perfil (inclui as que não entram nas 100 do painel).
- **Se der erro:** `{"error":{"code":190,...}}` → token inválido/expirado (gere outro). `code 100` falando de um campo → anote qual campo e me envie. `code 10` ou `200–299` → permissão não concedida (volte à Etapa 10).
- **O que isso valida:** `INSTAGRAM_ACCESS_TOKEN`, escopo `instagram_business_basic`, campos do perfil [TESTE].

**Teste 2 — Publicações, só com campos "seguros"**
- **Objetivo:** confirmar `/me/media` com os campos que a documentação garante.
- **Requisição:**
  ```powershell
  curl.exe -s "https://graph.instagram.com/$env:IG_V/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=5&access_token=$env:IG_TOKEN"
  ```
- **Resultado esperado:** `data` com até 5 itens, cada um com `id`, `media_type` (IMAGE, VIDEO ou CAROUSEL_ALBUM), `permalink`, `timestamp` etc.
- **Como interpretar:** `thumbnail_url` só aparece em vídeos; `media_url` pode faltar em mídia com música/direitos autorais; `like_count` pode faltar se o autor ocultou as curtidas; `timestamp` vem em formato com `+0000` (o código já converte). **Anote, sem tokens, o `id` de um Reel, de uma imagem e de um carrossel** para os testes 6–8.
- **Se der erro:** igual ao Teste 1.
- **O que isso valida:** leitura básica de mídia.

**Teste 3 — `media_product_type` (campo crítico)**
- **Objetivo:** descobrir se o Instagram Login aceita este campo.
- **Requisição:**
  ```powershell
  curl.exe -s "https://graph.instagram.com/$env:IG_V/me/media?fields=id,media_product_type&limit=5&access_token=$env:IG_TOKEN"
  ```
- **Resultado esperado (se o campo existir):** cada item com `media_product_type` = `FEED`, `REELS` (ou `STORY`/`AD`).
- **Se der erro:** uma mensagem como `(#100) Tried accessing nonexisting field (media_product_type)` → **o código atual vai falhar na primeira sincronização**. Pare aqui e me envie a mensagem (sem token): a correção é remover o campo do pedido (e decidir como identificar Reels).
- **O que isso valida:** risco 1 (documentação conflitante).

**Teste 4 — `caption`**
- **Objetivo:** descobrir se a legenda é aceita.
- **Requisição:**
  ```powershell
  curl.exe -s "https://graph.instagram.com/$env:IG_V/me/media?fields=id,caption&limit=5&access_token=$env:IG_TOKEN"
  ```
- **Resultado esperado:** `caption` com o texto da legenda (ou ausente quando não há legenda).
- **Se der erro:** mesmo tratamento do Teste 3.
- **O que isso valida:** o outro campo do risco 1.

**Teste 5 — A chamada exata do código e a paginação**
- **Objetivo:** reproduzir exatamente o que o servidor pede, e ver a paginação.
- **Requisição:**
  ```powershell
  curl.exe -s "https://graph.instagram.com/$env:IG_V/me/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=50&access_token=$env:IG_TOKEN"
  ```
- **Resultado esperado:** até 50 itens em `data` e, se houver mais, um bloco `paging` com `next`.
- **Como interpretar:** o servidor lê no máximo **2 páginas (100 publicações)**. Se vierem menos de 50 itens com `paging.next`, a Meta limita o tamanho da página; o painel pode ter menos de 100 (anote quantos). Para ver a 2ª página, copie o valor de `paging.next` (ele contém o token; **não o compartilhe**) e chame com `curl.exe -s "<valor>"`.
- **O que isso valida:** o pedido de mídia do código, e a paginação [NC → TESTE].

**Teste 6 — Insights de um Reel**
- **Objetivo:** confirmar que `views` funciona e ver o formato real da resposta.
- **Requisição** (troque `ID_DO_REEL` pelo id anotado):
  ```powershell
  curl.exe -s "https://graph.instagram.com/$env:IG_V/ID_DO_REEL/insights?metric=views&access_token=$env:IG_TOKEN"
  ```
- **Resultado esperado:** algo como `{"data":[{"name":"views","period":"lifetime","values":[{"value":<número>}], ...}]}`.
- **Como interpretar:** o código lê `data[0].values[0].value`. **Se o número vier em outro lugar (ex.: `total_value`), o painel mostrará "Indisponível" mesmo com permissão correta** — me envie o formato (sem token). O valor pode atrasar até 48 h [DOC] e deve ser próximo ao do app (Estatísticas do Reel).
- **Se der erro:** `code 10` ou `200–299` → falta `instagram_business_manage_insights` (gere o token de novo marcando o escopo; veja Etapa 10). `code 100` → métrica ou mídia sem suporte (anote a mensagem).
- **O que isso valida:** `views` em Reels, estrutura da resposta, escopo de insights.

**Teste 7 — Insights de uma imagem**
- **Requisição** (com `ID_DA_IMAGEM`): igual ao Teste 6.
- **Resultado esperado:** valor numérico (Feed suporta `views` [DOC]) ou erro.
- **Como interpretar:** imagens antigas podem não ter `views` (documentação cita limitações sem detalhar). Anote a mensagem exata se der erro.

**Teste 8 — Insights de um carrossel**
- **Requisição** (com `ID_DO_CARROSSEL`): igual ao Teste 6.
- **Resultado esperado:** a documentação diz que insights de álbum **não** estão disponíveis [DOC]; espere um erro.
- **Como interpretar:** o painel só trata como "indisponível" (sem aviso) quando a resposta é **HTTP 400 com `"code":100`**. Se vier **outro código** (ex.: `code 1`, 5xx, 10), o painel classificará como falha temporária e mostrará um aviso persistente sobre carrosséis. Me envie o JSON do erro (sem token) nesse caso.
- **O que isso valida:** risco 2.

**Teste 9 — Erro de permissão / token inválido (opcional)**
- **Objetivo:** reconhecer as mensagens de erro quando algo estiver errado.
- **Requisição:**
  ```powershell
  curl.exe -s "https://graph.instagram.com/$env:IG_V/me?fields=username&access_token=TOKEN_INVALIDO"
  ```
- **Resultado esperado:** `{"error":{"code":190,...}}` (token inválido). Serve para você reconhecer o formato.

**Teste 10 — Comparar versões**
- **Objetivo:** ver se `v23.0` e `v25.0` respondem igual.
- **Requisição:** repita o Teste 1 e o Teste 6 trocando `$env:IG_V = "v25.0"`.
- **Como interpretar:** se **v23.0 falhar e v25.0 funcionar**, defina `INSTAGRAM_API_VERSION=v25.0` na Vercel (sem alterar código). Se ambas funcionarem, mantenha o padrão.

**Conclusão da Etapa E:** os testes 1, 3, 4, 5 e 6 retornam sem erro (ou você me enviou os erros). **Só avance para as etapas seguintes se `media_product_type` e `caption` passarem** — caso contrário, volte a falar comigo antes de implantar.

---

## 5. Vercel

**Etapa 13 — Abrir o projeto e as variáveis**
- **Onde:** https://vercel.com/dashboard.
- **Passo a passo:**
  1. Selecione o time e o **projeto** do Herói da Cidade (o que serve o site `/admin`).
  2. Abra **Settings → Environment Variables**.
  3. No topo/ao lado, veja o ambiente selecionado (**Production**, Preview, Development).
- **Resultado esperado:** lista de variáveis existentes (valores ocultos).
- **Conclusão:** você está em Settings → Environment Variables do projeto certo.

**Etapa 14 — Conferir o que já existe (sem revelar valores)**
- **Onde:** mesma página; use a busca.
- **Passo a passo:** procure e marque o que existe em **Production**:

| Variável | Para quê | Tipo | Observação |
|---|---|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | Token do Instagram | **Secreta** | **Obrigatória.** Provavelmente não existe ainda. |
| `CRON_SECRET` | Autentica o cron | **Secreta** | **Obrigatória.** Já é usada por `/api/missions-cron`; se existir, **não altere** (a Vercel a envia como `Authorization: Bearer` nas chamadas do cron [DOC]). |
| `FIREBASE_SERVICE_ACCOUNT_KEY` *(ou `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`)* | Gravar no Firestore (Admin SDK) | **Secreta** | **Obrigatória.** Provavelmente já existe (ManyChat/missões). |
| `FIREBASE_PROJECT_ID` ou `VITE_FIREBASE_PROJECT_ID` | Validar administrador | Pública | Pelo menos uma. Esperado: `heroi-da-cidade`. |
| `FIREBASE_API_KEY` ou `VITE_FIREBASE_API_KEY` | Validar o ID token do administrador | Pública (chave web do Firebase) | Pelo menos uma. |
| `INSTAGRAM_API_VERSION` | Versão da Graph API | Pública | **Opcional** (padrão `v23.0`). |
| `FIRESTORE_DATABASE_ID` / `VITE_FIRESTORE_DATABASE_ID` | Banco do Firestore | Pública | **Opcional** (padrão `(default)`, que é o que o projeto usa). |

- **Pública × secreta:** variáveis com prefixo **`VITE_`** são embutidas no site público (qualquer visitante as vê). Por isso **nunca** use `VITE_` para token do Instagram, `CRON_SECRET` ou chaves do Firebase Admin. Já `VITE_FIREBASE_API_KEY` é pública por natureza.
- **Se algo estiver faltando:** aponte quais faltam; para `INSTAGRAM_ACCESS_TOKEN` siga a Etapa 15. **Não gere novos segredos nem edite os existentes.**
- **Conclusão:** você sabe exatamente o que falta.

**Etapa 15 — Cadastrar `INSTAGRAM_ACCESS_TOKEN` (somente depois que os Testes 3, 4, 5 e 6 passarem)**
- **Onde:** Settings → Environment Variables → **Add**.
- **Passo a passo:**
  1. **Key:** `INSTAGRAM_ACCESS_TOKEN`.
  2. **Value:** cole o token do gerenciador de senhas.
  3. **Environments:** marque **somente Production** (evita gastar chamadas em previews).
  4. Se existir a opção **Sensitive**, ative (oculta o valor depois de salvo).
  5. **Save**.
- **Resultado esperado:** a variável aparece na lista com o valor oculto.
- **Se der erro:** se a Vercel pedir "redeploy", é normal (Etapa 16).
- **Conclusão:** variável salva.

**Etapa 16 — Quando é preciso fazer um novo deploy**
- **Regra:** variáveis de ambiente só são lidas por **deployments novos**; deploys antigos continuam com o valor anterior. Depois da Etapa 15 (e depois de qualquer troca de token), é necessário um **novo deploy de produção**.
- **Importante:** o deploy também é o que **publica o código do módulo**. **Commit e push já foram feitos** e o **PR #25** está aberto (https://github.com/igorhviegas/Her-i-da-Cidade/pull/25), com o preview da Vercel aprovado. **Mergear o PR em `main` dispara o deploy de produção.** Ordem segura: (1) Etapa 21 (regras) → (2) cadastrar `INSTAGRAM_ACCESS_TOKEN` (Etapa 15) → (3) mergear o PR (ou me pedir) → (4) primeira sincronização. Se mergear antes de cadastrar o token, nada quebra: a página abre e a sincronização responde "Integração não configurada".
- **Preview vs. produção:** o preview da Vercel não serve para sincronizar (outro domínio, talvez fora dos "Authorized domains" do Firebase, e variáveis do ambiente Preview).
- **Preview:** ambientes de preview têm outro endereço, que talvez não esteja em **Authentication → Settings → Authorized domains** do Firebase; o login do admin falharia lá. Faça a primeira sincronização **em produção**.

**Etapa 17 — Conferir plano, duração e cron**
- **Onde:** Settings → **Cron Jobs** (lista os crons) e Settings → **Functions**.
- **Passo a passo:**
  1. Em **Cron Jobs**, depois do deploy, devem aparecer `/api/missions-cron` (`0 3 * * *`) e `/api/instagram-sync` (`0 9 * * *`).
  2. Plano: veja o selo do plano no seletor de time (canto superior esquerdo) ou em Settings → Billing. **Hobby**: cron no máximo 1x/dia (a configuração atual **respeita**), com horário impreciso dentro da hora [DOC]. A duração máxima de função no Hobby é de 300 s com fluid compute (padrão) [DOC]; o código pede 60 s, o que é permitido. Se o deploy for **recusado** por causa de `maxDuration`, anote a mensagem (não edite `vercel.json` sem me avisar).
- **Conclusão:** os dois crons aparecem e o deploy foi aceito.

---

## 6. Firebase

**Etapa 18 — Identificar o projeto**
- **Onde:** https://console.firebase.google.com.
- **Passo a passo:** abra o projeto **`heroi-da-cidade`** (é o `projectId` em `.firebaserc` e em `firebase-applet-config.json`; o banco usado é o `(default)`).
- **Conclusão:** projeto aberto.

**Etapa 19 — Conferir o administrador**
- **Onde:** **Build → Authentication → Users** e **Build → Firestore Database → Data → coleção `admins`**.
- **Passo a passo:** copie o **UID** do seu usuário em Authentication. Confirme que existe um documento com **esse UID como id** em `admins`. As regras só consideram administrador quem tem esse documento.
- **Se der erro:** sem esse documento, você verá "Acesso negado" no `/admin` (não é problema do Instagram).
- **Conclusão:** UID do admin conferido.

**Etapa 20 — Comparar as regras publicadas com as do repositório (sem publicar nada)**
- **✅ JÁ FEITA por mim em 03/10/2026:** publicadas = `main`; a branch só acrescenta o bloco do Instagram. **Pule para a Etapa 21.** (O procedimento abaixo fica como referência caso alguém altere as regras pelo console depois.)
- **Onde:** Firestore Database → aba **Rules** (Regras).
- **Passo a passo:**
  1. Copie todo o texto das regras publicadas e salve num arquivo **local fora do repositório** (ex.: `C:\Temp\regras-publicadas.txt`).
  2. No PowerShell, na pasta do projeto, compare com o arquivo do repositório:
     ```powershell
     Compare-Object (Get-Content C:\Temp\regras-publicadas.txt) (Get-Content .\firestore.rules) | Format-Table -AutoSize
     ```
  3. **Esperado:** diferença **apenas** nas 16 linhas do bloco `instagramMeta/instagramPosts/instagramPrivate`. Se houver **outras** diferenças (regras novas de outros módulos que ainda não foram publicadas, ou regras alteradas direto no console), **não publique**: me envie a diferença para decidirmos. Publicar o arquivo inteiro **substitui** o conjunto publicado.
- **Resultado esperado:** diferença restrita ao bloco do Instagram.
- **Conclusão:** você sabe se publicar é seguro.

**Etapa 21 — Publicar as regras (VOCÊ executa; eu fui impedido de publicar em produção)**
- **Quando:** agora (é aditivo e seguro, conforme a Etapa 20), e antes de mergear o PR (sem as regras, o painel não consegue ler os dados e mostra "Não foi possível carregar").
- **Como:** abra um terminal na pasta do projeto, na branch `claude/stoic-kare-00f48a` (ou depois do merge, em `main`), e rode:
  ```powershell
  firebase deploy --only firestore:rules --project heroi-da-cidade
  ```
  O Firebase CLI já está logado como `igorhviegas@gmail.com` neste computador. Detalhe: use sempre `--only firestore:rules`.
- **Verificação (opcional, 1 comando):** o terminal deve terminar com `Deploy complete!`; no console (Firestore → Rules) a data de publicação passa a ser a de hoje e o texto contém `match /instagramPrivate/{docId}`.
- **Se preferir o console:** copie o conteúdo de `firestore.rules` (desta branch) para Firestore → Rules → **Publish**.
- **Observação (detalhe técnico):** os comandos abaixo continuam válidos: Observação: `firebase.json` referencia `firestore.indexes.json`, que **não existe** no repositório; use sempre `--only firestore:rules` (um `deploy` de todo o Firestore falharia). Alternativa: colar o conteúdo em **Rules → Publish** no console.
- **Resultado esperado:** "Rules published" e a data de publicação atualizada.
- **Conclusão:** regras publicadas.

**Etapa 22 — Testar o acesso (Rules Playground)**
- **Onde:** Firestore → Rules → **Rules Playground** (Playground de regras).
- **Passo a passo (simulações; não alteram dados):**
  1. **Get** em `/instagramMeta/profile`, **Authenticated** com o UID do admin → **Allowed**.
  2. **Get** em `/instagramPosts/qualquerId`, admin → **Allowed**.
  3. **Get** em `/instagramPrivate/token`, admin → **Denied**.
  4. **Get** em `/instagramPrivate/lock`, admin → **Denied**.
  5. **Create/Update** em `/instagramPosts/qualquerId`, admin → **Denied**.
  6. **Get** em `/instagramMeta/profile`, **Unauthenticated** (ou com um UID que **não** está em `admins`) → **Denied**.
- **Se der erro:** se o item 3 ou 4 der **Allowed**, **pare**: as regras publicadas não protegem o token. Não faça a primeira sincronização.
- **Conclusão:** os 6 resultados batem. (Observação: o servidor usa o Admin SDK, que ignora as regras; o painel usa as regras. Por isso a escrita negada ao cliente não atrapalha a sincronização.)
- **Nota:** as coleções `instagramMeta`, `instagramPosts` e `instagramPrivate` **não precisam existir antes**: são criadas pela primeira sincronização. Não há testes automáticos das regras do Instagram (o `npm run test:rules` exige o emulador do Firebase, que não está instalado aqui); este playground é a verificação.

---

## 7. Primeira sincronização real (produção)

> **Pré-condições** (todas): Testes 1–6 sem erro; regras publicadas e Etapa 22 ok; `INSTAGRAM_ACCESS_TOKEN`, `CRON_SECRET`, credenciais do Admin SDK e variáveis do projeto Firebase na Vercel; deploy de produção com o módulo; você consegue entrar em `/admin`.

**Quando fazer:** em horário de baixo uso e **sem cron próximo** (o cron roda entre 06:00 e 06:59 de Brasília). Qualquer horário comercial serve. A trava impede execução simultânea, mas evite clicar várias vezes.

**Etapa 23 — Ensaio local (opcional, não recomendado)**
O servidor local (`npm run dev`) **não** lê arquivos `.env` e, se você configurar as credenciais do Firebase Admin localmente, **escreve no Firestore real** (as coleções `instagram*`). Por isso, **não** há ensaio local seguro com credenciais reais: os Testes 1–10 já cobrem a parte da Meta sem gravar nada. Teste local só com dados simulados (já feito: `npm test`).

**Etapa 24 — Disparar a sincronização manual**
- **Onde:** `https://<seu-domínio>/admin/instagram`.
- **Passo a passo:**
  1. Entre com o usuário administrador.
  2. Menu lateral → **Instagram** (ícone de câmera).
  3. A página, antes da primeira sincronização, mostra "Nenhum dado ainda…".
  4. Clique em **Sincronizar agora** **uma vez** e aguarde (o botão fica em carregamento; a sincronização pode levar de alguns a ~30 s).
- **Resultado esperado:** mensagem verde "Sincronização concluída." e os cartões se preenchem.
- **Se der erro:** veja a mensagem vermelha e a seção 9. **Não clique repetidamente.**
- **Conclusão:** mensagem de conclusão e dados na tela.

**Etapa 25 — Conferir os logs**
- **Onde:** Vercel → projeto → **Logs** (ou **Observability → Logs**; o nome varia) → filtre por `requestPath:/api/instagram-sync`.
- **O que procurar:** a requisição `POST /api/instagram-sync` com **status 200**. Mensagens do código: `[Instagram Sync] renovação do token falhou: <código>` (**esperada se o token tinha menos de 24 h**; só um aviso) e `[Instagram Sync] falha inesperada: <nome>`. Tokens e dados da Meta **não** são registrados.
- **Conclusão:** status 200 e nenhuma "falha inesperada".

**Etapa 26 — Confirmar a persistência no Firestore**
- **Onde:** Firebase → Firestore Database → Data.
- **Passo a passo:** confira:
  1. `instagramMeta/profile`: `username`, `followers`, `mediaCount`, `loadedPosts` (≤ 100), `syncedAt` e `lastAttemptAt` (ISO, hoje), `lastError: null`, `insights` (`total`, `ok`, `unsupported`, `permission`, `transient`), `warning` (`null` ou aviso), `tokenExpiresAt` (pode ser `null` na primeira vez: a renovação só funciona com token de mais de 24 h; o cron do dia seguinte preenche).
  2. `instagramPosts`: um documento por publicação, com `kind`, `thumbnailUrl`, `permalink`, `publishedAt` (formato `2026-…Z`), `likes`, `comments`, `views`, `viewsStale: false`, e `syncedAt` **igual** ao `syncedAt` do perfil.
  3. `instagramPrivate/lock`: `until: 0` (liberado). `instagramPrivate/token`: existe só depois de uma renovação bem-sucedida; **contém o token: não tire print nem compartilhe**.
- **Conclusão:** os campos acima estão como descritos.

**Etapa 27 — Interromper com segurança se algo parecer errado**
1. **Não repita** a sincronização em sequência. Anote a mensagem e o horário.
2. Se a página mostrar números absurdos, o painel é só leitura: nada foi alterado no Instagram.
3. Para **impedir novas tentativas**: na Vercel, remova ou esvazie `INSTAGRAM_ACCESS_TOKEN` e faça novo deploy (as próximas sincronizações falham com "Integração não configurada", sem efeitos), ou use **Settings → Cron Jobs → Disable Cron Jobs** (isso também pararia o cron de missões; evite).
4. Dados já gravados ficam só nas coleções `instagram*` e podem ser apagados pelo console **por decisão sua** (ação destrutiva): não afetam outros módulos.
5. Se o token tiver sido exposto, gere um novo no painel do app e substitua.

---

## 8. Validar os resultados no painel

**Etapa 28 — Checklist de conferência (com o app do Instagram ao lado)**

| # | Conferir | Como | Esperado |
|---|---|---|---|
| 1 | Seguidores | App do Instagram → perfil | Igual (ou diferença de poucos, por atraso). |
| 2 | Total de publicações | Perfil → número de publicações | Cartão "Publicações" = `media_count`; o subtítulo mostra quantas entraram na sincronização (≤ 100). |
| 3 | Curtidas de uma publicação | Compare 3 publicações (uma de cada formato) | Igual ao app. Curtidas ocultas → "Indisponível". |
| 4 | Comentários | Idem | Igual; **inclui respostas**, não conta comentários do carrossel por foto [DOC]. |
| 5 | Visualizações de Reels | App → Insights/Estatísticas do Reel | Próximo (pode haver atraso de até 48 h [DOC]). |
| 6 | Imagens | Idem | Com valor ou "Indisponível"; sem aviso persistente. |
| 7 | Carrosséis | Idem | "Indisponível" (insights de álbum não existem [DOC]). |
| 8 | Rankings (mais curtidas/visualizações/comentários) | Ordene a lista pelos três critérios e compare com os cartões de destaque | A publicação do cartão = a primeira da lista ordenada correspondente. |
| 9 | Datas | Data de cada publicação | Igual ao app (fuso do navegador); nenhuma "—" inesperada. |
| 10 | Última sincronização | Cabeçalho | Hoje, hora da sua ação; sem "Última tentativa (falhou)". |
| 11 | Avisos | Faixa âmbar | Nenhum, ou explicável (ex.: tudo "não disponível"). Se aparecer "Sem permissão para consultar visualizações", volte à Etapa 10/11. |
| 12 | Miniaturas | Role a lista | Imagens carregam; as que falharem mostram o ícone padrão. |

**Diferenças esperadas (não são erros):**
- Curtidas/comentários/visualizações do painel são a **soma das até 100 publicações mais recentes** da última sincronização, **não** o total histórico do perfil. O texto de cada cartão informa "Soma de N de M publicações…".
- Publicações **impulsionadas**: a API orgânica exclui curtidas/comentários de anúncios [DOC].
- Visualizações por publicação podem diferir do app (atraso, outras superfícies); a soma só inclui publicações com a métrica.
- Stories não entram (não são lidos por este endpoint).
- Valores "Indisponível" ficam fora das somas e dos rankings.

**Uma resposta HTTP 200 não basta**: considere válida a primeira sincronização somente se as linhas 1–10 acima conferirem **e** os documentos do Firestore estiverem como na Etapa 26.

---

## 9. Sincronização automática

**Etapa 29 — Validar o cron (sem acioná-lo)**
- **Onde:** Vercel → Settings → **Cron Jobs**.
- **Passo a passo:**
  1. **Cadastro:** `/api/instagram-sync` com `0 9 * * *` deve estar listado.
  2. **Expressão:** `0 9 * * *` = minuto 0, hora 9, todos os dias. A Vercel usa **UTC**. Brasília (UTC−3, sem horário de verão) → **06:00**. No plano **Hobby** a execução pode ocorrer a qualquer momento entre **06:00 e 06:59 (Brasília)** [DOC].
  3. **Plano:** a configuração (1x/dia) é permitida no Hobby [DOC].
  4. **Autenticação:** a Vercel envia `Authorization: Bearer <CRON_SECRET>` automaticamente se `CRON_SECRET` existir no projeto [DOC]; o código rejeita (401) qualquer chamada sem esse cabeçalho e retorna 500 se `CRON_SECRET` não estiver configurado. **Não** tente chamar o endereço do cron manualmente com o segredo.
  5. **Logs:** na linha do cron, **View Logs** (abre os logs com `requestPath:/api/instagram-sync`). O cron roda em `GET`; a manual aparece como `POST`.
  6. **Confirmar que rodou:** no dia seguinte, `instagramMeta/profile.syncedAt` deve estar entre 09:00 e 09:59 UTC (06:00–06:59 Brasília) e o painel deve mostrar essa data.
  7. **Falhou?** A Vercel **não** repete cron com falha [DOC]. Veja o log, corrija a causa e use **Sincronizar agora**.
- **Conclusão:** cron listado, e no dia seguinte `syncedAt` atualizado automaticamente.

---

## 10. Solução de problemas

| O que aparece | Causa provável | O que fazer |
|---|---|---|
| "Integração não configurada: defina INSTAGRAM_ACCESS_TOKEN…" (503) | Variável ausente neste deploy | Cadastrar (Etapa 15) **e** fazer novo deploy. |
| "O token do Instagram expirou ou foi revogado…" (502, Meta código 190) | Token expirado, trocado de conta, senha alterada | Gerar novo token (Etapa 11), atualizar a variável, novo deploy. |
| "A Meta negou a permissão necessária…" (502) | Escopo `instagram_business_basic` ausente | Regenerar o token concedendo as permissões (Etapa 10). |
| "Limite de requisições da Meta atingido" (429) | Muitas chamadas | Aguarde; não repita em loop. |
| "A API do Instagram está indisponível" (503) | Falha de rede/5xx da Meta | Tente de novo mais tarde. |
| "A API do Instagram recusou a requisição…" (502) | Campo recusado (risco 1), versão, parâmetros | Repita os Testes 3–5 e envie a mensagem do `#100` (sem token). |
| "Faça login novamente." (401) | Sessão expirada | Saia e entre de novo no `/admin`. |
| "Acesso restrito a administradores." (403) | Seu UID não está em `admins` | Etapa 19. |
| "Não foi possível validar o acesso agora." (503) | `FIREBASE_API_KEY`/`VITE_FIREBASE_API_KEY` ou `FIREBASE_PROJECT_ID`/`VITE_FIREBASE_PROJECT_ID` ausentes no runtime, ou Firebase fora do ar | Conferir Etapa 14. O upload de miniaturas usa o mesmo mecanismo: se ele funciona em produção, essas variáveis estão corretas. |
| "A sincronização falhou; consulte os logs." (500) | Erro interno — tipicamente credenciais do Firebase Admin ausentes/ inválidas | Verifique `FIREBASE_SERVICE_ACCOUNT_KEY` (Etapa 14) e os logs (Etapa 25). |
| "Já existe uma sincronização em andamento." | Outra execução (cron ou clique anterior) está rodando | Aguarde até 2 min; a reserva expira sozinha. |
| "Sincronizado há menos de 1 minuto…" / "A última tentativa falhou há menos de 1 minuto…" | Intervalo mínimo de 60 s entre tentativas manuais | Aguarde 1 minuto. |
| "Não foi possível carregar os dados do Instagram." | Regras do Firestore não publicadas, ou você não é admin | Etapas 19–22. |
| "Nenhum dado ainda…" | Nunca sincronizou | Etapa 24. |
| Faixa âmbar "Sem permissão para consultar visualizações (…)" | Token sem `instagram_business_manage_insights` | Regenerar o token com esse escopo; sincronizar de novo. Valores antigos ficam como "(desatualizado)". |
| Faixa "N de M consultas de visualizações falharam…" | Falhas temporárias da Meta **ou** respostas que o código não reconhece como "não existe" (ex.: carrosséis, Teste 8) | Repita depois; se persistir, envie o erro do Teste 8. |
| Faixa "A Meta informou que as visualizações não estão disponíveis…" | Todas as consultas voltaram vazias/sem suporte | Teste 6/7: pode ser formato de resposta diferente ou `views` indisponível para a conta. |
| Faixa "O token do Instagram expira em N dia(s)" | Menos de 14 dias de validade | Gerar novo token e atualizar a variável. |
| Todas as visualizações "Indisponível" mas sem faixa | Poucas publicações com `views` | Normal para carrosséis/conteúdo antigo. |

---

## 11. Checklist final (resumo curto)

1. [ ] Conta profissional confirmada (Etapas 1–3).
2. [ ] App **Business** com Instagram Login e conta adicionada (Etapas 4–9).
3. [ ] Token gerado com `instagram_business_basic` e `instagram_business_manage_insights`, guardado com segurança (Etapas 10–12).
4. [ ] Testes 1, 3, 4, 5, 6 sem erro; testes 7 e 8 interpretados (Etapa E).
5. [ ] Variáveis na Vercel: `INSTAGRAM_ACCESS_TOKEN`, `CRON_SECRET`, credenciais do Admin SDK, ID do projeto e chave web do Firebase (Etapas 13–15).
6. [ ] Regras comparadas, publicadas **com autorização**, e Playground ok (Etapas 20–22).
7. [ ] Deploy de produção com o módulo (autorização) (Etapa 16).
8. [ ] Sincronização manual com status 200, sem erros no log (Etapas 24–25).
9. [ ] Firestore com `instagramMeta/profile`, `instagramPosts` e lock liberado (Etapa 26).
10. [ ] Números conferem com o app do Instagram (Etapa 28).
11. [ ] No dia seguinte, o cron atualizou `syncedAt` sozinho (Etapa 29).

---

## 12. Riscos e bloqueios (estado real)

| Item | Estado atual | Evidência | Ação necessária | Responsável |
|---|---|---|---|---|
| Código do módulo em produção | **Commitado e enviado; PR #25 aberto; preview da Vercel aprovado; produção aguarda o merge** | Commit `70ed310`; check "Vercel" do PR = pass | Mergear o PR (depois de regras e token) | Você (ou Claude, se pedir) |
| Conta profissional | **A verificar** (sem acesso) | — | Etapas 1–3 | Você |
| Aplicativo da Meta | **A verificar** (sem acesso) | Documentação exige tipo **Business** | Etapas 4–8 | Você |
| Permissões | **A verificar** | Escopos exigidos pelo código identificados; lista da documentação inconsistente quanto a `manage_insights` | Etapas 9–10 | Você |
| Token | **Pendente** | Não existe/ não foi validado | Etapas 11–12 | Você |
| `media_product_type` / `caption` | **Bloqueio potencial** | Tabela da referência marca "não disponível" no Instagram Login; exemplo da doc pede `caption` | Testes 3 e 4 antes de implantar | Você (testa) e Claude (corrige se falhar) |
| `views` e formato da resposta | **A verificar** | Feed/Reels documentados; formato da resposta não obtido; álbum sem insights | Testes 6–8 | Você e Claude |
| Versão `v23.0` | **Não confirmado** | Documentação mostra `v25.0` | Teste 10 (e `INSTAGRAM_API_VERSION` se preciso) | Você |
| Variáveis da Vercel | **A verificar** | Código exige: token, `CRON_SECRET`, Admin SDK, ID do projeto, chave web | Etapas 13–15 | Você (ou Claude, com autorização) |
| Regras do Firestore | **Comparadas (idênticas a `main`); NÃO publicadas** | Lidas via Firebase CLI em 03/10: publicadas = `main`; branch = `main` + bloco do Instagram; emulador: 3 testes passam; `firestore.indexes.json` ausente (use `--only firestore:rules`) | Etapa 21 (1 comando) | **Você** (publicação em produção foi negada a mim) |
| Plano / duração (`maxDuration: 60`) e crons | **Aceitos** | Deploy de preview da Vercel concluído com o `vercel.json` atual | Conferir em Settings → Cron Jobs após o merge | Você |
| Primeira sincronização | **Pendente** | — | Etapas 23–27 | Você |
| Validação dos dados | **Pendente** | — | Etapa 28 | Você e Claude |
| Cron automático | **Configurado, não validado** | `0 9 * * *`; Hobby exige 1x/dia (ok); precisão ±59 min | Etapa 29 | Você |

**Bloqueios que impedem avançar:** (1) Testes 3 e 4; (2) regras publicadas (Etapa 21); (3) token na Vercel; (4) merge do PR.
**Podem esperar:** tokenExpiresAt (preenche no dia seguinte), validação do cron, comparação fina de visualizações.

---

## 13. Pendências (dependem de você, acesso ou autorização)

- Publicar as regras (Etapa 21) e mergear o PR #25 (ou me pedir o merge).
- Criar/confirmar o app Meta, a conta, as permissões e o token.
- Cadastrar `INSTAGRAM_ACCESS_TOKEN` e conferir as demais variáveis.
- Executar os Testes 1–10 e me enviar **apenas** os resultados dos que falharem (sem tokens).
- Executar a primeira sincronização e a conferência da Etapa 28.
- Confirmar: modo do app (Development/Live), plano da Vercel, e se a `v23.0` continua aceita.
