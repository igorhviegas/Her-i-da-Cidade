import { logger } from '../lib/logger.js';
import type { Review } from "../types";

export interface GoogleReviews {
  rating: number | null;
  count: number | null;
  url: string | null;
  reviews: Review[];
}

/** Avaliações reais do Google via /api/reviews. Sem fallback inventado: se falhar, devolve null e o site esconde o carrossel. */
export const fetchGoogleReviews = async (): Promise<GoogleReviews | null> => {
  try {
    const response = await fetch("/api/reviews");
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error("Erro ao buscar avaliações do servidor:", error);
    return null;
  }
};
