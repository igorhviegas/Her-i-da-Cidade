# Formulário do evento presencial (site) e Orçamentos

Substitui o "Formulário da Missão" do Google Forms. Página pública `/formulario-evento` (fora do Google: `noindex`), uma seção por tela:
Pacote → Aniversariante → Evento → Responsável (com CPF) → Adicionais → Termos e uso de imagem → Revisão → **Concluir**.

## Fluxo

1. **Orçamento** (admin, Calendário → aba **Orçamentos**): clica no dia, informa pacote e endereço, **Calcular** (rota casa → evento no Google Maps + regras). **Salvar e copiar mensagem** guarda o orçamento (`eventQuotes/{id}`, vale 30 dias, uso único) e copia o texto do WhatsApp com o link `…/formulario-evento?orcamento=ID`.
2. **Cliente** abre o link: pacote, data e endereço já vêm preenchidos. Sem link o formulário funciona igual, e o valor fica para conferir.
3. **Concluir** (`POST /api/event-form`, `action: 'submit'`, Turnstile quando ligado): numa transação reserva o número (`counters/eventForm`, primeiro = **A214**), cria/acha o cliente pelo WhatsApp e grava o pedido no CRM como **rascunho de evento aguardando sinal** (`eventDraft` + `paymentPending`, `source: 'event-form'`, dados do contrato em `eventFormSite`). Depois cria o evento na agenda: título "(aguardando sinal)", cor Banana. Se o Google falhar, o pedido fica (botão "Enviar para Google Agenda").
4. Tela final: número do formulário, **Avisar no WhatsApp** (mensagem com o número, pedindo os dados do sinal de 50%) e **Baixar formulário e termos (PDF)** (gerado no navegador, jsPDF carregado só nesse clique).

## Valor

- Com orçamento e **mesmo pacote e data**: total = orçamento + adicionais (teia R$ 15 cada, Vídeo de Aniversário R$ 20, Vídeo Convite R$ 45); entrada = 50%.
- Sem orçamento, ou pacote/data diferentes: total 0 e uma observação "conferir o valor". O dono ajusta em "Editar pedido".

## Sinal

- **Pelo ManyChat** (`presential-event` com o mesmo WhatsApp, via `eventFormPending/{bookingKey}`): o pagamento só tira o "aguardando" (`depositPaidAt`), sem criar outro rascunho, e o evento da agenda volta ao título/cor normais. O pedido continua rascunho até o dono conferir.
- **Em "Editar pedido"**: salvar o rascunho confirma a reserva: lança a entrada no Financeiro (como nos rascunhos do ManyChat), tira o `paymentPending` e reenvia o evento à agenda. Os vídeos pedidos já vêm marcados em "Vídeos com desconto". **Salve só depois de receber o sinal.**
- Cron diário das missões (`syncEventFormHolds`): **3 dias** sem sinal → missão "Recontatar cliente: sinal do formulário A###". **3 dias depois de concluir essa missão**, ainda sem sinal → pedido, trava e evento da agenda são excluídos (o cliente precisa preencher de novo). Pagou ou foi excluído antes: a missão pendente some.
- Um WhatsApp só pode ter um formulário aguardando sinal (freia spam; para um segundo evento, falar pelo WhatsApp).
- A Function do Firebase (`receiveManyChatOrder`) só passa a confirmar formulários depois de `firebase deploy --only functions`.

## Regras do orçamento (`siteConfig/eventQuote`, editáveis em "Regras de preço")

`total = cachê da empresa + cachê do agente + km de ida × 4`, sendo `cachê da empresa = pacote (450 Aniversário · 300 Visita · VIP informado) + extra da data + faixa (até 15 km = 0, +R$ 50 a cada 15 km)`.
Arredonda para terminar em 47/97 (`⌈v/50⌉×50 − 3`: 635,78 → 647; 700 → 697; 701 → 747) e respeita o mínimo da cidade (padrão só no Aniversário: BH 847, Contagem 747, Betim 597). O valor a enviar pode ser ajustado à mão antes de salvar.
Regras puras e testes: `services/eventQuote.js` / `.test.js`.

## Configuração (Vercel)

- `GOOGLE_MAPS_API_KEY` (a mesma do Deslocamento) e **`QUOTE_ORIGIN_ADDRESS`** = endereço de partida do orçamento (casa do dono, completo). Sem ela vale `TRAVEL_STOP_ADDRESS`. Endereço só no servidor; não escrever em código/docs.
- Nada novo no Firestore Rules: `counters`, `eventFormPending` e `eventQuotes` só são acessados pelo servidor; `siteConfig/eventQuote` já é coberto por `siteConfig/{id}` (admin).
- Termos: texto em `services/eventTerms.js` (mudou o texto → subir `TERMS_VERSION`); revisão e justificativas em `docs/termos-evento-presencial.md`.

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
