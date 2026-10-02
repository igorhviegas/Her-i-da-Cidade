// Ordem personalizada da navegação lateral do Admin (pura, sem React/Firebase).

/**
 * Junta a ordem salva com os módulos atuais: ids salvos que ainda existem, na ordem salva (sem repetir),
 * seguidos dos módulos novos/ausentes na ordem padrão. Nunca perde nem duplica módulo, qualquer que seja o valor salvo.
 */
export function resolveNavOrder(defaultIds, saved) {
  const known = new Set(defaultIds);
  const seen = new Set();
  const order = [];
  for (const id of Array.isArray(saved) ? saved : []) {
    if (known.has(id) && !seen.has(id)) { seen.add(id); order.push(id); }
  }
  for (const id of defaultIds) if (!seen.has(id)) order.push(id);
  return order;
}

/** Move `id` para a posição de `targetId` (antes ou depois dele). Ids desconhecidos ou iguais não alteram a ordem. */
export function moveNavItem(order, id, targetId, position = 'before') {
  if (id === targetId || !order.includes(id) || !order.includes(targetId)) return order;
  const rest = order.filter((item) => item !== id);
  const at = rest.indexOf(targetId) + (position === 'after' ? 1 : 0);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/** Troca `id` com o vizinho (-1 sobe, +1 desce); nas pontas não faz nada. */
export function shiftNavItem(order, id, delta) {
  const index = order.indexOf(id);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= order.length) return order;
  const copy = [...order];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}
