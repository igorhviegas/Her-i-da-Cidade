import { useEffect, useState } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { bankTotals, categoryKey, planImport, ruleId, type BankTotals, type BankTransaction } from './bankStatement.js';

export type { BankTotals, BankTransaction };
export type BankMonth = { items: BankTransaction[]; totals: BankTotals };
export type BankState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: BankMonth };

const TX = 'bankTransactions';
const RULES = 'bankCategoryRules';

function requireDb() {
  if (!db) throw new Error('Firebase Firestore não inicializado.');
  return db;
}

/** Lançamentos do mês importados do extrato do Inter. */
export async function listBankMonth(monthKey: string): Promise<BankTransaction[]> {
  const result = await getDocs(query(collection(requireDb(), TX), where('monthKey', '==', monthKey)));
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
 * e lembra a escolha para as próximas importações.
 */
export async function setBankCategory(tx: BankTransaction, category: string | null, sameMonth: BankTransaction[]): Promise<string[]> {
  const firestore = requireDb();
  const key = categoryKey(tx);
  const targets = [tx, ...(category ? sameMonth.filter((t) => t.id !== tx.id && !t.category && categoryKey(t) === key) : [])];
  const batch = writeBatch(firestore);
  for (const t of targets) batch.update(doc(firestore, TX, t.id), { category });
  if (category) batch.set(doc(firestore, RULES, ruleId(key)), { key, category, updatedAt: serverTimestamp() });
  else batch.delete(doc(firestore, RULES, ruleId(key)));
  await batch.commit();
  return targets.map((t) => t.id);
}

/** Lançamentos e totais reais do mês para a aba Banco, o Resumo e o Relatório mensal. `reload` força nova leitura. */
export function useBankMonth(monthKey: string, reload = 0): BankState {
  const [state, setState] = useState<BankState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    listBankMonth(monthKey)
      .then((items) => { if (alive) setState({ status: 'ready', data: { items, totals: bankTotals(items) } }); })
      .catch(() => { if (alive) setState({ status: 'error' }); });
    return () => { alive = false; };
  }, [monthKey, reload]);
  return state;
}
