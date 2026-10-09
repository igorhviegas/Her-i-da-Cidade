export type ReviewsErrorCode = 'unavailable' | 'auth' | 'invalid_place' | 'not_found' | 'rate_limited' | 'api_error';
export class ReviewsError extends Error { code: ReviewsErrorCode; detail?: unknown; constructor(code: ReviewsErrorCode, detail?: unknown); }

export interface ReviewsConfig { apiKey: string; placeId: string }
export function readReviewsConfig(env?: Record<string, string | undefined>): ReviewsConfig | null;

export interface GoogleReview { id: string; author: string; rating: number; comment: string; avatar: string; when: string }
export interface GoogleReviewsResult { rating: number | null; count: number | null; url: string | null; reviews: GoogleReview[] }
export function fetchGoogleReviews(opts: ReviewsConfig & { fetchImpl?: typeof fetch }): Promise<GoogleReviewsResult>;
