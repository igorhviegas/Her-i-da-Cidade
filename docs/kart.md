# Campeonato Viegas Kart (`/kart`)

Classificação, perfis dos pilotos, histórico de corridas e vídeos do campeonato anual no Kartódromo de Betim. Área pública sem login (como o `/agente-hdc`), fora do Google (`noindex`). Administração em `/admin/kart` (grupo **Pessoal**).

## Regras

- **Só pilotos inscritos** pontuam. O relatório de cronometragem traz todo mundo da bateria; quem não está em `kartPilots` é descartado e os inscritos são **reclassificados entre si** (P9 na bateria e 1º entre os inscritos = P1).
- **Pontos por posição entre os inscritos:** P1 25, P2 22, P3 20, P4 19 … P20 3 (23 − posição a partir do 3º; P21 = 2, P22 = 1, depois 0). Implementado em `pointsFor` (`services/kart.js`).
- **Corrida oficial:** 3 ou mais pilotos inscritos (`MIN_OFFICIAL_PILOTS`). O Notion dizia "mais de 3", mas as corridas de 13/02/2024, 11/05/2024, 05/10/2024 e 15/08/2026 têm exatamente 3 inscritos e estão no histórico "válidas" e nos totais do Notion, então a regra efetiva é 3 ou mais. Corridas com menos que isso não são salvas.
- **Ranking padrão = últimas 10 corridas oficiais.** Também há "Todo o período" e um filtro por ano. Toda linha mostra quantas corridas o piloto fez no período.
- **Desempate:** mais vitórias, depois melhor volta.
- **Pódio:** aparece nos dois rankings (pontos e melhor volta). Cada piloto do pódio e cada linha da lista mostram corridas, vitórias e pódios do período.
- **Melhor volta:** ranking por piloto no período. Volta na chuva é sinalizada (nuvem) e **não vale como recorde da pista** (o card "Recorde da pista" só considera piso seco).
- **Corridas fora do campeonato (avulsas):** sessões em que o piloto vai sozinho (ou com amigos) tentar baixar a volta. **Não dão pontos, vitórias nem pódios e não contam nas corridas do piloto**, mas **valem para o ranking de melhor volta e para o recorde da pista**. No ranking padrão (últimas 10) entram as avulsas desde a data da corrida mais antiga do período; em "Todo o período" e por ano, as do intervalo. Ficam no fim da aba Corridas, atrás de um botão vermelho com o aviso, e também no perfil do piloto.
- **Campeões** (`/kart/campeoes`): o campeão de cada ano é o 1º em pontos no ano (ranking por ano, mesmas regras). Só ano **encerrado** (anterior ao ano corrente) dá título; o ano corrente aparece "em andamento" com o líder atual. A página lista os 3 primeiros de cada ano e "Maiores campeões"; o perfil mostra o selo de campeão com os anos.
- **Perfil do piloto** (`/kart/piloto/{id}`): ouro/prata/bronze conforme a posição no **ranking padrão (últimas 10)**; mostra pontos e corridas das últimas 10, vitórias, pódios, recorde de volta (inclui avulsas), gráfico de forma e o histórico completo, em que cada corrida abre o resultado como na aba Corridas.

## Dados (Firestore)

Leitura pública, escrita só de administradores (`firestore.rules` e a cópia `firestore.rules.txt`).

| Coleção | Conteúdo |
|---|---|
| `kartPilots/{id}` | `name`, `aliases[]`, `active`. O `id` é o nome sem acento, em minúsculas e com hífens. |
| `kartRaces/{data}-{hhmm}` | `date`, `heat`, `weather` (`dry`/`rain`), `extra` (true = fora do campeonato), `pdfUrl` (relatório original no Vercel Blob), `results[]` = `{ pilotId, name, pos, racePos, bestLapMs, laps }`. Importar o mesmo PDF de novo substitui a corrida. Avulsas têm id `extra-{data}-{hhmm ou código}`. |
| `kartConfig/next` | Próxima corrida: `date`, `time`, `place`, `note` (sem confirmação de presença). O card some sozinho depois da data (fuso de Brasília). |
| `kartVideos/{id}` | `title`, `youtubeId`, `kind` (`tip`/`race`), `order`, `active`, `raceId` (opcional: corrida a que o vídeo pertence). |

O número da corrida ("Corrida 12") **não é gravado**: é a posição cronológica entre as corridas oficiais. O nome exibido vem do cadastro de pilotos, então renomear um piloto vale para o histórico todo.

## Importar o PDF de uma corrida

Admin → Kart → Corridas → **Escolher PDFs** (aceita vários de uma vez). O PDF é lido no navegador (`services/pdfImportBrowser.ts`, sem OCR; os relatórios do LapTime têm texto nativo) e interpretado por `parseTimingReport` (`services/kart.js`), que cobre os dois formatos do kartódromo (`TimingOfficialReport` e `*_CRD`). Bateria com menos de 3 inscritos vem marcada como **fora do campeonato** (dá para desmarcar/marcar em qualquer PDF). Cuidado: o recorde da pista vale para qualquer sessão avulsa, então não importe uma bateria de outra categoria (ex.: Super Kart) como avulsa. A tela de conferência mostra data, bateria, os inscritos reclassificados e a lista dos descartados; **clima (seco/chuva) não vem no PDF**, então é escolhido ali.

O nome do relatório é o nome completo (ex.: `LEMUEL KESSELEH`). Um piloto casa quando **todos os termos** do nome cadastrado (ou de um apelido) estão no nome do PDF, sem acento e ignorando "de/da/do". Se alguém fica de fora por grafia diferente, cadastre um apelido em Admin → Kart → Pilotos. Quem aparece no PDF mas ainda não é inscrito pode ser **inscrito na própria prévia**: abra "fora do campeonato (descartados)", clique em **Inscrever** ao lado do nome (o nome vem sugerido do relatório e pode ser encurtado) e a prévia se recalcula na hora, sem reimportar.

Os PDFs originais ficam arquivados em `docs/kart/resultados/oficiais/AAAA-MM-DD_HHMM.pdf` (e `fora-do-campeonato/` para baterias sem inscritos suficientes).

## Página da corrida e PDF original

Cada corrida tem página própria, `/kart/corrida/{id}`, aberta pelo ícone ↗ da lista (a lista continua simples, com o resultado expansível). A página mostra data, pista, vencedor, melhor volta, o vídeo vinculado e o resultado completo, e tem o botão **Baixar PDF original** e o de **Compartilhar**.

O PDF fica no Vercel Blob (`/api/upload-kart-pdf`, só administradores, até 4 MB, valida `%PDF-`) e o link vai em `pdfUrl`. A lógica está em `functions/kart-pdf-upload.js`; **não é uma função nova em `api/`**: o plano Hobby da Vercel limita `api/` a 12 funções (já estava no limite e o deploy falhou com 13), então `vercel.json` reescreve `/api/upload-kart-pdf` para `api/upload-agent-audio.ts?kind=kart-pdf`, que repassa ao módulo. Ele é enviado **ao importar**. Para anexar o PDF a corridas já salvas, importe os PDFs de novo: o clima e o tipo (avulsa) da corrida salva são mantidos, só o PDF é acrescentado. Corridas lançadas à mão não têm PDF.

## Próxima corrida

Admin → Kart → Corridas → **Próxima corrida**: data, horário, local e recado (opcionais). Aparece como card no topo do ranking e some depois da data.

## Confronto direto

`/kart/confronto?p=id1,id2,…` compara de 2 a 5 pilotos (o endereço guarda a escolha, então dá para mandar o link). Mostra pontos, corridas, vitórias, pódios, pontos por corrida, posição média e melhor volta (a melhor de cada linha em destaque), os **duelos** (nas corridas em que os dois correram, quem terminou na frente), a evolução da melhor volta e as corridas em comum. Aceita os mesmos períodos do ranking. Entradas: botão "Comparar pilotos" no ranking e "Comparar com outros pilotos" no perfil.

## Gráficos do perfil

- **Forma:** uma coluna por corrida das últimas 10 (mais antiga à esquerda), com a posição no topo, os pontos na barra (altura até 25) e a data embaixo. Cor: ouro P1, prata P2, bronze P3, azul as demais.
- **Evolução da melhor volta:** uma ponto por corrida (campeonato ●, avulsa ◆); a linha forte é o recorde pessoal e os pontos com anel são as voltas que o baixaram. Volta na chuva fica fora do gráfico (não é comparável). O mesmo gráfico, com uma linha por piloto, aparece no confronto.

## Compartilhar (imagem para o Story)

O ícone de compartilhar fica no ranking (pontos e melhor volta), em cada corrida e no confronto. Gera no navegador uma imagem **1080 × 1920** (formato Story) com a marca, o conteúdo e `heroidacidade.com/kart`; no celular abre o compartilhamento do sistema, no computador baixa o PNG. Os textos vêm de `services/kartShare.js` (testado) e o desenho de `components/kart/kartStoryCanvas.ts`.

## Lançar ou corrigir uma corrida à mão

Admin → Kart → Corridas → **Lançar corrida manualmente** (para corridas sem PDF). Informe data, horário da bateria (opcional) e clima, depois adicione os inscritos **na ordem de chegada entre eles** (setas reordenam) com a melhor volta de cada um, se tiver (`1:13.169`, `1.13.169` ou `1:14.20`). Precisa de 3 ou mais pilotos. Marque **Corrida fora do campeonato** para uma sessão avulsa: aceita 1 piloto ou mais, a melhor volta de cada um é obrigatória e a ordem é pela volta. O lápis na lista de corridas salvas reabre o mesmo formulário para corrigir uma corrida (inclusive as importadas); mudar a data ou o horário move a corrida em vez de duplicá-la.

## Vídeos

Admin → Kart → Vídeos: cole o link do YouTube (watch, youtu.be, shorts, embed), dê um título e escolha **Dicas** ou **Corridas completas**. Toca na própria página com `youtube-nocookie.com`. Em vídeos de **Corrida completa** dá para escolher a corrida: o resultado dela (aba Corridas e histórico do perfil) ganha o botão **Assistir à corrida**, que abre `/kart/videos?v={id}` já tocando. Corrida com mais de um vídeo usa o primeiro pela ordem.

## Testes

`tests/firestore-rules-kart.test.js` (regras no emulador: leitura pública e escrita só de admin; `npm run test:rules`) e `tests/api-kart-pdf.test.js` (upload do PDF). `services/kart.test.js` (parser dos dois formatos, casamento de nomes, pontos, rankings, perfil e links do YouTube), incluído em `npm test`. Fixtures em `services/fixtures/kart-timing-*.txt`.
