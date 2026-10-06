# Agendamento de Vídeo Chamadas (substitui o Calendly)

Página pública `/agendar-chamada` (e a seção "Vídeo chamada" da home). A página própria (`components/VideoCallPage.tsx`) traz a marca no topo, o aviso de segurança e os canais oficiais (Instagram e WhatsApp) no rodapé.
Módulo admin **Agendamento de chamadas**: `/admin/agendamento-chamadas`, filho de **Calendário** no menu (aparece com o Calendário aberto), com as abas **Agendamentos** e **Configurações**.

## Fluxo do cliente

1. Escolhe o dia e o horário.
2. Lê as **informações** (texto configurável) e clica em **Continuar**.
3. Preenche os dados, lê o **aviso final** (valor e prazo) e clica em **Prosseguir para pagamento no WhatsApp**.
4. A reserva é criada e o cliente vai para o WhatsApp do serviço com a **mensagem do agendamento** (data e horário). Essa mensagem é só dos agendamentos; os links dos serviços não mudam.

## Servidor

1. `GET /api/video-call` devolve os horários livres (regra ∩ janela de antecedência − eventos com hora marcada das agendas − reservas do sistema) e os textos/valor para a página.
2. `POST /api/video-call` **revalida tudo** (regra, Google, trava), grava numa transação do Firestore a trava do horário + pedido + cliente, e só então cria o evento no Google Agenda. Se o Google falhar, a reserva é desfeita e o cliente vê o erro (nunca "reservado" sem evento).
3. Pedido: serviço **Vídeo Chamada ao Vivo** (id 2), status inicial configurado no serviço, `paymentPending: true`, sem `paidAt`, `totalPaid: 0`, `servicePrice` = valor configurado no momento da reserva, `source: 'booking'`, `eventDate` (meio-dia de Brasília) e `videoCall { date, time, durationMinutes, slotId, bookedAtMs, whatsapp, ddi, phone, callWhatsapp?, email, timezone?, childAge, theme, details }`; nome da criança em `childName`; vínculo em `googleCalendar`.
4. **Pagamento (fluxo existente):** o `payment.paid` de `live-call` do ManyChat, se houver pré-agendamento pendente com o mesmo WhatsApp (`videoCallPending/{whatsapp}`), **confirma esse pedido** (`paidAt`, `totalPaid` = valor da reserva, prazos; remove `paymentPending`) e responde `confirmedBooking: true`. Sem pendente, o comportamento antigo é idêntico (cria pedido pago de R$ 75). O contrato do webhook não mudou.
5. **Agenda depois do pagamento:** `/api/manychat` (Vercel) troca o título do evento de "(aguardando pagamento)" para "(paga)" e a cor de **Banana** para **Manjericão** (a API do Google só aceita as 11 cores de evento; "Abacate" é cor de agenda). É melhor esforço: se o Google falhar, o pagamento continua confirmado. A Function do Firebase (`receiveManyChatOrder`) não faz essa troca; e ela só passa a confirmar pré-agendamentos depois de um `firebase deploy --only functions`.
6. **Prazo de pagamento:** o cliente é informado de `paymentDeadlineHours` (padrão 24 h), mas o pré-agendamento sem pagamento só é **excluído** depois de `expireAfterHours` (padrão 72 h, para cobrir o fim de semana sem atendimento). A exclusão apaga pedido + trava + evento da agenda (`expireUnpaidBookings`) e roda antes de toda chamada ao endpoint e uma vez por dia pelo cron da Vercel (`vercel.json`, GET em `/api/video-call`). O pedido é conferido de novo dentro da transação: pagamento que chegue no mesmo instante vence. Se o evento não puder ser apagado, fica na agenda (e o log avisa).

## E-mail e convite do Google Agenda

- O formulário pede **e-mail** (obrigatório, validação básica). Fica em `videoCall.email`, no resumo do pedido e na descrição do evento.
- **Na reserva ninguém é convidado.** Quando o pagamento é confirmado pelo ManyChat (`/api/manychat` → `markVideoCallEventPaid`), o **mesmo** evento da reserva (`googleCalendar.eventId`) recebe o e-mail como convidado (`addCalendarEventGuest`: lê os convidados atuais e regrava com o novo, `sendUpdates=all`), e o Google envia o convite. Nenhum evento novo é criado.
- O resultado fica em `orders/{id}.calendarInvite` (`sent` ou `failed`, com código e mensagem) e aparece na lista de Agendamentos ("Convite enviado" / "Convite não enviado"). Falha no convite não desfaz o pagamento nem a troca de título/cor.
- **Risco conhecido:** o Google costuma recusar convites feitos por **conta de serviço** sem delegação em todo o domínio (recurso do Google Workspace; erro `forbiddenForServiceAccounts`, aqui `guests_not_allowed`). Isso só se confirma com um pagamento real. Se acontecer, o convite fica como "não enviado" e é preciso outro caminho (ex.: convidar manualmente pela agenda, ou autenticar com a conta dona da agenda).
- A baixa manual no CRM (data de pagamento em "Editar pedido") não passa por esse fluxo: não muda o evento nem convida.

## Telefone com DDI

- O WhatsApp é informado em duas partes: país/DDI (lista em `services/phoneCountries.js`, **Brasil +55 por padrão**) e número. O número da chamada, quando é outro, tem o seu próprio DDI.
- O servidor junta os dois em formato internacional só com dígitos (`videoCall.whatsapp`, ex.: `5531999990001`, `351912345678`), o mesmo padrão de `whatsappNormalized`; guarda também `videoCall.ddi` e `videoCall.phone`. Sem DDI na requisição vale o Brasil, com a regra de sempre (DDD + número).
- Cliente novo criado pelo agendamento ganha `whatsapp: "+<DDI><número>"`. O `+` é o que faz os links `wa.me` do CRM e a busca de cliente tratarem o número como completo; cadastros antigos não são alterados e continuam valendo.
- ManyChat: `customer.whatsapp` continua aceitando número brasileiro com DDD; passa a aceitar também internacional **com `+` e o código do país**. Sem `+`, um número de outro país continua recusado (não dá para distinguir de um número brasileiro).

## Fuso horário do cliente

- A agenda é sempre a de **Brasília**: disponibilidade, trava do horário e evento do Google não mudam com o fuso de quem agenda.
- O navegador informa o fuso (identificador IANA, ex.: `Europe/Lisbon`). Se o horário local do cliente for igual ao de Brasília, nada extra aparece. Se for diferente, a página mostra os dois, com rótulo ("Brasília" e "seu horário", com o dia quando a data muda), na escolha do horário, no resumo e na confirmação.
- A conversão usa o banco de fusos do `Intl` (`functions/video-call-time.js`), sem somar horas fixas: horário de verão e troca de data saem certos. O servidor também deixou de usar `-03:00` fixo para Brasília.
- O pedido guarda `videoCall.timezone`; quando difere de Brasília, o resumo do pedido e o evento trazem o horário do cliente.
- Para conferir o que um cliente de fora vê: `/agendar-chamada?fuso=Europe/Lisbon` (simula o fuso; não altera a reserva).

## WhatsApp de contato x número da chamada

- O formulário pede o **WhatsApp de contato** (o que vai falar com o negócio e pagar) e pergunta se a chamada será nesse mesmo número. Se não, pede o **número da chamada**, gravado em `videoCall.callWhatsapp`, mostrado como observação no pedido e no evento.
- A baixa do pagamento usa só o número de contato: o ManyChat informa o WhatsApp que conversou, e o pedido é achado por `videoCallPending/{bookingKey}` (número brasileiro: DDI + DDD + 8 últimos dígitos, então o nono dígito não atrapalha; internacional: o número inteiro). Se quem paga escreve de **outro** WhatsApp, não há como casar: o ManyChat cria um pedido novo e a baixa é manual (informar a data de pagamento em "Editar pedido").
- No Kanban, o botão "Enviar pelo WhatsApp" do card (mensagem do dia da chamada) vai para o número da chamada quando ele existe; o contato do pedido continua sendo o cliente.

## Configurações (`siteConfig/videoCall`)

Editáveis na aba **Configurações**; padrão e validação em `functions/video-call-config.js` (o que faltar ou vier inválido cai no padrão):

- Valor, duração, prazo informado ao cliente, exclusão automática, antecedência mínima e máxima.
- Dias e horários (por dia da semana).
- Textos: informações, aviso final, mensagem do WhatsApp e aviso de segurança (linha com cadeado na página `/agendar-chamada`). Aceitam `**negrito**` e `{valor}`, `{duracao}`, `{prazo}`; a mensagem do WhatsApp aceita também `{data}` e `{horario}`.
- Agendas extras para checar conflitos (`busyCalendarIds`).

Padrão: R$ 75 · 15 min · 24 h informadas ao cliente / exclusão em 72 h · mínimo 24 h · máximo 30 dias · Seg e Qua 19:30/20:00/20:30 · Sáb 09:30/10:00/10:30. Horário local `America/Sao_Paulo` (deslocamento fixo −03:00; o Brasil não tem horário de verão desde 2019).

O valor configurado vale para os agendamentos do site. O ManyChat continua com o seu próprio valor fixo para pedidos sem pré-agendamento.

## Agendas consultadas

- A agenda do sistema (`GOOGLE_CALENDAR_ID`, "Eventos Heroi da Cidade"): é onde os eventos das chamadas são criados.
- As **agendas extras** configuradas: só leitura, só para conflito. O Calendly gravava na agenda pessoal, então ela precisa estar aqui enquanto houver reservas antigas. Cada agenda extra precisa ser **compartilhada com a conta de serviço** (Configurações da agenda no Google → Compartilhar com pessoas específicas → e-mail da conta de serviço → "Ver todos os detalhes dos eventos").
- Se uma agenda extra não estiver acessível, a consulta falha e a página pública não mostra horários (de propósito: não oferece horário sem conferir). A aba Configurações mostra o resultado de uma consulta real.
- Não bloqueiam: eventos de dia inteiro e eventos marcados como "Livre".

## Concorrência

`videoCallSlots/{AAAA-MM-DD_HHmm}` é lido e gravado na mesma transação do pedido: duas reservas simultâneas do mesmo horário conflitam e só uma vence. A trava só vale **enquanto o pedido existe**: excluir o pedido no CRM libera o horário sozinho. Um WhatsApp só pode ter **um** pré-agendamento aguardando pagamento (freia spam no endpoint público).

## CRM

- Kanban: selo "⏳ Aguardando pagamento · Chamada dd/mm às HH:mm"; o valor só aparece depois de pago.
- Pedido pendente **não pode ser concluído**; informar a data de pagamento em "Editar pedido" também o confirma (manual, caso o ManyChat não case). Nesse caso o título do evento na agenda não muda.
- Financeiro, missões e "total gasto" do cliente dependem de conclusão/`paidAt`, então o pendente não conta.

## Pré-requisitos / observações

- Mesmas variáveis da agenda de eventos (`GOOGLE_CALENDAR_ID`, conta de serviço) e Firebase Admin, em Production e Preview. Nada novo no Firestore Rules: `siteConfig/videoCall` já é coberto por `siteConfig/{configId}` (só admin), e `videoCallSlots`/`videoCallPending` só são acessadas pelo servidor.
- O serviço `2` precisa estar ativo, gerar pedido, ter tipo de produção e status inicial (≠ Concluído) e `whatsappUrl` (de onde sai o número do WhatsApp).
- Pagamento que chegue **depois** de a reserva expirar não tem mais pré-agendamento para confirmar: o ManyChat cria um pedido pago comum, sem horário reservado.
- Cliente legado duplicado por WhatsApp: usa o primeiro cadastro (o ManyChat, nesse caso, responde 409).
