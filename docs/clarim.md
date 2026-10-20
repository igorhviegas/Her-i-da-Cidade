# Clarim Semanal (`/admin/espaco-criativo/clarim-semanal`)

Jornal da semana nos Stories, inspirado no Daily Bugle com identidade própria (masthead "CLARIM ◎ SEMANAL" no gradiente da logo, selo com o trompete). Toda segunda: criar a edição da semana anterior, escolher as páginas, completar, aprovar e baixar cada uma em PNG 1080 × 1920.

## Fluxo

1. **Nova edição**: período padrão = segunda a domingo da semana anterior (Brasília); dá para mudar as datas.
2. **Adicionar página**: Capa, Eventos presenciais, Desempenho dos vídeos, Notícia livre, Classificados. Páginas são opcionais e podem se repetir (duas de eventos, por exemplo). Ordem com as setas.
3. **Editor da página**: campos à esquerda, a arte à direita. A prévia **é** o PNG final (o mesmo canvas), então o que se vê é o que se baixa.
4. **Salvar → Aprovar arte → Baixar PNG**. No celular, "Baixar" abre o compartilhar do sistema (dá para mandar direto para os Stories).
5. **Marcar como publicada nos Stories** na edição, quando postar.

Estados da página: *Faltam itens* (algo obrigatório falta, texto não coube ou imagem não carregou), *Pronta para revisar*, *Aprovada*. Mudar qualquer coisa depois de aprovar volta para revisão (a aprovação guarda uma impressão digital do conteúdo, `pageHash`). A edição nunca trava por causa de uma página.

## Templates (`components/admin/clarim/clarimCanvas.ts`)

| Página | Dados automáticos | Editável |
|---|---|---|
| Capa | Reel com mais visualizações **ganhas na semana** (retratos diários de `instagramStats`), seguidores atuais e ganho na semana, índice da edição | foto (vídeo ou foto enviada), manchete (com sugestão), legenda, 2 chamadas com página, anúncio |
| Eventos presenciais | Festas do período (serviço 6) **só com autorização de imagem no pedido** | até 3 festas e uma foto de cada (recorte e zoom), manchete, texto, crédito, anúncio |
| Desempenho dos vídeos | Top 3 em visualizações ganhas, total da semana, vídeos novos | seção e manchete; os números não são editáveis |
| Notícia livre | — | com foto ou "Aviso" sem foto, manchete, linha fina, texto, crédito, anúncio |
| Classificados | Nome, preço e descrição do cadastro do serviço | 4 a 6 serviços; cada um com arte (horizontal/quadrada) ou só texto |

Medidas: grade com margem de 56 px; tudo que importa fica entre y 240 e 1660 (o Instagram cobre o topo e a base). Rodapé com heroidacidade.com e @oheroidacidade em todas as páginas. Fontes: Anton, Big Shoulders Display, Oswald e PT Serif (Google Fonts, conferidas antes de desenhar; se não carregarem, a página não é desenhada). Papel amassado (`public/images/clarim/papel.jpg`) por cima de tudo, em multiplicação.

**Texto que não cabe** no tamanho mínimo vira pendência ("encurte o texto") e impede a aprovação; nada é cortado em silêncio. Descrição de serviço (dado do cadastro) é encurtada com reticências.

**Anúncios** saem do gerador de artes dos serviços (Serviços → Artes do serviço, `serviceArtCanvas.ts`), sem cadastro separado. O formato vem da proporção do espaço (`pickAdFormat`), com troca manual; a arte nunca é esticada. Serviço sem fundo no formato do espaço não aparece na lista daquele espaço.

**Miniaturas dos vídeos**: usa a cópia permanente do catálogo (`videos.thumbnailUrl`, Vercel Blob) quando o Reel foi importado; a da Meta expira e costuma não liberar CORS. Sem miniatura, a página avisa.

## Privacidade (fotos de crianças)

- Fotos ficam no **Firebase Storage privado** (`clarim/{edição}/{página}/…`), lidas só por administrador (`storage.rules`); nenhuma URL pública. O Vercel Blob (público) não é usado para elas.
- Só entram festas com `eventForm.imageAuthorization: true` e formulário completo/pago (`eventCandidates`). A aprovação confere de novo no banco (`revokedSources`); autorização retirada depois **derruba** a aprovação já dada e bloqueia o download (`consentIssues`).
- O nome da criança nunca aparece na arte (nenhuma autorização atual cobre o nome).
- A aprovação grava quem aprovou e quando; as regras exigem o próprio usuário e a hora do servidor.
- Festa desmarcada: a foto dela é apagada ao salvar. Excluir página/edição apaga as fotos.
- Retenção: o histórico fica até o responsável pedir a exclusão (decisão do dono, 19/10/2026). Pedido de exclusão: abrir a edição, remover a festa da página (ou excluir a página) e salvar; isso apaga a foto. PNGs já baixados ficam fora do sistema.

## Configuração (uma vez, fora do código)

1. **Firebase Storage**: no console do Firebase, ativar o Storage (projeto no plano Blaze) com o bucket `heroi-da-cidade.firebasestorage.app`.
2. **Regras**: `firebase deploy --only firestore:rules,storage` (as do Firestore ganharam `clarimEditions`).
3. **CORS do bucket** (o painel baixa as fotos com o SDK; sem isso a prévia não mostra as fotos já salvas):
   `gsutil cors set storage-cors.json gs://heroi-da-cidade.firebasestorage.app`
   O `storage-cors.json` libera `GET` só para heroidacidade.com, www e o `localhost:3000`. Pré-visualização da Vercel em outro domínio precisa ser acrescentada lá.

## Dados (Firestore)

- `clarimEditions/{id}`: `number`, `periodStart`, `periodEnd`, `status` (`draft`/`published`), `publishedAt`, `createdAt`, `updatedAt`.
- `clarimEditions/{id}/pages/{pageId}`: `template`, `order`, `fields`, `photos` (`{ slot: { path, x, y, zoom } }`), `ads` (`{ slot|serviceId: { serviceId, format } }`), `sources` (ids de pedidos), `services`, `approval` (`{ by, at, hash }`).

Testes: `services/clarim.test.js` (período, elegibilidade, ganho de views, seguidores, anúncio, texto, aprovação) e `tests/firestore-rules-clarim.test.js` (emulador).

## Fora desta versão

Videochamadas (depende de pedir autorização de print no agendamento), promoções com validade, ZIP/compartilhar todas, arquivo público no site.
