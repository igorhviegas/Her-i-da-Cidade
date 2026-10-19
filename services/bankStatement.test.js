import test from 'node:test';
import assert from 'node:assert/strict';
import { bankPeriod, bankSeries, bankTotals, categoryKey, parseCsvRows, parseMoney, parseOfx, parseStatement, planImport, replaceCategory, visibleItems } from './bankStatement.js';

test('visibleItems: oculta categorias e filtra por uma (inclusive "Sem categoria")', () => {
  const items = [{ id: 1, category: 'Transferência entre contas' }, { id: 2, category: 'Combustível e transporte' }, { id: 3, category: null }];
  assert.deepEqual(visibleItems(items, ['Transferência entre contas']).map((t) => t.id), [2, 3]);
  assert.deepEqual(visibleItems(items, [], 'Combustível e transporte').map((t) => t.id), [2]);
  assert.deepEqual(visibleItems(items, ['Combustível e transporte'], 'Sem categoria').map((t) => t.id), [3]);
  assert.deepEqual(visibleItems(items).map((t) => t.id), [1, 2, 3]);
});

test('replaceCategory: renomeia sem duplicar e remove com nulo', () => {
  assert.deepEqual(replaceCategory(['A', 'B', 'C'], 'B', 'C'), ['A', 'C']);
  assert.deepEqual(replaceCategory(['A', 'B'], 'B', 'D'), ['A', 'D']);
  assert.deepEqual(replaceCategory(['A', 'B'], 'A', null), ['B']);
});

test('bankPeriod: mês, ano, 12 meses e todo o período (por ano acima de 36 meses)', () => {
  const now = new Date(2026, 9, 19);
  assert.deepEqual(bankPeriod('month', '2026-02', now), { from: '2026-02-01', to: '2026-02-28', unit: 'day' });
  assert.deepEqual(bankPeriod('year', '2026-02', now), { from: '2026-01-01', to: '2026-12-31', unit: 'month' });
  assert.deepEqual(bankPeriod('12m', '2026-02', now), { from: '2025-11-01', to: '2026-10-31', unit: 'month' });
  assert.deepEqual(bankPeriod('all', '2026-02', now, [{ date: '2025-03-10' }, { date: '2026-01-02' }]), { from: '2025-03-01', to: '2026-10-31', unit: 'month' });
  assert.equal(bankPeriod('all', '2026-02', now, [{ date: '2023-01-05' }]).unit, 'year');
  assert.deepEqual(bankPeriod('all', '2026-02', now, []), { from: '2026-10-01', to: '2026-10-31', unit: 'month' });
});

test('bankSeries: preenche os vazios e soma entradas/saídas por dia, mês e ano', () => {
  const items = [
    { date: '2025-12-31', kind: 'in', amount: 10 }, { date: '2026-01-01', kind: 'in', amount: 0.1 },
    { date: '2026-01-01', kind: 'in', amount: 0.2 }, { date: '2026-03-15', kind: 'out', amount: 5 },
  ];
  const months = bankSeries(items, { from: '2025-11-01', to: '2026-03-31', unit: 'month' });
  assert.deepEqual(months.map((r) => r.key), ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
  assert.deepEqual(months[2], { key: '2026-01', in: 0.3, out: 0, count: 2 });
  assert.equal(months[4].out, 5);
  const days = bankSeries(items, { from: '2026-02-01', to: '2026-02-28', unit: 'day' });
  assert.equal(days.length, 28); assert.equal(days[0].key, '2026-02-01');
  assert.deepEqual(bankSeries(items, { from: '2025-01-01', to: '2026-12-31', unit: 'year' }).map((r) => [r.key, r.in]), [['2025', 10], ['2026', 0.3]]);
});

const CSV = [
  ['Extrato Conta Corrente'], ['Conta', '1234567'], ['Período', '01/10/2026 a 03/10/2026'], ['Saldo', '1.000,00'], [],
  ['Data Lançamento', 'Histórico', 'Descrição', 'Valor', 'Saldo'],
  ['01/10/2026', 'Pix recebido', 'Fulano de Tal', '350,00', '1.350,00'],
  ['01/10/2026', 'Pagamento efetuado', 'ADOBE', '-1.100,50', '249,50'],
  ['02/10/2026', 'Pix enviado', 'Beltrano', '-50,00', '199,50'],
  ['02/10/2026', 'Pix recebido', 'Beltrano', '50,00', '249,50'],
  ['02/10/2026', 'Pix enviado', 'Beltrano', '-50,00', '199,50'],
  ['lixo'],
];

test('parseMoney: formatos BR e ponto decimal', () => {
  assert.equal(parseMoney('1.234,56'), 1234.56);
  assert.equal(parseMoney('-12,30'), -12.3);
  assert.equal(parseMoney('R$ 10,00'), 10);
  assert.equal(parseMoney('\uFEFF10,00'), 10, 'BOM do início do arquivo');
  assert.equal(parseMoney('1234.56'), 1234.56);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('abc'), null);
});

test('CSV do Inter: acha o cabeçalho, sinal vira entrada/saída e ids estáveis mesmo com lançamento repetido', () => {
  const items = parseCsvRows(CSV);
  assert.equal(items.length, 5);
  assert.deepEqual(items[0], { id: 'c_2026-10-01_35000_135000_0', date: '2026-10-01', monthKey: '2026-10', amount: 350, kind: 'in', title: 'Pix recebido', description: 'Fulano de Tal', balance: 1350, source: 'csv', category: null });
  assert.equal(items[1].kind, 'out'); assert.equal(items[1].amount, 1100.5);
  assert.equal(new Set(items.map((t) => t.id)).size, 5, 'mesmo dia/valor/saldo ganha contador');
  assert.equal(items[4].id, 'c_2026-10-02_-5000_19950_1');
  // O dia seguinte reexporta o mesmo período + um lançamento novo: os ids antigos não mudam.
  const next = parseCsvRows([...CSV.slice(0, 11), ['03/10/2026', 'Pix recebido', 'Ciclano', '200,00', '399,50']]);
  assert.deepEqual(next.slice(0, 5).map((t) => t.id), items.map((t) => t.id));
  assert.equal(parseCsvRows([['sem', 'cabeçalho']]).length, 0);
});

test('OFX: FITID vira id, sinal do TRNAMT e data AAAAMMDD', () => {
  const TZ = '[' + '-3:BRT]'; // montado em partes: o Tailwind lê este arquivo e trataria o literal como classe
  const ofx = `OFXHEADER:100\n<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261001000000${TZ}<TRNAMT>350.00<FITID>abc/1<MEMO>Pix recebido Fulano</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261002<TRNAMT>-20,00<MEMO>Tarifa
</BANKTRANLIST></OFX>`;
  const items = parseOfx(ofx);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'o_abc_1'); assert.equal(items[0].kind, 'in'); assert.equal(items[0].date, '2026-10-01'); assert.equal(items[0].title, 'CREDIT');
  assert.equal(items[1].kind, 'out'); assert.equal(items[1].amount, 20); assert.match(items[1].id, /^o_2026-10-02_-2000_x_0$/);
  assert.equal(parseStatement(ofx, []).length, 2);
  assert.equal(parseStatement('csv', CSV).length, 5);
});

test('planImport ignora o que já existe e aplica a categoria das regras', () => {
  const items = parseCsvRows(CSV);
  const rules = new Map([[categoryKey(items[1]), 'Assinaturas e software']]);
  const plan = planImport(items, new Set([items[0].id]), rules);
  assert.equal(plan.skipped, 1); assert.equal(plan.toWrite.length, 4); assert.equal(plan.auto, 1);
  assert.equal(plan.toWrite[0].category, 'Assinaturas e software');
  assert.equal(categoryKey({ kind: 'out', title: 'Pagamento  Efetuado', description: 'Adobe' }), categoryKey(items[1]), 'ignora caixa e espaços');
});

test('bankTotals: entradas, saídas, saldo e quebra por categoria', () => {
  const items = parseCsvRows(CSV).map((t, i) => ({ ...t, category: i === 1 ? 'Assinaturas e software' : null }));
  const t = bankTotals(items);
  assert.equal(t.totalIn, 400); assert.equal(t.totalOut, 1200.5); assert.equal(t.balance, -800.5); assert.equal(t.uncategorized, 4);
  assert.deepEqual(t.byCategory.out, [{ category: 'Assinaturas e software', total: 1100.5 }, { category: 'Sem categoria', total: 100 }]);
});
