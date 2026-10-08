import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWalletRows, phoneKey, groupByDayPhone, expandDocs, spendByDay, spendByWeek, spendByMonth, linkSpend } from './manychatWallet.js';

const row = (Id, Amount, Subscriber, iso, extra = {}) => ({ Id, Amount, Tax: '0', Type: 'WhatsApp service message', Source: 'Flow "Aniversário"', Subscriber, 'Created at (ISO 8601)': iso, ...extra });
const rows = [
  row('1', '-0.0068', '5565998208896', '2026-10-05T09:00:00-03:00'),
  row('2', '-0.0068', '5565998208896', '2026-10-05T10:00:00-03:00'),
  row('3', '-0.0100', '5531971475989', '2026-10-07T10:00:00-03:00'),
  row('4', '20', '', '2026-10-06T21:23:00-03:00', { Type: 'Refill', Source: '' }), // recarga: ignorada
  row('', '-0.5', '1', '2026-10-06T21:23:00-03:00'), // sem Id
];

test('só débitos viram cobrança; fluxo e telefone são limpos', () => {
  const ops = parseWalletRows(rows);
  assert.equal(ops.length, 3);
  assert.deepEqual(ops[0], { id: '1', cost: 0.0068, type: 'WhatsApp service message', flow: 'Aniversário', phone: '5565998208896', day: '2026-10-05' });
});

test('reimportar não duplica: o mesmo Id sobrescreve a mesma chave', () => {
  const ops = parseWalletRows(rows);
  const once = expandDocs([...groupByDayPhone(ops).values()]);
  const twice = expandDocs([...groupByDayPhone([...ops, ...ops]).values()]);
  assert.equal(once.length, 3);
  assert.deepEqual(twice, once);
  assert.equal(groupByDayPhone(ops).size, 2);
});

test('9º dígito opcional casa o mesmo telefone', () => {
  assert.equal(phoneKey('5531971475989'), phoneKey('553171475989'));
  assert.notEqual(phoneKey('5531971475989'), phoneKey('5531971475988'));
});

test('dia, semana (seg–dom, cortada no mês) e mês', () => {
  const ops = expandDocs([...groupByDayPhone(parseWalletRows(rows)).values()]);
  const days = spendByDay(ops, '2026-10');
  assert.equal(days.length, 31);
  assert.equal(days[4].count, 2);
  // 01/10/2026 é quinta: 1–4 | 5–11 | ...
  const weeks = spendByWeek(ops, '2026-10');
  assert.deepEqual(weeks.slice(0, 2).map((w) => [w.from, w.to, w.count]), [[1, 4, 0], [5, 11, 3]]);
  assert.equal(spendByMonth(ops, 2026)[9].count, 3);
});

test('cruza consumo com vendas: gasto do cliente dividido entre os pedidos; sem venda separado', () => {
  const ops = expandDocs([...groupByDayPhone(parseWalletRows(rows)).values()]);
  const entry = (orderId, clientId, serviceId, value) => ({ orderId, order: { id: orderId, clientId, serviceId }, value, monthKey: '2026-10' });
  const clients = [{ id: 'cA', name: 'Ana', whatsappNormalized: '556598208896' }, { id: 'cB', name: 'Beto', whatsappNormalized: '5511000000000' }];
  const r = linkSpend({ ops, monthKey: '2026-10', clients, entries: [entry('o1', 'cA', 'live', 75), entry('o2', 'cA', 'tema', 20), entry('o3', 'cB', 'live', 75)] });
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].client.name, 'Ana'); // casou mesmo sem o 9º dígito
  assert.equal(r.spendSold.toFixed(4), '0.0136');
  assert.equal(r.spendNoSale.toFixed(4), '0.0100'); // telefone sem cadastro
  const live = r.services.find((s) => s.serviceId === 'live');
  assert.deepEqual([live.orders, live.revenue, +live.spend.toFixed(4)], [2, 150, 0.0068]);
  assert.equal(r.services.find((s) => s.serviceId === 'tema').spend.toFixed(4), '0.0068');
});
