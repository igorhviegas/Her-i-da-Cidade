import {
  addDoc, arrayUnion, collection, deleteField, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Order } from "../types";
import { shiftMonth, type Asset, type FixedExpense } from "./financeCalculations.js";
import { LEDGER_COLLECTION, ledgerToOrders, type LedgerRecord } from "./eventFinance.js";

export const FIXED_EXPENSES_COLLECTION = "fixedExpenses";
export const ASSETS_COLLECTION = "assets";
export type AssetStatus = Asset["status"];

function requireDb() {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  return db;
}

const assertAmount = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} deve ser um número maior ou igual a zero.`);
};
const assertMonth = (value: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error("Mês inválido.");
};

type OrdersListener = { onData: (orders: Order[]) => void; onError: (error: Error) => void };
const listeners = new Set<OrdersListener>();
let stopListening: (() => void) | null = null;
let lastOrders: Order[] | null = null;

/**
 * Pedidos concluídos em tempo real (fonte do faturamento). Pedidos de evento não entram por aqui: suas parcelas e a "Despesa evento"
 * vêm do livro imutável `financeEntries` (services/eventFinance.js) e são entregues como itens sintéticos na mesma lista.
 * Um único listener Firestore é compartilhado entre o indicador do topo e a página Financeiro:
 * conclusão, edição ou reabertura de pedido em qualquer tela chega aqui sem nova leitura completa.
 */
export function subscribeCompletedOrders(onData: (orders: Order[]) => void, onError: (error: Error) => void): () => void {
  const listener = { onData, onError };
  listeners.add(listener);
  if (lastOrders) onData(lastOrders);
  if (!stopListening) {
    let completed: Order[] | null = null;
    let ledger: Order[] | null = null;
    const emit = () => {
      if (!completed || !ledger) return;
      lastOrders = [...completed, ...ledger];
      listeners.forEach((l) => l.onData(lastOrders));
    };
    const fail = (error: Error) => {
      // O Firestore encerra a escuta após um erro: limpa o estado para que a próxima assinatura crie uma nova (sem dados velhos nem escuta morta).
      stopListening?.();
      stopListening = null;
      lastOrders = null;
      const failed = [...listeners];
      listeners.clear();
      failed.forEach((l) => l.onError(error));
    };
    const firestore = requireDb();
    const stopOrders = onSnapshot(
      query(collection(firestore, "orders"), where("status", "==", "completed")),
      (snapshot) => { completed = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as Order)); emit(); },
      fail,
    );
    const stopLedger = onSnapshot(
      collection(firestore, LEDGER_COLLECTION),
      (snapshot) => { ledger = ledgerToOrders(snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as LedgerRecord & { id: string }))); emit(); },
      fail,
    );
    stopListening = () => { stopOrders(); stopLedger(); };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) { stopListening?.(); stopListening = null; lastOrders = null; }
  };
}

// ---- Despesas fixas ----
export async function listFixedExpenses(): Promise<FixedExpense[]> {
  const result = await getDocs(collection(requireDb(), FIXED_EXPENSES_COLLECTION));
  return result.docs.map((item) => ({ ...item.data(), id: item.id } as FixedExpense))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function createFixedExpense(input: { name: string; category: string; amount: number; description?: string; startMonth: string; oneTime?: boolean }) {
  const name = input.name.trim();
  if (!name || !input.category.trim()) throw new Error("Nome e categoria são obrigatórios.");
  assertAmount(input.amount, "O valor mensal");
  assertMonth(input.startMonth);
  await addDoc(collection(requireDb(), FIXED_EXPENSES_COLLECTION), {
    name, category: input.category.trim(), description: input.description?.trim() || "",
    startMonth: input.startMonth, active: true,
    // Despesa única: encerra no mês seguinte ao de início (mesmo mecanismo de "desativar"), então só conta em startMonth.
    ...(input.oneTime ? { deactivatedFrom: shiftMonth(input.startMonth, 1) } : {}),
    amountHistory: { [input.startMonth]: input.amount },
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function updateFixedExpenseInfo(id: string, input: { name: string; category: string; description?: string }) {
  if (!input.name.trim() || !input.category.trim()) throw new Error("Nome e categoria são obrigatórios.");
  await updateDoc(doc(requireDb(), FIXED_EXPENSES_COLLECTION, id), {
    name: input.name.trim(), category: input.category.trim(), description: input.description?.trim() || "", updatedAt: serverTimestamp(),
  });
}

/** Novo valor padrão a partir de `fromMonth`; meses anteriores mantêm o valor antigo. */
export async function setFixedExpenseAmountFrom(id: string, fromMonth: string, amount: number) {
  assertMonth(fromMonth); assertAmount(amount, "O valor mensal");
  await updateDoc(doc(requireDb(), FIXED_EXPENSES_COLLECTION, id), { [`amountHistory.${fromMonth}`]: amount, updatedAt: serverTimestamp() });
}

/** Ajuste pontual de um único mês (amount null remove o ajuste). */
export async function setFixedExpenseAdjustment(id: string, month: string, amount: number | null) {
  assertMonth(month);
  if (amount !== null) assertAmount(amount, "O valor do ajuste");
  await updateDoc(doc(requireDb(), FIXED_EXPENSES_COLLECTION, id), {
    [`adjustments.${month}`]: amount === null ? deleteField() : amount, updatedAt: serverTimestamp(),
  });
}

/** Desativa a partir de `fromMonth` (inclusive); o histórico anterior permanece intacto. */
export async function deactivateFixedExpense(id: string, fromMonth: string) {
  assertMonth(fromMonth);
  await updateDoc(doc(requireDb(), FIXED_EXPENSES_COLLECTION, id), { active: false, deactivatedFrom: fromMonth, updatedAt: serverTimestamp() });
}

// ---- Patrimônio ----
export async function listAssets(): Promise<Asset[]> {
  const result = await getDocs(collection(requireDb(), ASSETS_COLLECTION));
  return result.docs.map((item) => ({ ...item.data(), id: item.id } as Asset))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export interface AssetInput {
  name: string; category: string; acquisitionDate: Date; acquisitionValue: number; currentValue: number; description?: string;
}

function validateAsset(input: AssetInput) {
  if (!input.name.trim() || !input.category.trim()) throw new Error("Nome e categoria são obrigatórios.");
  if (!(input.acquisitionDate instanceof Date) || Number.isNaN(input.acquisitionDate.getTime())) throw new Error("Data de aquisição inválida.");
  assertAmount(input.acquisitionValue, "O valor de aquisição");
  assertAmount(input.currentValue, "O valor atual estimado");
}

export async function createAsset(input: AssetInput) {
  validateAsset(input);
  await addDoc(collection(requireDb(), ASSETS_COLLECTION), {
    name: input.name.trim(), category: input.category.trim(), description: input.description?.trim() || "",
    acquisitionDate: input.acquisitionDate, acquisitionValue: input.acquisitionValue, currentValue: input.currentValue,
    status: "active", valueHistory: [{ at: new Date().toISOString(), value: input.currentValue }],
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

/** Edita o item; mudança no valor atual entra no histórico de valores. */
export async function updateAsset(asset: Asset, input: AssetInput) {
  validateAsset(input);
  await updateDoc(doc(requireDb(), ASSETS_COLLECTION, asset.id), {
    name: input.name.trim(), category: input.category.trim(), description: input.description?.trim() || "",
    acquisitionDate: input.acquisitionDate, acquisitionValue: input.acquisitionValue, currentValue: input.currentValue,
    ...(input.currentValue !== asset.currentValue ? { valueHistory: arrayUnion({ at: new Date().toISOString(), value: input.currentValue }) } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function setAssetStatus(id: string, status: AssetStatus) {
  await updateDoc(doc(requireDb(), ASSETS_COLLECTION, id), { status, statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
