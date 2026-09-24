import { Video } from '../types';

/** Normaliza texto para uma busca independente de acentos e maiúsculas. */
export function normalizeVideoSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function levenshtein(left: string, right: string): number {
  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0)
  );

  for (let index = 0; index <= left.length; index += 1) matrix[index][0] = index;
  for (let index = 0; index <= right.length; index += 1) matrix[0][index] = index;

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      matrix[row][column] = left[row - 1] === right[column - 1]
        ? matrix[row - 1][column - 1]
        : Math.min(
          matrix[row - 1][column] + 1,
          matrix[row][column - 1] + 1,
          matrix[row - 1][column - 1] + 1
        );
    }
  }

  return matrix[left.length][right.length];
}

function isApproximateMatch(query: string, text: string): boolean {
  const normalizedQuery = normalizeVideoSearchText(query);
  const normalizedText = normalizeVideoSearchText(text);

  if (!normalizedQuery) return true;
  if (normalizedText.includes(normalizedQuery)) return true;

  return normalizedText
    .split(/\s+/)
    .some((word) => {
      if (word.length < 3 || normalizedQuery.length < 3) return false;
      const distance = levenshtein(word, normalizedQuery);
      return distance / Math.max(word.length, normalizedQuery.length) <= 0.25;
    });
}

/** Busca por título, legenda, categorias e tags com suporte a acentuação e termos aproximados. */
export function searchVideos(videos: Video[], query: string): Video[] {
  const normalizedQuery = normalizeVideoSearchText(query);
  if (!normalizedQuery) return videos;

  return videos.filter((video) => {
    const searchableFields = [
      video.title,
      video.caption,
      ...(video.categories || []),
      ...(video.tags || []),
    ];

    return searchableFields.some((field) => isApproximateMatch(normalizedQuery, field || ''));
  });
}
