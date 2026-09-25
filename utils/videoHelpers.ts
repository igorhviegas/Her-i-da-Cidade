// utils/videoHelpers.ts
// Helper functions for video processing and keyword generation

/**
 * Extract Instagram Reel ID from a full URL.
 * Supports URLs like:
 *   https://www.instagram.com/reel/ABC123/
 *   https://instagram.com/reel/ABC123
 *   https://instagram.com/reel/ABC123?utm_source=…
 */
export function extractInstagramId(url: string): string {
  try {
    const match = url.match(/reel\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

/**
 * Valida se uma string é uma URL HTTPS legítima do Instagram.
 */
export function isValidInstagramUrl(urlStr?: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'instagram.com' || hostname === 'www.instagram.com' || hostname.endsWith('.instagram.com');
  } catch {
    return false;
  }
}

/**
 * Simple keyword generator focused on search intent.
 * It combines title words, categories, and a few common synonyms.
 * The result is a set of 6‑15 keywords.
 */
export function generateKeywords(title: string, categories: string[]): string[] {
  const lower = title.toLowerCase();
  const words = lower
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.replace(/[^a-záâãéêíóôõúçñ]+/g, ''))
    .filter(Boolean);

  const base = new Set<string>(words);

  // Add categories (lowercase, split hyphens/underscores)
  categories.forEach(cat => {
    cat
      .toLowerCase()
      .split(/[-_\s]+/)
      .forEach(c => base.add(c));
  });

  // Add some generic synonyms for educational content
  const synonyms: Record<string, string[]> = {
    escovar: ['escovação', 'higiene bucal', 'escova de dentes', 'saúde bucal', 'cuidar dos dentes', 'dentes'],
    brincar: ['brincadeira', 'diversão', 'jogo', 'atividade lúdica'],
    aprender: ['educação', 'ensinar', 'aula', 'conhecimento'],
  };

  words.forEach(w => {
    if (synonyms[w]) {
      synonyms[w].forEach(s => base.add(s));
    }
  });

  // Ensure we have between 6 and 15 keywords; if too many, trim
  const arr = Array.from(base).filter(Boolean);
  if (arr.length > 15) return arr.slice(0, 15);
  return arr;
}

/**
 * Build a searchable text blob from video fields.
 * Used to improve client‑side search performance.
 */
export function buildSearchText(video: {
  title: string;
  caption?: string;
  description?: string;
  categories?: string[];
  tags?: string[];
  topics?: string[];
  keywords?: string[];
}): string {
  const parts = [
    video.title,
    video.caption ?? '',
    video.description ?? '',
    ...(video.categories ?? []),
    ...(video.tags ?? []),
    ...(video.topics ?? []),
    ...(video.keywords ?? []),
  ];
  return parts
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
