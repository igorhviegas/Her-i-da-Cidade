import React, { useState } from 'react';
import { sendOrderToGoogleCalendar } from '../../../services/googleCalendarService';
import type { OrderView } from './orderView';

export type CalendarState = { orderId: string; kind: 'sending' | 'ok' | 'error'; message: string; link?: string | null } | null;

export const useOrderCalendar = (setSelectedOrder: React.Dispatch<React.SetStateAction<OrderView | null>>) => {
  const [calendarState, setCalendarState] = useState<CalendarState>(null);

  /** Envio manual ao Google Agenda: só mostra sucesso depois da confirmação do servidor/Google. */
  const handleSendToCalendar = async (orderId: string) => {
    if (calendarState?.kind === 'sending') return;
    setCalendarState({ orderId, kind: 'sending', message: '' });
    try {
      const result = await sendOrderToGoogleCalendar(orderId);
      setCalendarState({
        orderId, kind: 'ok', link: result.htmlLink,
        message: `${result.created ? 'Evento criado' : 'Evento atualizado'} no Google Agenda.${result.persisted ? '' : ' O vínculo não pôde ser salvo no pedido; um novo envio atualizará este mesmo evento.'}`,
      });
      if (result.persisted) {
        setSelectedOrder((current) => (current?.order.id === orderId
          ? { ...current, order: { ...current.order, googleCalendar: { eventId: current.order.googleCalendar?.eventId ?? '', calendarId: current.order.googleCalendar?.calendarId ?? '', htmlLink: result.htmlLink ?? undefined, syncedAt: new Date() } } }
          : current));
      }
    } catch (error) {
      setCalendarState({ orderId, kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível enviar ao Google Agenda.' });
    }
  };

  return { calendarState, handleSendToCalendar };
};
