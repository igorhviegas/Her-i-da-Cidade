// Regras puras do Estoque de consumíveis (sem Firebase/React). Quantidades são sempre inteiras.
// Estoque NÃO é patrimônio: não entra em patrimonySummary nem em nenhum cálculo do Financeiro.

export const PRESENTIAL_CATEGORY = 'Presencial';
export const isPresentialService = (service) => service?.category === PRESENTIAL_CATEGORY;

export const MOVEMENT_TYPES = ['purchase', 'consumption', 'adjustment_in', 'adjustment_out', 'reversal'];
export const MOVEMENT_LABELS = {
  purchase: 'Entrada por compra', consumption: 'Consumo em evento', adjustment_in: 'Ajuste positivo', adjustment_out: 'Ajuste negativo', reversal: 'Estorno (pedido reaberto)',
};
export const movementSign = (type) => (type === 'consumption' || type === 'adjustment_out' ? -1 : 1);

export class StockError extends Error {
  constructor(code, message, details = []) { super(message); this.name = 'StockError'; this.code = code; this.details = details; }
}

const isQty = (n) => Number.isInteger(n) && n >= 0;

export function validateMaterialInput(input) {
  const errors = [];
  if (!String(input.name ?? '').trim()) errors.push('Informe o nome do material.');
  if (!String(input.category ?? '').trim()) errors.push('Informe a categoria.');
  if (!String(input.unit ?? '').trim()) errors.push('Informe a unidade de medida.');
  if (!isQty(input.defaultPerEvent)) errors.push('A quantidade padrão por evento deve ser um número inteiro maior ou igual a zero.');
  if (!isQty(input.minLevel)) errors.push('O limite mínimo deve ser um número inteiro maior ou igual a zero.');
  if (input.initialBalance !== undefined && !isQty(input.initialBalance)) errors.push('O saldo inicial deve ser um número inteiro maior ou igual a zero.');
  return errors;
}

/** Abaixo ou no limite mínimo (ex.: saldo 3, mínimo 3 → repor). */
export const isLowStock = (material) => material.active !== false && material.balance <= material.minLevel;

export const consumptionMovementId = (orderId, cycle, materialId) => `consume_${orderId}_${cycle}_${materialId}`;
export const reversalMovementId = (orderId, cycle, materialId) => `reversal_${orderId}_${cycle}_${materialId}`;

/** Une linhas do mesmo material, descarta quantidade 0 e valida inteiros >= 0. */
export function normalizeLines(lines) {
  const merged = new Map();
  for (const line of lines ?? []) {
    if (!line || typeof line.materialId !== 'string' || !line.materialId || line.materialId.includes('/')) throw new StockError('invalid_lines', 'Material inválido no consumo.');
    if (!isQty(line.quantity)) throw new StockError('invalid_lines', 'As quantidades devem ser números inteiros maiores ou iguais a zero.');
    merged.set(line.materialId, (merged.get(line.materialId) ?? 0) + line.quantity);
  }
  return [...merged].filter(([, quantity]) => quantity > 0).map(([materialId, quantity]) => ({ materialId, quantity }));
}

/** Linhas iniciais do formulário de conclusão: padrão por evento de cada material ativo. */
export const defaultConsumptionLines = (materials) =>
  materials.filter((m) => m.active !== false).map((m) => ({ materialId: m.id, quantity: m.defaultPerEvent ?? 0 }));

/** Faltas para um conjunto de saídas: [{materialId, name, required, available, missing}]. */
export function findShortages(materialsById, requests) {
  const need = new Map();
  for (const r of requests) need.set(r.materialId, (need.get(r.materialId) ?? 0) + r.quantity);
  return [...need].flatMap(([materialId, required]) => {
    const m = materialsById.get(materialId);
    const available = m?.balance ?? 0;
    return required > available ? [{ materialId, name: m?.name ?? materialId, required, available, missing: required - available }] : [];
  });
}

export const describeShortages = (shortages) =>
  `Estoque insuficiente: ${shortages.map((s) => `${s.name} (necessário ${s.required}, disponível ${s.available}, faltam ${s.missing})`).join('; ')}.`;

export const lowStockMission = (material, balance) => ({
  title: `Comprar ${String(material.name).toLocaleLowerCase('pt-BR')} para reposição do estoque`,
  description: `Estoque atual de ${material.name}: ${balance} ${material.unit}. Limite mínimo: ${material.minLevel} ${material.unit}.`,
});
