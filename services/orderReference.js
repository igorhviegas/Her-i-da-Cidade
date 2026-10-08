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

/** Extrai com segurança o nome do aniversariante a partir do pedido; retorna null se ausente ou inválido. */
export function extractBirthdayPerson(order) {
  if (!order || typeof order !== 'object') return null;

  if (typeof order.childName === 'string') {
    const candidate = order.childName.trim();
    if (candidate && candidate.toLowerCase() !== 'undefined' && candidate.toLowerCase() !== 'null') {
      return candidate;
    }
  }

  const content = typeof order.content === 'string' ? order.content.trim() : '';
  if (!content) return null;

  const match = content.match(/(?:nome\s+do\s+aniversariante|aniversariante)\s*[:-]\s*([^\r\n]+)/i);
  if (match && match[1]) {
    const rawName = match[1].trim();
    const cleaned = rawName.replace(/[.,;]+$/, '').trim();
    if (cleaned && cleaned.toLowerCase() !== 'undefined' && cleaned.toLowerCase() !== 'null') {
      return cleaned;
    }
  }

  return null;
}
