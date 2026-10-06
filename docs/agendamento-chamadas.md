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
3. Pedido: serviço **Vídeo Chamada ao Vivo** (id 2), status inicial configurado no serviço, `paymentPending: true`, sem `paidAt`, `totalPaid: 0`, `servicePrice` = valor configurado no momento da reserva, `source: 'booking'`, `eventDate` (meio-dia de Brasília) e `videoCall { date, time, durationMinutes, slotId, bookedAtMs, whatsapp, childAge, theme, details }`; nome da criança em `childName`; vínculo em `googleCalendar`.
4. **Pagamento (fluxo existente):** o `payment.paid` de `live-call` do ManyChat, se houver pré-agendamento pendente com o mesmo WhatsApp (`videoCallPending/{whatsapp}`), **confirma esse pedido** (`paidAt`, `totalPaid` = valor da reserva, prazos; remove `paymentPending`) e responde `confirmedBooking: true`. Sem pendente, o comportamento antigo é idêntico (cria pedido pago de R$ 75). O contrato do webhook não mudou.
5. **Agenda depois do pagamento:** `/api/manychat` (Vercel) troca o título do evento de "(aguardando pagamento)" para "(paga)" e a cor de **Banana** para **Manjericão** (a API do Google só aceita as 11 cores de evento; "Abacate" é cor de agenda). É melhor esforço: se o Google falhar, o pagamento continua confirmado. A Function do Firebase (`receiveManyChatOrder`) não faz essa troca; e ela só passa a confirmar pré-agendamentos depois de um `firebase deploy --only functions`.
6. **Prazo de pagamento:** o cliente é informado de `paymentDeadlineHours` (padrão 24 h), mas o pré-agendamento sem pagamento só é **excluído** depois de `expireAfterHours` (padrão 72 h, para cobrir o fim de semana sem atendimento). A exclusão apaga pedido + trava + evento da agenda (`expireUnpaidBookings`) e roda antes de toda chamada ao endpoint e uma vez por dia pelo cron da Vercel (`vercel.json`, GET em `/api/video-call`). O pedido é conferido de novo dentro da transação: pagamento que chegue no mesmo instante vence. Se o evento não puder ser apagado, fica na agenda (e o log avisa).

## WhatsApp de contato x número da chamada

- O formulário pede o **WhatsApp de contato** (o que vai falar com o negócio e pagar) e pergunta se a chamada será nesse mesmo número. Se não, pede o **número da chamada**, gravado em `videoCall.callWhatsapp`, mostrado como observação no pedido e no evento.
- A baixa do pagamento usa só o número de contato: o ManyChat informa o WhatsApp que conversou, e o pedido é achado por `videoCallPending/{bookingKey}` (DDI + DDD + 8 últimos dígitos, então o nono dígito não atrapalha). Se quem paga escreve de **outro** WhatsApp, não há como casar: o ManyChat cria um pedido novo e a baixa é manual (informar a data de pagamento em "Editar pedido").
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
