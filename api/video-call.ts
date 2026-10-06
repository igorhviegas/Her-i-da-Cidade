import type { Request, Response } from 'express';
import { getAdminFirestore } from '../functions/firebase-admin.js';
import { GoogleCalendarError } from '../functions/google-calendar.js';
import { VIDEO_CALL_CONFIG, VideoCallError, createVideoCallBooking, getAvailability } from '../functions/video-call.js';

const STATUS_BY_CODE: Record<string, number> = {
  validation_error: 400, slot_unavailable: 409, already_pending: 409, service_unavailable: 503,
};

/**
 * Público (sem login), pré-agendamento de Vídeo Chamada.
 * GET  -> { days: [{ date, times }] } com os horários livres agora (regra + Google Agenda + reservas do sistema).
 * POST { slot: { date, time }, name, whatsapp, childName, childAge, theme, details? } -> cria trava + pedido (aguardando pagamento) + evento.
 * Só responde ok depois de o pedido e o evento existirem; a disponibilidade é revalidada no POST.
 */
export async function handleVideoCall(
  req: Request | any,
  res: Response | any,
  deps: { database?: any; availability?: typeof getAvailability; book?: typeof createVideoCallBooking } = {},
) {
  const send = (status: number, body: unknown) => {
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(status).json(body);
  };
  const fail = (status: number, code: string, message: string) => send(status, { ok: false, error: { code, message } });

  if (req.method !== 'GET' && req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use GET ou POST.');
  try {
    const database = deps.database ?? getAdminFirestore();
    if (req.method === 'GET') {
      const { days } = await (deps.availability ?? getAvailability)({ database });
      return send(200, { ok: true, durationMinutes: VIDEO_CALL_CONFIG.durationMinutes, days });
    }
    const booking = await (deps.book ?? createVideoCallBooking)({ database, input: req.body ?? {} });
    return send(200, { ok: true, booking });
  } catch (error) {
    if (error instanceof VideoCallError || error instanceof GoogleCalendarError) {
      // Falhas do Google/credenciais não vazam detalhes ao público: mensagem genérica, o log do servidor tem o código.
      const publicError = error instanceof VideoCallError;
      if (!publicError) console.error('[VideoCall] Google Agenda:', error.code);
      if (!publicError) return fail(error.code === 'rate_limited' ? 429 : 503, 'calendar_unavailable', 'Não foi possível consultar a agenda agora. Tente novamente em instantes.');
      return fail(STATUS_BY_CODE[error.code] ?? 400, error.code, error.message);
    }
    console.error('[VideoCall] falha inesperada:', error instanceof Error ? error.message : 'erro');
    return fail(500, 'internal_error', 'Não foi possível concluir agora. Tente novamente.');
  }
}

export default handleVideoCall;
