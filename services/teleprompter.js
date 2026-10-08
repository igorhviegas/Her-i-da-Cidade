// IDs fixos (seed + webhook ManyChat) de Vídeo Personalizado e Vídeo Convite; o título é editável no admin.
const DETAILS_SERVICE_IDS = ['3', '4'];
const DETAILS_MARKER = /^\s*detalhes\s*:\s*/i;

/**
 * Texto do teleprompter de um pedido, ou null se o pedido não for compatível.
 * - Roteiro: order.content (snapshot gravado ao criar o pedido); cai no roteiro vinculado se vazio.
 * - Vídeo Convite/Personalizado: o que vem após "Detalhes:" em order.content (ManyChat); sem marcador, o conteúdo inteiro (pedido manual).
 */
export function getTeleprompterText({ order, script } = {}) {
  if (!order) return null;
  if (order.scriptId) return String(order.content || script?.content || '').trim();
  if (!DETAILS_SERVICE_IDS.includes(order.serviceId)) return null;
  const lines = String(order.content || '').split(/\r?\n/);
  const start = lines.findIndex((line) => DETAILS_MARKER.test(line));
  if (start === -1) return lines.join('\n').trim();
  return [lines[start].replace(DETAILS_MARKER, ''), ...lines.slice(start + 1)].join('\n').trim();
}
