import { CUSTOM_VIDEO_SERVICE_ID } from './financeCalculations.js';
import { formatOrderReference } from './orderReference.js';

export const PAY_EDITOR_MISSION_TITLE = 'Pagar Vitor';
export const PAY_EDITOR_MISSION_SOURCE = 'order_payment';
const EASY = 2; // dificuldade 2 = "fácil" (DifficultySelect)

/** ID determinístico: concluir o mesmo pedido de novo (reabrir/repetir) nunca gera uma segunda missão. */
export const payEditorMissionId = (orderId) => `pay-editor-${orderId}`;

const endOfDay = (date) => { const due = new Date(date); due.setHours(23, 59, 59, 999); return due; };

/** Missão "Pagar Vitor" gerada ao concluir um Vídeo Personalizado; null para os demais serviços. */
export function buildPayEditorMission(order, client, service, completedAt) {
  if (order?.serviceId !== CUSTOM_VIDEO_SERVICE_ID) return null;
  const description = [
    `Pedido ${formatOrderReference(order)} · ${service?.title || 'Vídeo Personalizado'}`,
    `Cliente: ${client?.name || 'não encontrado'}`,
    order.childName ? `Criança: ${order.childName}` : null,
    typeof order.editingCost === 'number' ? `Custo de edição: R$ ${order.editingCost.toFixed(2).replace('.', ',')}` : null,
    order.content ? `Conteúdo solicitado:\n${String(order.content).trim()}` : null,
  ].filter(Boolean).join('\n');
  return {
    title: PAY_EDITOR_MISSION_TITLE, description, difficulty: EASY, status: 'pending',
    source: PAY_EDITOR_MISSION_SOURCE, orderId: order.id, dueAt: endOfDay(completedAt),
  };
}
