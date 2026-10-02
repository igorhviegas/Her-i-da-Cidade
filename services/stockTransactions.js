// Operações de estoque dentro de transações Firestore (SDK web). Recebem a instância do Firestore, o que permite
// usá-las no app (services/stockService.ts, services/ordersService.ts) e nos testes com o emulador.
// Regra de ouro: todo saldo muda junto com uma movimentação imutável (transação única); nenhum saldo é editado "no seco".
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import {
  StockError, consumptionMovementId, describeShortages, findShortages, isLowStock, lowStockMission, movementSign, normalizeLines, reversalMovementId,
} from './stockCalculations.js';

export const STOCK_MATERIALS = 'stockMaterials';
export const STOCK_MOVEMENTS = 'stockMovements';
export const STOCK_CONSUMPTIONS = 'stockConsumptions';
export const STOCK_PENDINGS = 'stockPendings';
export const MISSIONS = 'missions';

export const pendingId = (orderId, cycle, materialId) => `${orderId}_${cycle}_${materialId}`;

/**
 * Prepara (lê) as movimentações e devolve `apply()`, que escreve movimentações, saldos e missões de reposição.
 * Chamar antes de qualquer escrita da transação.
 * requests: [{ materialId, type, quantity, orderId?, note?, movementId?, date?, extra? }], no máximo um por material.
 * quantity 0 = sem movimentação, apenas a checagem de reposição (usado quando o material está zerado numa conclusão excepcional).
 */
export async function prepareMovements(tx, firestore, requests, { actor = null, allowInactiveMaterials = false } = {}) {
  if (new Set(requests.map((r) => r.materialId)).size !== requests.length) throw new StockError('invalid_lines', 'Material repetido na mesma operação.');
  if (requests.some((r) => !Number.isInteger(r.quantity) || r.quantity < 0)) throw new StockError('invalid_lines', 'As quantidades devem ser números inteiros maiores ou iguais a zero.');
  const snapshots = await Promise.all(requests.map((r) => tx.get(doc(firestore, STOCK_MATERIALS, r.materialId))));
  const materials = new Map();
  snapshots.forEach((snap, index) => {
    if (!snap.exists()) throw new StockError('material_not_found', 'Material não encontrado no estoque.');
    materials.set(requests[index].materialId, { id: requests[index].materialId, ...snap.data() });
  });

  const outputs = requests.filter((r) => movementSign(r.type) < 0);
  const inactive = outputs.filter((r) => materials.get(r.materialId).active === false && !allowInactiveMaterials);
  if (inactive.length) throw new StockError('inactive_material', `Material inativo: ${inactive.map((r) => materials.get(r.materialId).name).join(', ')}.`);
  const shortages = findShortages(materials, outputs);
  if (shortages.length) throw new StockError('insufficient_stock', describeShortages(shortages), shortages);

  const movementRefs = requests.map((r) => (r.quantity === 0 ? null : r.movementId ? doc(firestore, STOCK_MOVEMENTS, r.movementId) : doc(collection(firestore, STOCK_MOVEMENTS))));
  const existing = await Promise.all(movementRefs.map((ref) => (ref ? tx.get(ref) : null)));
  if (existing.some((s) => s?.exists())) throw new StockError('duplicate_movement', 'Esta movimentação já foi registrada.');

  const results = requests.map((r, index) => {
    const material = materials.get(r.materialId);
    const delta = movementSign(r.type) * r.quantity;
    return { request: r, material, ref: movementRefs[index], delta, balanceAfter: (material.balance ?? 0) + delta };
  });

  // Reposição: só cria missão se o material não tiver outra missão de reposição ainda pendente.
  const lowChecks = await Promise.all(results.filter((x) => isLowStock({ ...x.material, balance: x.balanceAfter })).map(async (x) => {
    const linked = x.material.openMissionId;
    const missionSnap = linked ? await tx.get(doc(firestore, MISSIONS, linked)) : null;
    return { materialId: x.request.materialId, create: !(missionSnap?.exists() && missionSnap.data().status === 'pending') };
  }));
  const createMission = new Set(lowChecks.filter((c) => c.create).map((c) => c.materialId));

  return {
    results,
    apply() {
      for (const x of results) {
        const { request: r, material } = x;
        const update = { updatedAt: serverTimestamp() };
        if (x.ref) {
          tx.set(x.ref, {
            materialId: r.materialId, materialName: material.name, unit: material.unit, type: r.type, quantity: r.quantity, delta: x.delta,
            balanceAfter: x.balanceAfter, date: r.date ?? new Date(), note: r.note ?? '', ...(r.orderId ? { orderId: r.orderId } : {}),
            ...(r.extra ?? {}), createdBy: actor, createdAt: serverTimestamp(),
          });
          update.balance = x.balanceAfter;
          update.lastMovementId = x.ref.id;
        }
        if (createMission.has(r.materialId)) {
          const missionRef = doc(firestore, MISSIONS, `stock_${r.materialId}_${x.ref?.id ?? `${r.orderId ?? 'check'}_${Date.now()}`}`);
          tx.set(missionRef, {
            ...lowStockMission(material, x.balanceAfter), difficulty: 1, status: 'pending', source: 'stock', materialId: r.materialId, createdAt: serverTimestamp(),
          });
          update.openMissionId = missionRef.id;
        }
        tx.update(doc(firestore, STOCK_MATERIALS, r.materialId), update);
      }
    },
  };
}

/**
 * Conclusão de pedido presencial: baixa o consumo informado. Devolve `apply()`. Ciclo = nº da conclusão do pedido
 * (reabrir e concluir de novo gera novas movimentações com ids próprios, sem colidir com as anteriores).
 *
 * Estoque insuficiente: sem `allowShortage` a operação é recusada (StockError 'insufficient_stock'). Com `allowShortage`
 * (conclusão excepcional de administrador, validada também pelas regras do Firestore) baixa-se só o disponível e a diferença
 * vira uma pendência em `stockPendings` — nunca saldo negativo e nunca uma movimentação.
 */
export async function prepareOrderConsumption(tx, firestore, { orderId, lines, actor, date, allowShortage = false }) {
  const consumptionRef = doc(firestore, STOCK_CONSUMPTIONS, orderId);
  const current = await tx.get(consumptionRef);
  if (current.exists() && current.data().status === 'consumed') {
    throw new StockError('already_consumed', 'O consumo deste pedido já foi baixado do estoque; reabra o pedido antes de concluir novamente.');
  }
  const cycle = (current.exists() ? current.data().cycle : 0) + 1;
  const wanted = normalizeLines(lines);

  const snapshots = await Promise.all(wanted.map((l) => tx.get(doc(firestore, STOCK_MATERIALS, l.materialId))));
  const materials = new Map();
  snapshots.forEach((snap, index) => {
    if (!snap.exists()) throw new StockError('material_not_found', 'Material não encontrado no estoque.');
    materials.set(wanted[index].materialId, { id: wanted[index].materialId, ...snap.data() });
  });
  const inactive = wanted.filter((l) => materials.get(l.materialId).active === false);
  if (inactive.length) throw new StockError('inactive_material', `Material inativo: ${inactive.map((l) => materials.get(l.materialId).name).join(', ')}.`);
  const shortages = findShortages(materials, wanted);
  if (shortages.length && !allowShortage) throw new StockError('insufficient_stock', describeShortages(shortages), shortages);
  const missingById = new Map(shortages.map((s) => [s.materialId, s]));

  const plan = wanted.map((l) => {
    const missing = missingById.get(l.materialId)?.missing ?? 0;
    return { ...l, fulfilled: l.quantity - missing, missing };
  });
  const prepared = await prepareMovements(tx, firestore, plan.map((p) => ({
    materialId: p.materialId, type: 'consumption', quantity: p.fulfilled, orderId, date,
    movementId: consumptionMovementId(orderId, cycle, p.materialId),
    note: p.missing ? `Consumo na conclusão excepcional (faltaram ${p.missing})` : 'Consumo na conclusão do evento',
    extra: p.missing ? { requested: p.quantity, shortfall: p.missing } : {},
  })), { actor });

  return {
    apply() {
      prepared.apply();
      const exceptional = plan.some((p) => p.missing > 0);
      tx.set(consumptionRef, {
        orderId, status: 'consumed', cycle, consumedAt: date ?? new Date(), updatedAt: serverTimestamp(), createdBy: actor,
        exceptional, ...(exceptional ? { exceptionApprovedBy: actor } : {}),
        lines: prepared.results.filter((x) => x.ref).map((x) => ({ materialId: x.request.materialId, name: x.material.name, unit: x.material.unit, quantity: x.request.quantity, movementId: x.ref.id })),
        shortfalls: plan.filter((p) => p.missing > 0).map((p) => ({ materialId: p.materialId, name: materials.get(p.materialId).name, required: p.quantity, fulfilled: p.fulfilled, missing: p.missing })),
      });
      for (const p of plan.filter((x) => x.missing > 0)) {
        const material = materials.get(p.materialId);
        tx.set(doc(firestore, STOCK_PENDINGS, pendingId(orderId, cycle, p.materialId)), {
          orderId, cycle, materialId: p.materialId, materialName: material.name, unit: material.unit,
          required: p.quantity, fulfilled: p.fulfilled, missing: p.missing, status: 'open', createdBy: actor, createdAt: serverTimestamp(),
        });
      }
    },
  };
}

/**
 * Reabertura: devolve ao estoque o que a última conclusão efetivamente baixou (estorno rastreável) e anula (`voided`) as
 * pendências daquele ciclo, que permanecem como histórico. Sem consumo ativo, não faz nada.
 */
export async function prepareOrderReversal(tx, firestore, { orderId, actor, date }) {
  const consumptionRef = doc(firestore, STOCK_CONSUMPTIONS, orderId);
  const current = await tx.get(consumptionRef);
  if (!current.exists() || current.data().status !== 'consumed') return { apply() {} };
  const { cycle, lines, shortfalls = [] } = current.data();
  const pendingRefs = shortfalls.map((s) => doc(firestore, STOCK_PENDINGS, pendingId(orderId, cycle, s.materialId)));
  const pendingSnapshots = await Promise.all(pendingRefs.map((ref) => tx.get(ref)));
  const prepared = await prepareMovements(tx, firestore, lines.map((l) => ({
    materialId: l.materialId, type: 'reversal', quantity: l.quantity, orderId, date,
    movementId: reversalMovementId(orderId, cycle, l.materialId), note: 'Estorno: pedido reaberto',
  })), { actor, allowInactiveMaterials: true });
  return {
    apply() {
      prepared.apply();
      pendingRefs.forEach((ref, index) => {
        if (pendingSnapshots[index].exists() && pendingSnapshots[index].data().status === 'open') tx.update(ref, { status: 'voided', voidedAt: date ?? new Date(), updatedAt: serverTimestamp() });
      });
      tx.update(consumptionRef, { status: 'reversed', reversedAt: date ?? new Date(), updatedAt: serverTimestamp() });
    },
  };
}
