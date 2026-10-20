import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLAB_COMMISSION, COLLAB_DISCOUNT, commissionSales, couponAttribution, couponBoard, couponState, discountedPrice, normalizeCouponCode,
  normalizeInstagram, partnerDeadlines, quotaLimits, quotaUsage, validateCollabForm, weekStartOf, weeklyCommissions, weeklyReportMessage,
} from './collab.js';

const partner = (overrides = {}) => ({ id: 'p1', name: 'Mariana Souza', couponCode: 'MARI5', status: 'published', reelPublishedAt: '2026-10-01', ...overrides });
// 15h UTC = meio-dia em Brasília: o dia não muda com o fuso.
const at = (key) => new Date(`${key}T15:00:00Z`);

test('código do cupom e @ do Instagram são comparados já normalizados', () => {
  assert.equal(normalizeCouponCode(' mari 5 '), 'MARI5');
  assert.equal(normalizeCouponCode('Júlia-10'), 'JULIA10');
  assert.equal(normalizeInstagram('@Mari.Souza'), 'mari.souza');
  assert.equal(normalizeInstagram('https://www.instagram.com/mari_souza/?hl=pt'), 'mari_souza');
  assert.equal(normalizeInstagram('mari souza'), '');
});

test('validade do cupom: 30 dias depois do Reel, inclusive o último dia', () => {
  assert.equal(partnerDeadlines(partner()).couponUntil, '2026-10-31');
  assert.equal(partnerDeadlines({ conditionsAt: '2026-10-01' }).productionDue, '2026-10-16');
  assert.deepEqual(couponState(partner(), '2026-10-31'), { state: 'active', until: '2026-10-31', daysLeft: 0 });
  assert.equal(couponState(partner(), '2026-11-01').state, 'expired');
  assert.equal(couponState(partner({ reelPublishedAt: '' }), '2026-10-10').state, 'waiting');
  assert.equal(couponState(partner({ reelPublishedAt: '2026-10-20' }), '2026-10-10').state, 'waiting');
  assert.equal(couponState(partner({ couponCode: '' }), '2026-10-10').state, 'none');
});

test('painel de cupons: ativos primeiro, o que vence antes no topo', () => {
  const rows = couponBoard([
    partner({ id: 'a', name: 'A', reelPublishedAt: '2026-10-15' }),
    partner({ id: 'b', name: 'B', reelPublishedAt: '2026-10-05' }),
    partner({ id: 'c', name: 'C', reelPublishedAt: '2026-08-01' }),
    partner({ id: 'd', name: 'D', reelPublishedAt: '' }),
    partner({ id: 'e', name: 'E', couponCode: '' }),
  ], '2026-10-20');
  assert.deepEqual(rows.map((row) => [row.partner.id, row.state]), [['b', 'active'], ['a', 'active'], ['d', 'waiting'], ['c', 'expired']]);
});

test('atribuição: desconto sempre que há preço; fora da validade só avisa', () => {
  assert.deepEqual(couponAttribution('MARI5', partner(), '2026-10-10', 'catalog'), { code: 'MARI5', partnerId: 'p1', discount: COLLAB_DISCOUNT, commission: COLLAB_COMMISSION });
  assert.equal(couponAttribution('MARI5', partner(), '2026-11-15', 'catalog').warning, 'expired');
  assert.equal(couponAttribution('MARI5', partner(), '2026-11-15', 'catalog').commission, COLLAB_COMMISSION);
  assert.equal(couponAttribution('MARI5', partner({ reelPublishedAt: '' }), '2026-10-10', 'fixed').warning, 'not_started');
  assert.equal(couponAttribution('MARI5', partner({ status: 'cancelled' }), '2026-10-10', 'tiers').warning, 'cancelled');
  assert.deepEqual(couponAttribution('XPTO', null, '2026-10-10', 'catalog'), { code: 'XPTO', partnerId: null, discount: COLLAB_DISCOUNT, commission: 0, warning: 'unknown' });
  assert.deepEqual(couponAttribution('MARI5', partner(), '2026-10-10', 'pending'), { code: 'MARI5', partnerId: 'p1', discount: 0, commission: 0, warning: 'event' });
  assert.equal(discountedPrice(30, 5), 25);
  assert.equal(discountedPrice(3, 5), 0);
});

test('comissões: uma por pedido concluído, na semana (segunda a domingo) da conclusão', () => {
  assert.equal(weekStartOf('2026-10-19'), '2026-10-19'); // segunda
  assert.equal(weekStartOf('2026-10-25'), '2026-10-19'); // domingo
  const orders = [
    { id: 'o1', status: 'completed', serviceId: '1', completedAt: at('2026-10-20'), collab: { code: 'MARI5', partnerId: 'p1', commission: 3 } },
    { id: 'o2', status: 'completed', serviceId: '5', completedAt: at('2026-10-26'), collab: { code: 'MARI5', partnerId: 'p1', commission: 3 } },
    { id: 'o3', status: 'delivery', serviceId: '1', paidAt: at('2026-10-20'), collab: { code: 'MARI5', partnerId: 'p1', commission: 3 } },
    { id: 'o4', status: 'completed', serviceId: '1', completedAt: at('2026-10-21'), collab: { code: 'XPTO', partnerId: null, commission: 0 } },
    { id: 'o5', status: 'completed', serviceId: '1', completedAt: at('2026-10-21'), collab: { code: 'MARI5', partnerId: 'p1', commission: 0 } },
  ];
  const sales = commissionSales(orders);
  assert.deepEqual(sales.map((sale) => [sale.orderId, sale.weekKey]), [['o1', '2026-10-19'], ['o2', '2026-10-26']]);
  const [week] = weeklyCommissions(sales, [], '2026-10-19');
  assert.deepEqual([week.partnerId, week.pending.length, week.pendingTotal, week.paidTotal], ['p1', 1, 3, 0]);
});

test('venda paga não volta como pendente, mesmo se a conclusão mudar de semana', () => {
  const sales = commissionSales([{ id: 'o1', status: 'completed', serviceId: '1', completedAt: at('2026-10-28'), collab: { code: 'MARI5', partnerId: 'p1', commission: 3 } }]);
  const payouts = [{ partnerId: 'p1', weekKey: '2026-10-19', orderIds: ['o1'] }];
  assert.deepEqual(weeklyCommissions(sales, payouts, '2026-10-26'), []);
  const [paidWeek] = weeklyCommissions(sales, payouts, '2026-10-19');
  assert.deepEqual([paidWeek.pending.length, paidWeek.paid.length, paidWeek.paidTotal], [0, 1, 3]);
});

test('relatório semanal: só data, serviço e comissão', () => {
  const message = weeklyReportMessage({
    name: 'Mariana Souza', code: 'MARI5', weekKey: '2026-10-19', serviceName: () => 'Vídeo Especial de Aniversário',
    sales: [{ orderId: 'o1', day: '2026-10-20', serviceId: '1', commission: 3 }, { orderId: 'o2', day: '2026-10-22', serviceId: '1', commission: 3 }],
  });
  assert.match(message, /^Oi, Mariana!/);
  assert.match(message, /19\/10 a 25\/10/);
  assert.match(message, /• 20\/10 · Vídeo Especial de Aniversário/);
  assert.match(message, /Comissão da semana: R\$ 6,00/);
});

test('vagas: limite salvo ou inicial; cada concessão ocupa uma vaga', () => {
  const limits = quotaLimits({ limits: { 2: 5, 3: -1 } });
  assert.equal(limits['2'], 5);
  assert.equal(limits['3'], 4);
  const usage = quotaUsage([partner({ grants: [{ serviceId: '2' }, { serviceId: '2' }] }), partner({ id: 'p2', grants: [{ serviceId: '5' }] })], limits);
  const call = usage.find((row) => row.serviceId === '2');
  assert.deepEqual([call.granted, call.remaining], [2, 3]);
  assert.equal(usage.find((row) => row.serviceId === '5').remaining, 9);
});

test('formulário: campos obrigatórios na ordem das telas e dados limpos', () => {
  const empty = validateCollabForm({});
  assert.deepEqual(empty.fields, ['name', 'instagram', 'whatsapp', 'city', 'children', 'contentType', 'acceptTerms', 'childImage']);
  const ok = validateCollabForm({
    name: ' Mariana ', instagram: '@Mari.Souza', whatsapp: '31 99999-0000', ddi: '55', city: 'BH', contentType: 'Rotina com dois filhos',
    children: [{ name: 'Theo', age: '4 anos' }], acceptTerms: true, childImage: 'no',
  });
  assert.equal(ok.errors, null);
  assert.deepEqual([ok.form.name, ok.form.instagram, ok.form.childImage], ['Mariana', 'mari.souza', false]);
  assert.match(validateCollabForm({ ...ok.form, children: [{ name: 'Theo', age: '' }] }).errors.join(' '), /idade/);
});

test('Financeiro: comissão de parceira é custo do mês da conclusão; desconto já está no valor pago', async () => {
  const { buildRevenueEntries, buildStatement, collabCostForMonth } = await import('./financeCalculations.js');
  const { periodTotals, periodRange } = await import('./reports.js');
  const orders = [
    { id: 'o1', status: 'completed', serviceId: '1', totalPaid: 25, completedAt: new Date(2026, 9, 20, 12), collab: { code: 'MARI5', partnerId: 'p1', discount: 5, commission: 3 } },
    { id: 'o2', status: 'completed', serviceId: '1', totalPaid: 25, completedAt: new Date(2026, 9, 21, 12), collab: { code: 'XPTO', partnerId: null, discount: 5, commission: 0 } },
    { id: 'o3', status: 'delivery', serviceId: '1', totalPaid: 25, collab: { code: 'MARI5', partnerId: 'p1', discount: 5, commission: 3 } },
  ];
  const { entries } = buildRevenueEntries(orders);
  assert.equal(collabCostForMonth(entries, '2026-10').total, 3);
  const statement = buildStatement(entries, [], '2026-10');
  assert.deepEqual([statement.totalIn, statement.totalOut], [50, 3]);
  assert.ok(statement.rows.some((row) => row.source === 'collab' && row.amount === -3));
  const totals = periodTotals(entries, [], periodRange('month', new Date(2026, 9, 1)));
  assert.deepEqual([totals.collabCost, totals.variableCost, totals.result], [3, 3, 47]);
});
