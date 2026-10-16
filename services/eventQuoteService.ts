import { auth } from '../lib/firebaseAuth';
import type { QuoteResult } from './eventQuote.js';

export interface QuoteCalculation { quote: QuoteResult; address: { formatted: string; precise: boolean; city: string } }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Faça login como administrador.');
  let response: Response;
  try {
    response = await fetch('/api/event-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Sem conexão com o servidor.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) throw new Error(data?.error?.message ?? 'Não foi possível concluir agora.');
  return data as T;
}

/** Calcula no servidor (rota casa → evento no Google Maps + regras salvas). */
export const calculateEventQuote = (input: { address: string; date: string; packageId: string; companyBase?: string }) =>
  call<QuoteCalculation>({ action: 'quote', ...input });

/** Guarda o orçamento e devolve o ID usado no link do formulário (?orcamento=ID). */
export const saveEventQuote = async (input: { packageId: string; date: string; location: string; total: number; km: number; city: string }) =>
  (await call<{ id: string }>({ action: 'save-quote', ...input })).id;
