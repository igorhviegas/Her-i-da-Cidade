// Aba Mapa: agrupa os eventos geocodificados por local (~50 m) para um ícone com contador.

const CELL = 2000; // 1/2000 de grau ≈ 55 m em BH

/**
 * `events` = [{ lat, lng, label, upcoming }]. Devolve um ponto por local: `upcoming` se houver evento marcado ali,
 * senão `visited` (apagado); `count` = nº de eventos; `label` = nomes (até 4) para a dica do ícone.
 */
export function groupPlaces(events) {
  const groups = new Map();
  for (const e of events) {
    if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng)) continue;
    const key = `${Math.round(e.lat * CELL)},${Math.round(e.lng * CELL)}`;
    const g = groups.get(key) ?? { lat: e.lat, lng: e.lng, labels: [], upcoming: false };
    g.labels.push(e.label);
    g.upcoming ||= Boolean(e.upcoming);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({
    kind: g.upcoming ? 'upcoming' : 'visited', lat: g.lat, lng: g.lng, count: g.labels.length,
    label: g.labels.slice(0, 4).join(' · ') + (g.labels.length > 4 ? ` +${g.labels.length - 4}` : ''),
  }));
}

const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Chave de um evento: data + nome da criança. É o ID no eventHistory (reimportar o mesmo PDF sobrescreve) e evita duplicar um pedido. */
export const eventKey = (eventDate, childName) => `${eventDate}-${slug(childName)}`.slice(0, 64);
