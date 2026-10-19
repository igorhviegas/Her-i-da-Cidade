import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { bankTotals, categoryKey, DEFAULT_CATEGORY_SETTINGS, planImport, replaceCategory, ruleId, visibleItems, type BankCategorySettings, type BankTotals, type BankTransaction } from './bankStatement.js';

export type { BankCategorySettings, BankTotals, BankTransaction };
export type BankMonth = { items: BankTransaction[]; totals: BankTotals };
export type BankState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: BankMonth };

const TX = 'bankTransactions';
const RULES = 'bankCategoryRules';
const SETTINGS = ['bankSettings', 'categories'] as const;

function requireDb() {
  if (!db) throw new Error('Firebase Firestore não inicializado.');
  return db;
}

/** Lançamentos do mês importados do extrato do Inter. */
export async function listBankMonth(monthKey: string): Promise<BankTransaction[]> {
  const result = await getDocs(query(collection(requireDb(), TX), where('monthKey', '==', monthKey)));
  return result.docs.map((d) => ({ ...(d.data() as Omit<BankTransaction, 'id'>), id: d.id }));
}

/** Lançamentos entre duas datas (AAAA-MM-DD); sem datas, o histórico inteiro ("Todo o período"). */
export async function listBankRange(from?: string, to?: string): Promise<BankTransaction[]> {
  const ref = collection(requireDb(), TX);
  const result = await getDocs(from && to ? query(ref, where('date', '>=', from), where('date', '<=', to)) : ref);
  return result.docs.map((d) => ({ ...(d.data() as Omit<BankTransaction, 'id'>), id: d.id }));
}

/** Grava só o que ainda não existe (consulta apenas o período do arquivo) e aplica as regras de categoria salvas. */
export async function importBankStatement(items: BankTransaction[]): Promise<{ added: number; skipped: number; auto: number; from: string; to: string }> {
  const firestore = requireDb();
  const dates = items.map((t) => t.date).sort();
  const from = dates[0], to = dates[dates.length - 1];
  const [existing, rules] = await Promise.all([
    getDocs(query(collection(firestore, TX), where('date', '>=', from), where('date', '<=', to))),
    getDocs(collection(firestore, RULES)),
  ]);
  const plan = planImport(items, new Set(existing.docs.map((d) => d.id)), new Map(rules.docs.map((d) => [d.data().key as string, d.data().category as string])));
  for (let i = 0; i < plan.toWrite.length; i += 400) {
    const batch = writeBatch(firestore);
    for (const { id, ...data } of plan.toWrite.slice(i, i + 400)) batch.set(doc(firestore, TX, id), { ...data, importedAt: serverTimestamp() });
    await batch.commit();
  }
  return { added: plan.toWrite.length, skipped: plan.skipped, auto: plan.auto, from, to };
}

/**
 * Categoriza o lançamento e os demais iguais (mesma regra) ainda sem categoria em `sameMonth`,
 * lembra a escolha para as próximas importações e põe um nome novo na lista de categorias.
 */
export async function setBankCategory(tx: BankTransaction, category: string | null, sameMonth: BankTransaction[], settings: BankCategorySettings): Promise<string[]> {
  const firestore = requireDb();
  const key = categoryKey(tx);
  const targets = [tx, ...(category ? sameMonth.filter((t) => t.id !== tx.id && !t.category && categoryKey(t) === key) : [])];
  const batch = writeBatch(firestore);
  for (const t of targets) batch.update(doc(firestore, TX, t.id), { category });
  if (category) {
    batch.set(doc(firestore, RULES, ruleId(key)), { key, category, updatedAt: serverTimestamp() });
    // Grava as listas inteiras (não só a do tipo): o 1º documento salvo precisa levar também as categorias padrão.
    if (!settings[tx.kind].includes(category)) batch.set(doc(firestore, ...SETTINGS), { ...settings, [tx.kind]: [...settings[tx.kind], category], updatedAt: serverTimestamp() });
  } else batch.delete(doc(firestore, RULES, ruleId(key)));
  await batch.commit();
  return targets.map((t) => t.id);
}

/** Listas de categorias e as ocultas; tempo real (um documento). Sem documento salvo, usa as padrão. */
export function useBankSettings(): BankCategorySettings {
  const [settings, setSettings] = useState<BankCategorySettings>(DEFAULT_CATEGORY_SETTINGS);
  useEffect(() => {
    if (!db) return undefined;
    return onSnapshot(doc(db, ...SETTINGS), (snap) => {
      const d = snap.data();
      setSettings(d ? { in: d.in ?? DEFAULT_CATEGORY_SETTINGS.in, out: d.out ?? DEFAULT_CATEGORY_SETTINGS.out, hidden: d.hidden ?? [] } : DEFAULT_CATEGORY_SETTINGS);
    }, () => setSettings(DEFAULT_CATEGORY_SETTINGS));
  }, []);
  return settings;
}

export async function saveBankSettings(settings: BankCategorySettings): Promise<void> {
  await setDoc(doc(requireDb(), ...SETTINGS), { in: settings.in, out: settings.out, hidden: settings.hidden, updatedAt: serverTimestamp() });
}

/**
 * Renomeia (ou, com `next` nulo, exclui) uma categoria em todo o histórico: lançamentos, regras lembradas e listas.
 * Excluir deixa os lançamentos sem categoria. Resolve com quantos lançamentos mudaram.
 */
export async function renameBankCategory(old: string, next: string | null, settings: BankCategorySettings): Promise<number> {
  const firestore = requireDb();
  const [txs, rules] = await Promise.all([
    getDocs(query(collection(firestore, TX), where('category', '==', old))),
    getDocs(query(collection(firestore, RULES), where('category', '==', old))),
  ]);
  const writes = [
    ...txs.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.update(d.ref, { category: next })),
    ...rules.docs.map((d) => (b: ReturnType<typeof writeBatch>) => (next ? b.set(d.ref, { key: d.data().key, category: next, updatedAt: serverTimestamp() }) : b.delete(d.ref))),
  ];
  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(firestore);
    writes.slice(i, i + 400).forEach((w) => w(batch));
    await batch.commit();
  }
  await saveBankSettings({ in: replaceCategory(settings.in, old, next), out: replaceCategory(settings.out, old, next), hidden: replaceCategory(settings.hidden, old, next) });
  return txs.size;
}

function useBankLoad(key: string, load: () => Promise<BankTransaction[]>, reload: number): BankState {
  const { hidden } = useBankSettings();
  const [items, setItems] = useState<BankTransaction[] | null | 'error'>(null);
  useEffect(() => {
    let alive = true;
    setItems(null);
    load().then((list) => { if (alive) setItems(list); }).catch(() => { if (alive) setItems('error'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifica a consulta; `load` muda a cada render
  }, [key, reload]);
  return useMemo<BankState>(() => (items === null ? { status: 'loading' } : items === 'error' ? { status: 'error' }
    : { status: 'ready', data: { items, totals: bankTotals(visibleItems(items, hidden)) } }), [items, hidden]);
}

/** Lançamentos e totais reais do mês (sem as categorias ocultas) para o Resumo e o Relatório mensal. */
export function useBankMonth(monthKey: string, reload = 0): BankState {
  return useBankLoad(`m:${monthKey}`, () => listBankMonth(monthKey), reload);
}

/** Lançamentos do período da aba Banco (sem datas = tudo). `reload` força nova leitura. */
export function useBankRange(from: string | undefined, to: string | undefined, reload = 0): BankState {
  return useBankLoad(`r:${from ?? ''}:${to ?? ''}`, () => listBankRange(from, to), reload);
}
