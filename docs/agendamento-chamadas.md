# Agendamento de Vídeo Chamadas (substitui o Calendly)

Página pública `/agendar-chamada` (e a seção "Vídeo chamada" da home) → escolher dia → horário → dados → **reservar**.
Módulo admin **Agendamento de chamadas** (menu lateral, logo abaixo de Calendário): `/admin/agendamento-chamadas`.

## Fluxo

1. `GET /api/video-call` devolve os horários livres: regra fixa ∩ janela (≥ 24 h, até 30 dias) − eventos com hora marcada do Google Agenda − reservas do próprio sistema.
2. `POST /api/video-call` **revalida tudo** (regra, Google, trava), grava numa transação do Firestore a trava do horário + pedido + cliente, e só então cria o evento (15 min) no Google Agenda. Se o Google falhar, a reserva é desfeita e o cliente vê o erro (nunca "reservado" sem evento).
3. Pedido: serviço **Vídeo Chamada ao Vivo** (id 2), status inicial configurado no serviço, `paymentPending: true`, sem `paidAt`, `totalPaid: 0`, `source: 'booking'`, `eventDate` (meio-dia de Brasília) e `videoCall { date, time, durationMinutes, childAge, theme, details }`; nome da criança em `childName`; vínculo em `googleCalendar` (`eventId`, `calendarId`, `htmlLink`).
4. A página leva o cliente ao `whatsappUrl` do serviço (o mesmo link/mensagem de hoje; nada novo é enviado ao ManyChat).
5. **Pagamento (fluxo existente):** o `payment.paid` de `live-call` do ManyChat, se houver pré-agendamento pendente com o mesmo WhatsApp (`videoCallPending/{whatsapp}`), **confirma esse pedido** (`paidAt`, `totalPaid` = 75, prazos; remove `paymentPending`) e responde `confirmedBooking: true`. Sem pendente, o comportamento antigo é idêntico (cria pedido pago). O contrato do webhook não mudou.

## Regras (centralizadas em `VIDEO_CALL_CONFIG`, `functions/video-call.js`)

Duração 15 min · mínimo 24 h · máximo 30 dias (por data) · Seg e Qua 19:30/20:00/20:30 · Sáb 09:30/10:00/10:30. Horário local `America/Sao_Paulo` (deslocamento fixo −03:00; o Brasil não tem horário de verão desde 2019).

## Concorrência

`videoCallSlots/{AAAA-MM-DD_HHmm}` é lido e gravado na mesma transação do pedido: duas reservas simultâneas do mesmo horário conflitam e só uma vence. A trava só vale **enquanto o pedido existe**: excluir o pedido no CRM libera o horário sozinho. Um WhatsApp só pode ter **um** pré-agendamento aguardando pagamento (freia spam no endpoint público).

## CRM

- Kanban: selo "⏳ Aguardando pagamento · Chamada dd/mm às HH:mm"; o valor só aparece depois de pago.
- Pedido pendente **não pode ser concluído**; informar a data de pagamento em "Editar pedido" também o confirma (manual, caso o ManyChat não case).
- Financeiro, missões e "total gasto" do cliente dependem de conclusão/`paidAt`, então o pendente não conta.

## Cancelar por falta de pagamento (manual por enquanto)

Excluir o pedido (Pedidos) e o evento (Calendário). O horário volta a ficar livre. O que um futuro job precisa: pedidos com `paymentPending === true`, `createdAt` antigo, `googleCalendar.eventId` (para `deleteCalendarEvent`) e a trava `videoCall.slotId` já estão gravados.

## Pré-requisitos / observações

- Mesmas variáveis da agenda de eventos (`GOOGLE_CALENDAR_ID`, conta de serviço) e Firebase Admin. Nada novo no Firestore Rules: as coleções `videoCallSlots` e `videoCallPending` só são acessadas pelo servidor (Admin SDK), e as regras atuais as negam ao cliente.
- O serviço `2` precisa estar ativo, gerar pedido, ter tipo de produção e status inicial (≠ Concluído) e `whatsappUrl`.
- Eventos de dia inteiro na agenda **não** bloqueiam horários (só eventos com hora marcada).
- O título do evento marca "(aguardando pagamento)"; não é atualizado quando o pagamento chega.
- Cliente legado duplicado por WhatsApp: usa o primeiro cadastro (o ManyChat, nesse caso, responde 409).
