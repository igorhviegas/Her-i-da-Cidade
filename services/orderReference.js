/** A human-facing label only; Order.id remains the technical document key. */
export function formatOrderReference(order, orders = []) {
  if (order?.orderNumberDisplay) return `#${order.orderNumberDisplay}`;
  const id = typeof order?.id === 'string' ? order.id.trim() : '';
  if (!id) return '#ID indisponível';

  const normalizedId = id.toLocaleLowerCase('en-US');
  const others = orders
    .filter((candidate) => candidate && candidate.id !== order.id)
    .map((candidate) => ({
      value: (candidate.orderNumberDisplay || candidate.id).toLocaleLowerCase('en-US'),
      isDocumentId: !candidate.orderNumberDisplay,
    }))
    .filter(({ value }) => typeof value === 'string' && value);

  for (let length = Math.min(8, id.length); length <= id.length; length += 1) {
    const prefix = normalizedId.slice(0, length);
    if (!others.some(({ value, isDocumentId }) => value === prefix || (isDocumentId && value.startsWith(prefix)))) {
      return `#${id.slice(0, length)}`;
    }
  }
  return `#${id}`;
}
