import { logger } from '../lib/logger.js';
import type { Request, Response } from 'express';
import { ReviewsError, fetchGoogleReviews, readReviewsConfig } from '../functions/google-reviews.js';

/**
 * GET público: avaliações reais do Google. A resposta fica 24 h no cache da Vercel (e serve a antiga por até 7 dias
 * enquanto renova), então a Places API é chamada ~1x/dia, longe do limite gratuito. Erros nunca vão para o cache.
 */
export async function handleReviews(
  req: Pick<Request, 'method'>,
  res: Response,
  deps: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {},
) {
  const fail = (status: number, code: string) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(status).json({ ok: false, error: { code } });
  };
  if (req.method !== 'GET') return fail(405, 'method_not_allowed');
  const config = readReviewsConfig(deps.env ?? process.env);
  if (!config) return fail(503, 'not_configured');
  try {
    const data = await fetchGoogleReviews({ ...config, fetchImpl: deps.fetchImpl });
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof ReviewsError) logger.error('[Reviews] Google:', error.code, error.detail);
    else logger.error('[Reviews] falha inesperada:', error instanceof Error ? error.name : 'erro');
    return fail(502, 'unavailable');
  }
}

export default handleReviews;
