// Avaliações reais do Google (Places API New). Só servidor; sem dependências novas (fetch).
// Fica fora de api/ pelo mesmo motivo de firebase-admin.js. Reaproveita GOOGLE_MAPS_API_KEY (docs/avaliacoes.md).

const PLACES_URL = 'https://places.googleapis.com/v1/places/';
const FIELD_MASK = 'rating,userRatingCount,googleMapsUri,reviews';
const TIMEOUT_MS = 8000;

export class ReviewsError extends Error {
  constructor(code, detail) { super(code); this.name = 'ReviewsError'; this.code = code; this.detail = detail; }
}

/** Chave e Place ID do servidor, ou null se faltar algum. */
export function readReviewsConfig(env = process.env) {
  const apiKey = String(env.GOOGLE_MAPS_API_KEY ?? '').trim();
  const placeId = String(env.GOOGLE_PLACE_ID ?? '').trim();
  return apiKey && placeId ? { apiKey, placeId } : null;
}

const ERROR_BY_STATUS = { 400: 'auth', 401: 'auth', 403: 'auth', 404: 'not_found', 429: 'rate_limited' };

const finiteOrNull = (value) => (value != null && Number.isFinite(Number(value)) ? Number(value) : null);

const toReview = (r) => ({
  id: String(r.name ?? ''),
  author: String(r.authorAttribution?.displayName ?? '').trim(),
  rating: Number(r.rating),
  comment: String(r.text?.text ?? '').trim(),
  avatar: String(r.authorAttribution?.photoUri ?? ''),
  when: String(r.relativePublishTimeDescription ?? ''),
});

async function getPlace({ apiKey, placeId, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(`${PLACES_URL}${encodeURIComponent(placeId)}?languageCode=pt-BR`, {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ReviewsError('unavailable');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ReviewsError(ERROR_BY_STATUS[response.status] ?? 'api_error', { status: response.status, message: body?.error?.message });
  return body;
}

/** Avaliações mais relevantes (até 5, só as com texto) + nota e total de avaliações do local. */
export async function fetchGoogleReviews({ apiKey, placeId, fetchImpl = fetch }) {
  const body = await getPlace({ apiKey, placeId, fetchImpl });
  const reviews = (Array.isArray(body?.reviews) ? body.reviews : []).map(toReview).filter((r) => r.id && r.author && r.comment && r.rating >= 1 && r.rating <= 5);
  return {
    rating: finiteOrNull(body?.rating),
    count: finiteOrNull(body?.userRatingCount),
    url: typeof body?.googleMapsUri === 'string' ? body.googleMapsUri : null,
    reviews,
  };
}
