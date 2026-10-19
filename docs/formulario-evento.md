# Formulário do evento presencial (site) e Orçamentos

Substitui o "Formulário da Missão" do Google Forms. Página pública `/formulario-evento` (fora do Google: `noindex`), uma seção por tela:
Pacote → Aniversariante (com irmãos: +R$ 10 por certificado individual) → Evento → Responsável (com CPF) → Adicionais (cartões com imagem; Vídeo Convite com pais, horário para os convidados e detalhes) → Termos e uso de imagem → Revisão → **Concluir**.
Tema claro por padrão, com botão para o escuro (lembrado no aparelho, `localStorage`). Imagens em `public/images/formulario/` (as dos adicionais têm o preço desenhado: trocar a imagem se o preço mudar).

## Fluxo

1. **Orçamento** (admin, Calendário → aba **Orçamentos**): clica no dia, informa pacote e endereço, **Calcular** (rota casa → evento no Google Maps + regras). **Salvar e copiar mensagem** guarda o orçamento (`eventQuotes/{id}`, vale 30 dias, uso único) e copia o texto do WhatsApp com o link `…/formulario-evento?orcamento=ID`.
2. **Cliente** abre o link: pacote, data e endereço já vêm preenchidos. Sem link o formulário funciona igual, e o valor fica para conferir.
3. **Concluir** (`POST /api/event-form`, `action: 'submit'`, Turnstile quando ligado): numa transação reserva o número (`siteConfig/eventFormCounter`, primeiro = **A215**; o antigo `counters/eventForm` só vale enquanto o novo não existe). Apagar um pedido **não devolve o número**: depois de apagar testes, corrija o próximo número em Calendário → Formulário → Numeração, cria/acha o cliente pelo WhatsApp e grava o pedido no CRM como **rascunho de evento aguardando sinal** (`eventDraft` + `paymentPending`, `source: 'event-form'`, dados do contrato em `eventFormSite`). Depois cria o evento na agenda: título "(aguardando sinal)", cor Banana. Se o Google falhar, o pedido fica (botão "Enviar para Google Agenda").
4. Tela final: número do formulário, **Avisar no WhatsApp** (mensagem com o número, pedindo os dados do sinal de 50%) e **Baixar formulário e termos (PDF)** (gerado no navegador, jsPDF carregado só nesse clique).

## Valor

- Com orçamento e **mesmo pacote e data**: total = orçamento + adicionais (teia R$ 15 cada, Vídeo de Aniversário R$ 20, Vídeo Convite R$ 45); entrada = 50%.
- Sem orçamento, ou pacote/data diferentes: total 0 e uma observação "conferir o valor". O dono ajusta em "Editar pedido".

## Sinal

- **Salvar no "Editar pedido" não confirma o sinal** enquanto o pedido aguarda: dá para definir valor total e entrada antes de mandar os dados do pagamento. Os vídeos ficam marcados e só viram pedidos na confirmação (`eventFormSite.videosCreated`).
- **Pelo ManyChat** (`presential-event` com o mesmo WhatsApp, via `eventFormPending/{bookingKey}`): o pagamento confirma o **mesmo** pedido (nunca cria outro). Com valor já definido, lança a entrada no Financeiro (`financeEntries/evt-{id}-entry`) e fecha o rascunho; sem valor, só tira o "aguardando" e a entrada é lançada quando o dono salvar os valores. O evento da agenda volta ao título/cor normais.
- **Fora do ManyChat** (PIX direto etc.): "Já recebi o sinal" no Editar pedido confirma a reserva, lança a entrada e cria os pedidos dos vídeos.
- Cron diário das missões (`syncEventFormHolds`): **3 dias** sem sinal → missão "Recontatar cliente: sinal do formulário A###". **3 dias depois de concluir essa missão**, ainda sem sinal → pedido, trava e evento da agenda são excluídos (o cliente precisa preencher de novo). Pagou ou foi excluído antes: a missão pendente some.
- Um WhatsApp só pode ter um formulário aguardando sinal (freia spam; para um segundo evento, falar pelo WhatsApp).
- O ManyChat usa `/api/manychat` da Vercel (a Function `receiveManyChatOrder` do Firebase nunca foi publicada).

## Editar o formulário (Calendário → aba **Formulário**)

Salvo em `siteConfig/eventForm` (`services/eventFormConfig.js`); a página pública recebe junto do `GET /api/event-form` e o servidor usa o que está salvo (nunca o que o navegador manda).

- **Pacotes**: nome, duração e itens (os ids ficam fixos). Valem no formulário, no PDF e na mensagem do orçamento.
- **Adicionais** (preço da teia extra e dos vídeos) e **prazo do sinal** (1 a 30 dias; vale para o aviso, a missão de recontato e a exclusão).
- **Termos**: modelo de texto (`## Título` + uma linha por item) com campos `{contratante}`, `{cpf}`, `{pacote}`, `{data}`, `{prazoSinal}` etc., preenchidos na página e no PDF. Salvar um texto diferente cria a **próxima versão**; todas ficam guardadas em `terms`, e o pedido grava a versão aceita (`eventFormSite.termsVersion`). Se a versão mudar enquanto um cliente preenche, o envio é recusado (`terms_changed`) e a página recarrega o texto novo e pede o aceite de novo.
- As **perguntas** são fixas: estão ligadas aos campos do CRM.

## Regras do orçamento (`siteConfig/eventQuote`, editáveis em "Regras de preço")

`total = cachê da empresa + cachê do agente + km de ida × 4`, sendo `cachê da empresa = pacote (450 Aniversário · 300 Visita · VIP informado) + extra da data + faixa (até 15 km = 0, +R$ 50 a cada 15 km)`.
Arredonda para terminar em 47/97 (`⌈v/50⌉×50 − 3`: 635,78 → 647; 700 → 697; 701 → 747) e respeita o mínimo da cidade (padrão só no Aniversário: BH 847, Contagem 747, Betim 597). O valor a enviar pode ser ajustado à mão antes de salvar.
Regras puras e testes: `services/eventQuote.js` / `.test.js`.

## Configuração (Vercel)

- `GOOGLE_MAPS_API_KEY` (a mesma do Deslocamento). Partida do orçamento: `TRAVEL_STOP_ADDRESS` (decisão do dono; `QUOTE_ORIGIN_ADDRESS`, se criada, tem prioridade). Endereço só no servidor.
- Nada novo no Firestore Rules: `eventFormPending` e `eventQuotes` só são acessados pelo servidor; `siteConfig/eventQuote` já é coberto por `siteConfig/{id}` (admin).
- Termos: versões 2 (primeira publicada, intocável) e 3 (padrão atual: 5.1, 5.2, 6.2 e 7.4 ajustados) em `services/eventTerms.js`; as seguintes são criadas pela aba Formulário. Revisão e justificativas em `docs/termos-evento-presencial.md`.

## Arquivos

| Arquivo | Papel |
|---|---|
| `services/eventSiteForm.js` | Validação do envio (CPF, telefone, datas), adicionais, mensagem do WhatsApp |
| `services/eventTerms.js` | Termos (fonte única da página e do PDF) e prazos |
| `services/eventQuote.js` | Pacotes e regras do orçamento |
| `functions/event-form.js` | Envio, prefill do orçamento, prazos/missão, cálculo e gravação do orçamento |
| `api/event-form.ts` | Endpoint (público: GET prefill e submit; admin: quote, save-quote) |
| `components/EventFormPage.tsx`, `services/eventFormPdf.ts` | Página pública e PDF |
| `components/admin/EventQuotesPanel.tsx` | Aba Orçamentos do Calendário |
