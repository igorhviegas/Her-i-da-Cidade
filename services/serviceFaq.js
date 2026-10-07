// Dúvidas (FAQ) por serviço: lista ordenada de { id, title, content } guardada no próprio documento do serviço.

/** "Vídeo Convite" -> "video-convite". Base da URL pública /duvidas/{slug}. */
export function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Sanitiza o que vem do Firestore/formulário: descarta itens sem título ou conteúdo e garante ids únicos. */
export function normalizeFaq(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.flatMap((item, index) => {
    const title = typeof item?.title === 'string' ? item.title.trim() : '';
    const content = typeof item?.content === 'string' ? item.content.trim() : '';
    if (!title || !content) return [];
    let id = typeof item.id === 'string' && item.id ? item.id : `faq-${index}`;
    while (seen.has(id)) id += '-x';
    seen.add(id);
    return [{ id, title, content }];
  });
}

/** Primeiro serviço (na ordem recebida) cujo slug bate; títulos repetidos resolvem para o primeiro. */
export function findServiceBySlug(services, slug) {
  return (services ?? []).find((service) => slugify(service.title) === slug) ?? null;
}
