import { logger } from '../lib/logger.js';
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../functions/firebase-admin.js';
import { clientIp, verifyTurnstile } from '../functions/turnstile.js';
import { GoogleCalendarError } from '../functions/google-calendar.js';
import { VideoCallError, createVideoCallBooking, expireUnpaidBookings, getAvailability, publicConfig } from '../functions/video-call.js';

const STATUS_BY_CODE: Record<string, number> = {
  validation_error: 400, slot_unavailable: 409, already_pending: 409, service_unavailable: 503,
};

/** Captcha (Cloudflare Turnstile) do POST: true = pode seguir. Ligado só com TURNSTILE_SECRET_KEY; sem ela, sempre passa. */
async function passesCaptcha(req: { body?: any; headers?: any }, verify: typeof verifyTurnstile): Promise<boolean> {
  const result = await verify({ token: req.body?.turnstileToken, secret: process.env.TURNSTILE_SECRET_KEY, ip: clientIp(req.headers) });
  if (result.ok && result.unavailable) logger.warn('[VideoCall] Turnstile indisponível: reserva liberada sem verificação.');
  return result.ok;
}

/** O token do captcha nunca entra na reserva. */
const withoutCaptchaToken = (body: unknown) => Object.fromEntries(Object.entries((body ?? {}) as Record<string, unknown>).filter(([key]) => key !== 'turnstileToken'));

/**
 * Público (sem login), pré-agendamento de Vídeo Chamada.
 * GET  -> { days: [{ date, times }], config } com os horários livres agora (regra + Google Agenda + reservas do sistema) e os textos/valor.
 * POST { slot: { date, time }, name, whatsapp, childName, childAge, theme, details? } -> cria trava + pedido (aguardando pagamento) + evento.
 * Só responde ok depois de o pedido e o evento existirem; a disponibilidade é revalidada no POST.
 * Toda chamada antes exclui os pré-agendamentos vencidos (sem pagamento no prazo); o cron diário da Vercel chama o GET para isso.
 */
export async function handleVideoCall(
  req: Request | any,
  res: Response | any,
  deps: { database?: unknown; availability?: typeof getAvailability; book?: typeof createVideoCallBooking; expire?: typeof expireUnpaidBookings; captcha?: typeof verifyTurnstile } = {},
) {
  const send = (status: number, body: unknown) => {
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(status).json(body);
  };
  const fail = (status: number, code: string, message: string) => send(status, { ok: false, error: { code, message } });

  if (req.method !== 'GET' && req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use GET ou POST.');
  try {
    const database = deps.database ?? getAdminFirestore();
    // A limpeza nunca impede o cliente de agendar: se falhar, fica para a próxima chamada.
    try { await (deps.expire ?? expireUnpaidBookings)({ database }); }
    catch (error) { logger.error('[VideoCall] limpeza de reservas vencidas falhou:', error instanceof Error ? error.message : 'erro'); }

    if (req.method === 'GET') {
      const { days, config } = await (deps.availability ?? getAvailability)({ database });
      return send(200, { ok: true, days, config: publicConfig(config) });
    }
    if (!(await passesCaptcha(req, deps.captcha ?? verifyTurnstile))) return fail(403, 'captcha_failed', 'Não foi possível confirmar a verificação de segurança. Atualize a página e tente de novo.');
    const booking = await (deps.book ?? createVideoCallBooking)({ database, input: withoutCaptchaToken(req.body) });
    return send(200, { ok: true, booking });
  } catch (error) {
    if (error instanceof VideoCallError || error instanceof GoogleCalendarError) {
      // Falhas do Google/credenciais não vazam detalhes ao público: mensagem genérica, o log do servidor tem o código.
      const publicError = error instanceof VideoCallError;
      if (!publicError) logger.error('[VideoCall] Google Agenda:', error.code);
      if (!publicError) return fail(error.code === 'rate_limited' ? 429 : 503, 'calendar_unavailable', 'Não foi possível consultar a agenda agora. Tente novamente em instantes.');
      return fail(STATUS_BY_CODE[error.code] ?? 400, error.code, error.message);
    }
    logger.error('[VideoCall] falha inesperada:', error instanceof Error ? error.message : 'erro');
    return fail(500, 'internal_error', 'Não foi possível concluir agora. Tente novamente.');
  }
}

export default handleVideoCall;
