import { logger } from '../lib/logger.js';
import { X509Certificate, createVerify } from 'node:crypto';
import type { Request, Response } from 'express';
import { handleAlexaEnvelope, parseAllowedUsers } from '../functions/missions-alexa.js';

const MAX_SKEW_MS = 150_000; // limite da Amazon para o timestamp da requisição
const MAX_BODY = 200_000;
const certCache = new Map<string, X509Certificate[]>();

/** https://s3.amazonaws.com[:443]/echo.api/... — qualquer outra origem é rejeitada. */
export function isValidCertUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 's3.amazonaws.com' && (url.port === '' || url.port === '443')
      && url.pathname.startsWith('/echo.api/') && !url.username && !url.password;
  } catch {
    return false;
  }
}

async function fetchChain(url: string): Promise<X509Certificate[]> {
  const cached = certCache.get(url);
  if (cached) return cached;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('cert fetch failed');
  const pems = (await res.text()).match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  const chain = pems.map((pem) => new X509Certificate(pem));
  if (!chain.length) throw new Error('empty chain');
  certCache.set(url, chain);
  return chain;
}

/**
 * Valida assinatura (cabeçalho Signature-256) e timestamp conforme a Amazon exige de endpoints de skill.
 * ponytail: confere URL, validade, SAN echo-api.amazon.com, encadeamento das assinaturas e a assinatura do corpo,
 * mas não ancora a cadeia na lista de CAs raiz. Os demais controles (applicationId e userId) continuam valendo.
 */
export async function verifyAlexaRequest(
  headers: { signature?: string; certUrl?: string },
  rawBody: Buffer,
  now = new Date(),
  getChain: (url: string) => Promise<X509Certificate[]> = fetchChain,
): Promise<boolean> {
  try {
    if (!headers.signature || !headers.certUrl || !isValidCertUrl(headers.certUrl)) return false;
    const timestamp = new Date(JSON.parse(rawBody.toString('utf8'))?.request?.timestamp).getTime();
    if (!Number.isFinite(timestamp) || Math.abs(now.getTime() - timestamp) > MAX_SKEW_MS) return false;

    const chain = await getChain(headers.certUrl);
    const [leaf] = chain;
    if (now < new Date(leaf.validFrom) || now > new Date(leaf.validTo)) return false;
    if (!/DNS:echo-api\.amazon\.com(?:,|$)/.test(leaf.subjectAltName ?? '')) return false;
    for (let i = 0; i < chain.length - 1; i += 1) if (!chain[i].verify(chain[i + 1].publicKey)) return false;

    return createVerify('RSA-SHA256').update(rawBody).verify(leaf.publicKey, headers.signature, 'base64');
  } catch {
    return false;
  }
}

async function readRawBody(req: any): Promise<Buffer | null> {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody; // Express (server.ts) guarda o corpo bruto
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody);
  if (!req.readable) return null; // corpo já consumido e sem cópia bruta: não dá para verificar a assinatura
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) return null;
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

interface Deps {
  config?: { skillId?: string; allowedUserIds: string[] };
  database?: unknown;
  verify?: typeof verifyAlexaRequest;
  now?: Date;
}

/** Endpoint da skill Alexa: POST com o envelope JSON. Rejeita sem assinatura válida da Amazon. */
export async function handleAlexa(req: Request | any, res: Response | any, deps: Deps = {}) {
  const send = (status: number, body: unknown) => {
    res.setHeader?.('Cache-Control', 'no-store');
    if (typeof res.status === 'function') return res.status(status).json(body);
    res.statusCode = status;
    res.setHeader?.('Content-Type', 'application/json');
    return res.end?.(JSON.stringify(body));
  };

  if (req.method !== 'POST') return send(405, { ok: false, error: { code: 'method_not_allowed', message: 'Use POST.' } });

  const config = deps.config ?? { skillId: process.env.ALEXA_SKILL_ID, allowedUserIds: parseAllowedUsers(process.env.ALEXA_ALLOWED_USER_IDS) };
  if (!config.skillId) {
    logger.error('[Alexa] ALEXA_SKILL_ID não configurado nas variáveis de ambiente.');
    return send(500, { ok: false, error: { code: 'server_misconfigured', message: 'Serviço indisponível: configuração pendente.' } });
  }

  const header = (name: string) => {
    const value = req.headers?.[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const raw = await readRawBody(req);
  const verified = raw && await (deps.verify ?? verifyAlexaRequest)(
    { signature: header('signature-256'), certUrl: header('signaturecertchainurl') }, raw, deps.now,
  );
  if (!raw || !verified) return send(401, { ok: false, error: { code: 'unauthorized', message: 'Assinatura ausente ou inválida.' } });

  let envelope: unknown;
  try {
    envelope = JSON.parse(raw.toString('utf8'));
  } catch {
    return send(400, { ok: false, error: { code: 'invalid_json', message: 'Corpo inválido.' } });
  }

  try {
    // import tardio: importar './manychat.ts' no topo derruba a função na Vercel (FUNCTION_INVOCATION_FAILED).
    const database = deps.database ?? (await import('./manychat.js')).getAdminFirestore();
    return send(200, await handleAlexaEnvelope(envelope, { database, config, now: deps.now, logger: console }));
  } catch (error) {
    logger.error('[Alexa] Falha ao processar requisição:', error instanceof Error ? error.message : String(error));
    return send(200, { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: 'Não consegui criar a missão agora. Tente novamente em instantes.' }, shouldEndSession: true } });
  }
}

export default handleAlexa;
