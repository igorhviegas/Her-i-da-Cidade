import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { expandDocs, groupByDayPhone, type WalletDayDoc, type WalletOp } from "./manychatWallet.js";

export const WALLET_COLLECTION = "manychatWalletDays";

function requireDb() {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  return db;
}

/** Idempotente: cada cobrança é gravada pelo Id do ManyChat dentro do documento do dia × telefone (merge). */
export async function importWalletOps(ops: WalletOp[]): Promise<void> {
  const firestore = requireDb();
  const groups = [...groupByDayPhone(ops)];
  for (let i = 0; i < groups.length; i += 400) {
    const batch = writeBatch(firestore);
    for (const [id, group] of groups.slice(i, i + 400)) batch.set(doc(firestore, WALLET_COLLECTION, id), group, { merge: true });
    await batch.commit();
  }
}

/** Cobranças do ano inteiro (alimenta dia, semana e mês); leitura sob demanda, ~1 documento por dia × contato. */
export async function listWalletYear(year: string): Promise<WalletOp[]> {
  const result = await getDocs(query(collection(requireDb(), WALLET_COLLECTION), where("day", ">=", `${year}-01-01`), where("day", "<=", `${year}-12-31`)));
  return expandDocs(result.docs.map((item) => item.data() as WalletDayDoc));
}
