import { auth } from '../lib/firebase';
import { invalidateCalendarCache } from './calendarService';

export interface CalendarSendResult { created: boolean; htmlLink: string | null; persisted: boolean }

/**
 * Envia (ou atualiza) o evento do pedido no Google Agenda. O servidor valida o administrador, lê o pedido salvo e usa as
 * credenciais do Google guardadas no backend. Só resolve quando o Google confirmou; qualquer falha vira Error com mensagem clara.
 */
export async function sendOrderToGoogleCalendar(orderId: string): Promise<CalendarSendResult> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Faça login como administrador.');
  let response: Response;
  try {
    response = await fetch('/api/google-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    throw new Error('Sem conexão com o servidor. O evento NÃO foi enviado ao Google Agenda.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message ?? 'Não foi possível enviar ao Google Agenda. O evento NÃO foi enviado.');
  invalidateCalendarCache(); // o widget da Principal e o Calendário recarregam a agenda
  return { created: Boolean(body.created), htmlLink: body.htmlLink ?? null, persisted: body.persisted !== false };
}
