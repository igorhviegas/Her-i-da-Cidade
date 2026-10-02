import { addDoc, collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { StockError, validateMaterialInput, type MovementType, type StockMaterial, type StockMovement } from "./stockCalculations.js";
import { STOCK_MATERIALS, STOCK_MOVEMENTS, STOCK_PENDINGS, prepareMovements } from "./stockTransactions.js";

export { StockError } from "./stockCalculations.js";
export type { StockMaterial, StockMovement, MovementType, ConsumptionLine, Shortage } from "./stockCalculations.js";

const MOVEMENT_HISTORY_LIMIT = 500;

function requireDb() {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  return db;
}

/** Responsável pela operação: e-mail do administrador autenticado. */
export const currentActor = (): string | null => auth?.currentUser?.email ?? auth?.currentUser?.uid ?? null;

export interface MaterialInput {
  name: string; category: string; unit: string; defaultPerEvent: number; minLevel: number; active: boolean; description?: string;
}

function assertValid(input: object) {
  const errors = validateMaterialInput(input as Record<string, any>);
  if (errors.length) throw new Error(errors.join(" "));
}

export async function listMaterials(): Promise<StockMaterial[]> {
  const result = await getDocs(collection(requireDb(), STOCK_MATERIALS));
  return result.docs.map((item) => ({ ...item.data(), id: item.id } as StockMaterial)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export interface StockPending {
  id: string; orderId: string; cycle: number; materialId: string; materialName: string; unit: string;
  required: number; fulfilled: number; missing: number; status: "open" | "voided"; createdBy?: string | null; createdAt?: any;
}

/** Pendências de estoque (faltas registradas em conclusões excepcionais): não são movimentações e não alteram saldo. */
export async function listPendings(): Promise<StockPending[]> {
  const result = await getDocs(collection(requireDb(), STOCK_PENDINGS));
  return result.docs.map((item) => ({ ...item.data(), id: item.id } as StockPending));
}

export async function listMovements(): Promise<StockMovement[]> {
  const result = await getDocs(query(collection(requireDb(), STOCK_MOVEMENTS), orderBy("date", "desc"), limit(MOVEMENT_HISTORY_LIMIT)));
  return result.docs.map((item) => ({ ...item.data(), id: item.id } as StockMovement));
}

/** Cria o material com saldo zero; um saldo inicial vira uma movimentação de ajuste positivo (nunca saldo "no seco"). */
export async function createMaterial(input: MaterialInput & { initialBalance?: number }): Promise<void> {
  assertValid(input);
  const reference = await addDoc(collection(requireDb(), STOCK_MATERIALS), {
    name: input.name.trim(), category: input.category.trim(), unit: input.unit.trim(), description: input.description?.trim() || "",
    defaultPerEvent: input.defaultPerEvent, minLevel: input.minLevel, active: input.active, balance: 0,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  if (input.initialBalance) await registerMovement({ materialId: reference.id, type: "adjustment_in", quantity: input.initialBalance, note: "Saldo inicial" });
}

/** Edita cadastro, consumo padrão e limite mínimo. O saldo só muda por movimentações. */
export async function updateMaterial(id: string, input: MaterialInput): Promise<void> {
  assertValid(input);
  await updateDoc(doc(requireDb(), STOCK_MATERIALS, id), {
    name: input.name.trim(), category: input.category.trim(), unit: input.unit.trim(), description: input.description?.trim() || "",
    defaultPerEvent: input.defaultPerEvent, minLevel: input.minLevel, active: input.active, updatedAt: serverTimestamp(),
  });
}

/** Uma movimentação avulsa (entrada ou ajuste) em transação, com missão de reposição se o saldo ficar no limite. */
export async function registerMovement(input: { materialId: string; type: Exclude<MovementType, "consumption" | "reversal">; quantity: number; date?: Date; note?: string }): Promise<void> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error("A quantidade deve ser um número inteiro maior que zero.");
  const firestore = requireDb();
  await runTransaction(firestore, async (transaction) => {
    const prepared = await prepareMovements(transaction, firestore, [{ ...input, date: input.date ?? new Date() }], { actor: currentActor() });
    prepared.apply();
  });
}

export const registerEntry = (input: { materialId: string; quantity: number; date?: Date; note?: string }) => registerMovement({ ...input, type: "purchase" });

/** Ajuste de inventário: informa o saldo contado e a diferença vira ajuste positivo ou negativo; a observação é obrigatória. */
export async function adjustBalance(input: { materialId: string; newBalance: number; note: string; date?: Date }): Promise<void> {
  if (!Number.isInteger(input.newBalance) || input.newBalance < 0) throw new Error("O saldo contado deve ser um número inteiro maior ou igual a zero.");
  if (!input.note.trim()) throw new Error("Informe o motivo do ajuste.");
  const firestore = requireDb();
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(doc(firestore, STOCK_MATERIALS, input.materialId));
    if (!snapshot.exists()) throw new StockError("material_not_found", "Material não encontrado no estoque.");
    const difference = input.newBalance - (snapshot.data().balance ?? 0);
    if (difference === 0) throw new Error("O saldo contado é igual ao saldo atual; nada a ajustar.");
    const prepared = await prepareMovements(transaction, firestore, [{
      materialId: input.materialId, type: difference > 0 ? "adjustment_in" : "adjustment_out", quantity: Math.abs(difference), note: input.note.trim(), date: input.date ?? new Date(),
    }], { actor: currentActor() });
    prepared.apply();
  });
}

/** Materiais iniciais dos eventos presenciais (ids fixos; não recria os já existentes). Consumo e mínimo começam em 0 para você configurar. */
export const INITIAL_MATERIALS = [
  { id: "teia", name: "Teia", unit: "unidade" }, { id: "moldura", name: "Moldura", unit: "unidade" }, { id: "certificado", name: "Certificado", unit: "unidade" },
  { id: "medalha", name: "Medalha", unit: "unidade" }, { id: "figurinhas", name: "Figurinhas", unit: "pacote" },
];

export async function seedInitialMaterials(): Promise<number> {
  const firestore = requireDb();
  return runTransaction(firestore, async (transaction) => {
    const refs = INITIAL_MATERIALS.map((m) => doc(firestore, STOCK_MATERIALS, m.id));
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    let created = 0;
    INITIAL_MATERIALS.forEach((m, index) => {
      if (snapshots[index].exists()) return;
      transaction.set(refs[index], {
        name: m.name, category: "Eventos presenciais", unit: m.unit, description: "", defaultPerEvent: 0, minLevel: 0, active: true, balance: 0,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      created += 1;
    });
    return created;
  });
}
