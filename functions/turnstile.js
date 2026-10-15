// Cloudflare Turnstile (captcha gratuito e discreto) no agendamento público de vídeo chamada. Só servidor; o segredo nunca vai ao navegador.
// Desligado por padrão: sem TURNSTILE_SECRET_KEY nada é verificado (o site continua como era).

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;

/** Primeiro IP de x-forwarded-for (a Vercel o preenche); vazio se não houver. Só é enviado ao Cloudflare como dica extra. */
export function clientIp(headers = {}) {
  const forwarded = headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(value ?? headers['x-real-ip'] ?? '').split(',')[0].trim();
}

/**
 * Resultado: { ok: true, skipped?: true } passa; { ok: false, reason: 'missing_token' | 'invalid' } bloqueia.
 * - Sem segredo configurado: passa (skipped), pois o recurso está desligado.
 * - Falha de rede/Cloudflare fora do ar: passa (skipped, `unavailable: true`): disponibilidade vale mais que a trava num negócio pequeno;
 *   o log registra. Token ausente ou recusado pelo Cloudflare sempre bloqueia.
 */
export async function verifyTurnstile({ token, secret, ip = '', fetchImpl = fetch }) {
  if (!secret) return { ok: true, skipped: true };
  if (typeof token !== 'string' || token.trim() === '' || token.length > 2048) return { ok: false, reason: 'missing_token' };
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  const result = await post(fetchImpl, body);
  if (result === null) return { ok: true, skipped: true, unavailable: true };
  if (result.success === true) return { ok: true };
  return { ok: false, reason: 'invalid', codes: Array.isArray(result['error-codes']) ? result['error-codes'] : [] };
}

/** Resposta do Cloudflare como objeto; null se a rede falhar, o serviço responder erro ou o corpo não for JSON. */
async function post(fetchImpl, body) {
  try {
    const response = await fetchImpl(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;
    return (await response.json().catch(() => ({}))) ?? {};
  } catch {
    return null;
  }
}
