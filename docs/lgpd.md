# LGPD: auditoria e como atender titulares

Auditoria de 13/10/2026 (código do repositório). **Não é parecer jurídico** e não declara conformidade: o que depende de decisão do negócio ou de advogado está em [Pendências](#pendências-que-dependem-do-responsável-ou-de-assessoria-jurídica).

Política pública: `/privacidade` (`components/PrivacyPage.tsx`). Textos curtos dos formulários e dados do responsável: `services/privacy.js`.

## Inventário

| Fluxo | Onde | Dados | Base legal provável | Destinos |
|---|---|---|---|---|
| Agendar vídeo chamada | site (home e `/agendar-chamada`), `functions/video-call.js` | responsável: nome, e-mail, WhatsApp (e o da chamada); **criança: primeiro nome, idade**, tema, detalhes (texto livre); fuso do navegador | execução de contrato / procedimentos preliminares (art. 7º, V) | Firestore (`orders`, `clients`, trava `videoCallSlots`, `videoCallPending`), Google Agenda (evento com os mesmos dados), WhatsApp |
| Pedido de áudio | `/clientes`, `AudioRequestModal` | data da festa, nome da criança, mensagem | execução de contrato (pós-venda) | **nenhum servidor**: só abre `wa.me`; a mensagem vive na conversa de WhatsApp |
| Contratação pelo WhatsApp | ManyChat → `POST /api/manychat` | nome, WhatsApp, nome da criança, tema, detalhes | execução de contrato | ManyChat, WhatsApp, Firestore |
| Cadastro da festa | **Google Forms** (fora do repo), digitado/importado no CRM (`EventOrderFields`) | responsável; **criança: nome, data de nascimento, PCD/PNE (saúde, sensível)**; data, horário, endereço; autorização de imagem; extras | execução de contrato; PCD: ver pendências | Google Forms, Firestore (`orders.eventForm`), Google Agenda, WhatsApp do agente |
| Imagem/voz da criança | pergunta "Autorização do uso de imagens" no Google Forms; boolean `eventForm.imageAuthorization` no CRM | sim/não | **consentimento** (art. 14, §1º, e art. 7º, I) | só vale para redes sociais |
| Deslocamento (agente) | `/agente-hdc`, `api/travel-route.ts` | endereços dos eventos (digitados ou importados: só horário, local e tipo) | legítimo interesse / execução | Google Maps (Geocoding/Routes); nada gravado |
| Kart | `/kart` | nome e resultados dos pilotos inscritos; PDF original da cronometragem | consentimento/legítimo interesse (a definir) | Firestore, Vercel Blob (PDF público) |
| Equipe | Firebase Auth, `admins` | e-mail dos administradores | legítimo interesse / execução | Firebase |
| Fit, Alexa | área pessoal do dono | dados de saúde/treino e comandos de voz **do próprio dono** (Alexa: só o `userId` autorizado) | titular é o dono | Fit em `users/{uid}`: só ele lê |

Não há CPF, RG, cartão, nem endereço em cadastro de cliente. O CRM guarda do cliente só nome e WhatsApp (`clients`).

## Riscos e o que mudou

| # | Gravidade | Achado | Situação |
|---|---|---|---|
| 1 | Alta | Não havia política de privacidade nem aviso nos formulários que coletam dados de criança | **Corrigido**: `/privacidade`, links no rodapé da home, de `/agendar-chamada` e de `/clientes`; aviso de uma linha nos dois formulários públicos |
| 2 | Alta | Autorização de imagem com escopo vago ("uso de imagem") e junto da seção de termos de contratação, no Google Forms | **Parcial**: rótulos do CRM e política dizem "redes sociais". O Google Forms é externo: texto sugerido abaixo (**pendência**) |
| 3 | Média | PCD/PNE (dado de saúde de criança) é obrigatório (Sim/Não) no Google Forms; Google Agenda repete "PCD: Sim" | CRM já é opcional e agora explica; Forms: **pendência** |
| 4 | Média | PDF original da cronometragem do Kart (nome completo de todos da bateria, inclusive não inscritos) é público via "Baixar PDF original"; os PDFs também estão no repositório | **Pendência** (decisão do dono) |
| 5 | Média | Sem rotina nem tela para eliminar/anonimizar cliente: só "Excluir pedido", que **apaga o livro financeiro** do pedido | **Pendência**; procedimento manual abaixo |
| 6 | Média | Coleção legada `orderImports` (texto de PDFs importados, com nome/nascimento/endereço) sem uso no código e sem como apagar pelo navegador (regras: `delete: false`) | **Pendência**: decidir e apagar pelo console |
| 7 | Baixa | Trava `videoCallSlots` guardava o telefone e nunca é removida depois da chamada | **Corrigido** para novas reservas (a trava não guarda mais o telefone); travas antigas seguem como estão |
| 8 | Baixa | Nome de criança completo pedido sem necessidade (chamada e áudio) | **Corrigido**: rótulo "Primeiro nome da criança" (campo continua aceitando mais) |
| 9 | Baixa | Erro do Firestore no console/mensagem incluía o e-mail do administrador | **Corrigido** (`lib/firestore.ts`, `services/serviceCatalog/firestoreErrors.ts`) |
| 10 | Baixa | Tailwind (CDN) e Google Fonts recebem o IP do visitante | Informado na política; autohospedar é opcional (`docs/seguranca.md`) |
| 11 | Baixa | Campo livre "detalhes" da chamada pode receber dado sensível | Dica no campo; sem bloqueio (a família pode querer adaptar a chamada) |

Pontos que já estavam bons e **não** foram alterados: leitura de `clients`/`orders`/financeiro só por administrador (`firestore.rules`); dados do Fit só do dono; logs do servidor sem dados pessoais (só IDs); `/api/travel-route` devolve só horário, local e tipo; `activityLog` sem dados pessoais; sem rastreadores, pixels ou cookies de publicidade; reservas sem pagamento são excluídas sozinhas; pedido de áudio não é gravado em lugar nenhum.

## Pendências que dependem do responsável ou de assessoria jurídica

1. **Identificação**: razão social/nome empresarial, CNPJ do MEI e um e-mail para titulares. Preencher `PRIVACY_CONTROLLER` em `services/privacy.js` (campo vazio = a linha não aparece na política). Enquanto não houver e-mail, o canal é o WhatsApp oficial e o Instagram. Quem é o "encarregado" (art. 41) é decisão do negócio: agentes de pequeno porte podem ter regime simplificado (Resolução CD/ANPD nº 2/2022), mas o canal de contato é exigido. Validar com advogado.
2. **Google Forms "Formulário da Missão"** (o repositório não controla esse formulário): aplicar os ajustes abaixo.
3. **Autorização de imagem**: o termo vigente e o link "termos de contratação" não estão no repositório; não dá para afirmar que cobrem divulgação de imagem de criança. Advogado deve validar o texto. Se o consentimento passar a ser a base, guardar **data e versão do termo** junto do pedido (hoje o CRM só tem sim/não; a prova está na resposta do Google Forms: **não apague as respostas do Forms**).
4. **Retenção** (nada foi automatizado): definir prazos para (a) pedidos e clientes concluídos, (b) eventos do Google Agenda de festas e chamadas passadas, (c) respostas do Google Forms, (d) conversas de WhatsApp/ManyChat, (e) travas `videoCallSlots`/`videoCallPending` antigas. Registros fiscais e financeiros têm prazo legal próprio: não apagar por conta da LGPD.
5. **Anonimização de cliente**: precisa decidir o que preservar (valor, data, tipo de serviço) e o que apagar (nome, WhatsApp, nome da criança, local, texto). Só depois vale implementar uma tela.
6. **Coleção `orderImports`**: conferir no console se há documentos; se houver, decidir se apaga (não é usada pelo sistema).
7. **Kart**: decidir se o "PDF original" continua público (tem nomes completos de não inscritos) e se os inscritos concordaram com a exibição do nome (a maioria é do círculo do dono).
8. **Transferência internacional**: Google, Meta, ManyChat e Vercel podem tratar dados fora do Brasil (art. 33). A política informa; advogado deve validar se basta.
9. **Prazo de 15 dias** citado na política (art. 19, II): conferir com o advogado.

## Texto sugerido para o Google Forms (para copiar)

Seção **Termos de contratação** (só o aceite do contrato). Em seção **separada**, com título próprio:

> **Fotos e vídeos da festa**
> Durante a festa, podem ser feitas fotos e vídeos como parte do serviço. Você autoriza o Herói da Cidade a divulgar imagens e vídeos da festa, em que a criança apareça, nas redes sociais do Herói da Cidade (Instagram, TikTok e YouTube)?
> ( ) Sim, autorizo ( ) Não autorizo
> *Responder "Não" não muda a sua contratação. Você pode mudar de ideia a qualquer momento, pelo WhatsApp oficial, e retiramos o que foi publicado. Veja a Política de Privacidade: https://www.heroidacidade.com/privacidade*

Ajustes nas perguntas:
- **Possui alguma necessidade especial (PCD/PNE)?** deixar **opcional** e incluir "Prefiro não informar". Descrição: "Só para o Herói adaptar a atuação."
- **Data de nascimento**: trocar por **"Que idade a criança vai completar?"** (basta para o vídeo convite e para a atuação).
- **Nome do aniversariante**: o primeiro nome costuma bastar; o nome completo só se for necessário para o serviço.
- No início do formulário, uma linha: "Usamos estes dados só para organizar a sua festa. Detalhes na Política de Privacidade: https://www.heroidacidade.com/privacidade".

Depois de aplicar, atualize a política (`components/PrivacyPage.tsx`) se a pergunta de saúde virar opcional.

## Como atender um pedido de titular

Confirme que é o titular (ou o responsável pela criança) pelo mesmo WhatsApp usado na contratação. Os dados estão em:

| Onde | Como achar | Ação |
|---|---|---|
| CRM (`clients`, `orders`) | Admin → Clientes / busca por WhatsApp | corrigir: **Editar pedido / cliente**. Eliminar: "Excluir pedido" só para pedido **sem** valor fiscal, pois remove o livro financeiro dele; para os demais, edite o texto e o nome da criança em vez de excluir (anonimização manual) |
| Índice `clients/whatsapp_<número>` e travas | Console do Firebase | remover junto, se o cliente for eliminado |
| Google Agenda | evento com o nome do cliente | editar/excluir (Calendário, no admin) |
| WhatsApp / ManyChat | conversa e contato | excluir o contato no ManyChat; apagar a conversa no WhatsApp do negócio |
| Google Forms | respostas do formulário da festa | editar/excluir a resposta (guarde a prova de autorização enquanto a imagem estiver em uso) |
| Redes sociais | publicação com a criança | remover, se a autorização foi retirada |

Autorização de imagem retirada: marcar **Não** no pedido (Editar pedido → autorização) e retirar os conteúdos publicados.

## Para quem altera o código

- Formulário público novo? Reaproveite `services/privacy.js` (uma linha + link `target="_blank"`, para não perder o que foi digitado) e peça só o necessário. **Não** crie caixa de consentimento genérica: a base é o contrato; consentimento só para o que é opcional (imagem).
- Dado de criança: primeiro nome, idade; evite data de nascimento, endereço, foto.
- Logs: IDs, nunca nome, telefone, e-mail ou texto digitado.
