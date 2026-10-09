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
- **Perfil do piloto** (`/kart/piloto/{id}`): ouro/prata/bronze conforme a posição no **ranking padrão (últimas 10)**; mostra pontos e corridas das últimas 10, vitórias, pódios, recorde de volta (inclui avulsas), gráfico de forma e o histórico completo, em que cada corrida abre o resultado como na aba Corridas.

## Dados (Firestore)

Leitura pública, escrita só de administradores (`firestore.rules` e a cópia `firestore.rules.txt`).

| Coleção | Conteúdo |
|---|---|
| `kartPilots/{id}` | `name`, `aliases[]`, `active`. O `id` é o nome sem acento, em minúsculas e com hífens. |
| `kartRaces/{data}-{hhmm}` | `date`, `heat`, `weather` (`dry`/`rain`), `extra` (true = fora do campeonato), `results[]` = `{ pilotId, name, pos, racePos, bestLapMs, laps }`. Importar o mesmo PDF de novo substitui a corrida. Avulsas têm id `extra-{data}-{hhmm ou código}`. |
| `kartVideos/{id}` | `title`, `youtubeId`, `kind` (`tip`/`race`), `order`, `active`. |

O número da corrida ("Corrida 12") **não é gravado**: é a posição cronológica entre as corridas oficiais. O nome exibido vem do cadastro de pilotos, então renomear um piloto vale para o histórico todo.

## Importar o PDF de uma corrida

Admin → Kart → Corridas → **Escolher PDFs** (aceita vários de uma vez). O PDF é lido no navegador (`services/pdfImportBrowser.ts`, sem OCR; os relatórios do LapTime têm texto nativo) e interpretado por `parseTimingReport` (`services/kart.js`), que cobre os dois formatos do kartódromo (`TimingOfficialReport` e `*_CRD`). Bateria com menos de 3 inscritos vem marcada como **fora do campeonato** (dá para desmarcar/marcar em qualquer PDF). Cuidado: o recorde da pista vale para qualquer sessão avulsa, então não importe uma bateria de outra categoria (ex.: Super Kart) como avulsa. A tela de conferência mostra data, bateria, os inscritos reclassificados e a lista dos descartados; **clima (seco/chuva) não vem no PDF**, então é escolhido ali.

O nome do relatório é o nome completo (ex.: `LEMUEL KESSELEH`). Um piloto casa quando **todos os termos** do nome cadastrado (ou de um apelido) estão no nome do PDF, sem acento e ignorando "de/da/do". Se alguém fica de fora por grafia diferente, cadastre um apelido em Admin → Kart → Pilotos.

Os PDFs originais ficam arquivados em `docs/kart/resultados/oficiais/AAAA-MM-DD_HHMM.pdf` (e `fora-do-campeonato/` para baterias sem inscritos suficientes).

## Lançar ou corrigir uma corrida à mão

Admin → Kart → Corridas → **Lançar corrida manualmente** (para corridas sem PDF). Informe data, horário da bateria (opcional) e clima, depois adicione os inscritos **na ordem de chegada entre eles** (setas reordenam) com a melhor volta de cada um, se tiver (`1:13.169`, `1.13.169` ou `1:14.20`). Precisa de 3 ou mais pilotos. Marque **Corrida fora do campeonato** para uma sessão avulsa: aceita 1 piloto ou mais, a melhor volta de cada um é obrigatória e a ordem é pela volta. O lápis na lista de corridas salvas reabre o mesmo formulário para corrigir uma corrida (inclusive as importadas); mudar a data ou o horário move a corrida em vez de duplicá-la.

## Vídeos

Admin → Kart → Vídeos: cole o link do YouTube (watch, youtu.be, shorts, embed), dê um título e escolha **Dicas** ou **Corridas completas**. Toca na própria página com `youtube-nocookie.com`.

## Testes

`services/kart.test.js` (parser dos dois formatos, casamento de nomes, pontos, rankings, perfil e links do YouTube), incluído em `npm test`. Fixtures em `services/fixtures/kart-timing-*.txt`.
