// Regressões das falhas encontradas na validação prática (ver relatório). Verificações de código-fonte; o comportamento
// real foi exercitado no navegador contra o emulador e, para regras, em tests/firestore-rules.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('F1: importação duplicada concorrente — o pedido e a reserva do PDF (orderImports) nascem na mesma transação', async () => {
  const orders = await read('./ordersService.ts');
  assert.match(orders, /export const ORDER_IMPORTS_COLLECTION = "orderImports"/);
  assert.match(orders, /async function claimImport\(transaction: Transaction/);
  assert.match(orders, /if \(existing\.exists\(\)\) throw new Error\(`Este formulário já foi importado/);
  assert.match(orders, /await claimImport\(transaction, claim, reference\.id\);\s+transaction\.set\(reference, payload\)/);
  assert.match(orders, /else if \(claim\) await setOrderClaimingImport\(reference, payload, claim\)/);
  assert.match(orders, /if \(claim\) await claimImport\(transaction, claim, reference\.id\)/); // pedido que já nasce concluído
  const rules = await read('../firestore.rules');
  assert.match(rules, /match \/orderImports\/\{importId\}[\s\S]*allow update, delete: if false/);
});

test('F2: OCR de baixa qualidade não vira conteúdo do pedido por padrão', async () => {
  const panel = await read('../components/admin/ImportPdfPanel.tsx');
  assert.match(panel, /result\.method === 'text'\]\)/); // não mapeados: marcados só em texto nativo
  assert.match(panel, /\['whatsapp', 'eventDate', 'eventTime'\]\.includes\(k\) && !f\.parsed/); // sem validação: desmarcado
  assert.match(panel, /text\.length > 200/); // ruído longo não inunda a tela
  assert.match(panel, /Nenhum campo foi reconhecido/);
  assert.match(panel, /disabled=\{!Object\.values\(use\)\.some\(Boolean\)\}/);
});

test('F3: editor não vê o rótulo nem a cor da conclusão excepcional', async () => {
  const modal = await read('../components/admin/StockConsumptionModal.tsx');
  assert.match(modal, /const asException = exceptional && canOverride/);
  assert.match(modal, /asException \? 'Concluir com pendências de estoque' : 'Concluir evento e baixar estoque'/);
});

test('F4: repetir a conclusão de um pedido já concluído não reescreve completedAt; reabrir e concluir de novo continua datando', async () => {
  const orders = await read('./ordersService.ts');
  assert.match(orders, /updates\.completedAt === undefined && currentData\.status === 'completed'\) \{/);
  assert.match(orders, /\} else if \(updates\.status === 'completed' && updates\.completedAt === undefined\) \{\s+payload\.completedAt = serverTimestamp\(\)/);
});
