# Página dos clientes (`/clientes`)

Destino do QR Code do certificado entregue na festa. Pública, sem login, fora do Google (`noindex` no `App.tsx` e `X-Robots-Tag` no `vercel.json`; isso **não** é controle de acesso).

Ordem da página: cabeçalho (com Instagram) → vídeo de agradecimento → busca → carrossel de destaques → pedido de áudio → rodapé (com Instagram).

## O que é reaproveitado

| Parte | De onde vem |
|---|---|
| Busca | `VideoSection` da home (`showBadges={false}` esconde os selos). Mesmo formulário e mesmo destino: `/videos?search=termo`. Não há segunda busca. |
| Carrossel | `VideoRow` + `VideoCardVertical` do catálogo. Os cards abrem o `VideoPlayerFullscreen` do catálogo, na própria página, com anterior/próximo. |
| Vídeos | Coleção `videos` (leitura pública), via `subscribeToVideos`. Só vídeos reais e ativos; sem vídeos, a seção some. |
| Identidade visual | Mesmo fundo, fontes, cores e cabeçalho de marca de `/agendar-chamada`. |

## Admin: Streaming → Página dos clientes (`/admin/pagina-clientes`)

Grava em `siteConfig/public` (leitura pública, escrita só de administrador; nenhuma regra nova):

| Campo | Para quê |
|---|---|
| `clientsVideoUrl` | Vídeo de agradecimento. YouTube (público ou **não listado**: `watch?v=`, `youtu.be/`, `shorts/`) ou arquivo direto `https://….mp4`/`.webm`/`.mov`/`.m4v`. Vazio = padrão `https://youtu.be/SzTLExDEMQY`. |
| `clientsVideoOrientation` | `horizontal` (padrão) ou `vertical` (Reel/Short). |
| `clientsVideoPoster` | Capa opcional (HTTPS). No YouTube, a capa do próprio vídeo é usada se faltar. |
| `clientsFeaturedVideoIds` | Vídeos do carrossel, na ordem escolhida (até 10). |

- **Vídeo de agradecimento:** o admin tem prévia e só deixa salvar com link reconhecido. Reel **privado** do Instagram não pode ser incorporado; por isso o vídeo está no YouTube. Nada toca sozinho: o YouTube só carrega depois do toque na capa e o arquivo usa os controles nativos. Link inválido salvo por fora do admin mostra "estará aqui em breve" em vez de player quebrado.
- **Destaques:** com vídeos selecionados, a página mostra exatamente esses, na ordem (inativos e removidos do catálogo são ignorados). Sem seleção, usa o vídeo em destaque do catálogo (`featured`) e depois os primeiros pela ordem do catálogo (`order`, depois os mais recentes).

Lógica pura e testada em `services/clientsPage.js` (`resolveClientsConfig`, `pickFeaturedVideos`, `parseThankYouVideo`).

## Pedido de áudio personalizado

Sem servidor e sem registro: o formulário só prepara a mensagem e abre o WhatsApp (`31 99746-2823`, `https://wa.me/5531997462823`). Quem grava confere no próprio WhatsApp o que já atendeu, usando data do evento e nome da criança.

- Fluxo: formulário (data, nome, texto, aviso e aceite) → revisão → WhatsApp com a mensagem pronta. O botão fica desabilitado enquanto algo estiver inválido.
- Validação em `services/audioRequest.js`: data real e não futura; nome só com letras; texto de 5 a 500 caracteres; aceite obrigatório.
- **Aviso** (`AUDIO_NOTICE`, no formulário e na revisão): cada cliente tem direito a um único áudio gratuito; os áudios são gravados pelo Herói no estúdio e a solicitação não garante gravação ou envio imediatos. É só texto: o controle de quem já recebeu o áudio é interno, sem sistema no site.
- A mensagem (`buildWhatsAppMessage`: olá, data do evento, nome da criança e a mensagem desejada) é codificada com `encodeURIComponent`: acentos, pontuação e quebras de linha chegam inteiros.
- A janela do WhatsApp abre no próprio toque; a tela final repete o botão por segurança. O site nunca diz que a mensagem foi enviada: ela só chega depois que o cliente toca em enviar no WhatsApp.
- Nada é gravado no Firestore nem registrado em log.

## Deploy

Sem variáveis novas, sem coleção nova e sem alteração em `firestore.rules`. Testes: `npm test` (`services/audioRequest.test.js`, `services/clientsPage.test.js`).
