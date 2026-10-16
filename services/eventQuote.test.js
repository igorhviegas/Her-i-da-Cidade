import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_QUOTE_CONFIG, computeQuote, distanceFee, normalizeQuoteConfig, quoteMessage, roundPrice } from './eventQuote.js';

test('arredondamento termina em 47 ou 97 (exemplos do dono)', () => {
  assert.equal(roundPrice(635.78), 647);
  assert.equal(roundPrice(678), 697);
  assert.equal(roundPrice(650), 647);
  assert.equal(roundPrice(700), 697);
  assert.equal(roundPrice(701), 747);
  assert.equal(roundPrice(650.01), 697);
});

test('faixa de distância: até 15 km = 0, depois +50 a cada 15 km', () => {
  const rules = { tierKm: 15, tierFee: 50 };
  assert.equal(distanceFee(0, rules), 0);
  assert.equal(distanceFee(15, rules), 0);
  assert.equal(distanceFee(15.1, rules), 50);
  assert.equal(distanceFee(30, rules), 50);
  assert.equal(distanceFee(30.1, rules), 100);
  assert.equal(distanceFee(45, rules), 100);
  assert.equal(distanceFee(46, rules), 150);
});

test('Aniversário em BH a 35 km: 450 + 100 (faixa) + 115 + 140 = 805 → 847', () => {
  const quote = computeQuote({ packageId: 'aniversario', km: 35, date: '2026-11-20', city: 'Belo Horizonte' });
  assert.equal(quote.companyFee, 550);
  assert.equal(quote.travel, 140);
  assert.equal(quote.subtotal, 805);
  assert.equal(quote.rounded, 847);
  assert.equal(quote.total, 847);
  assert.equal(quote.entry, 423.5);
});

test('mínimo da cidade vale para o Aniversário (sem acento/caixa) e não para a Visita', () => {
  const aniversario = computeQuote({ packageId: 'aniversario', km: 20, date: '', city: 'contagem' });
  assert.equal(aniversario.rounded, 697);
  assert.equal(aniversario.total, 747);
  assert.equal(aniversario.minimumCity, 'Contagem');
  const visita = computeQuote({ packageId: 'visita', km: 20, date: '', city: 'Contagem' });
  assert.equal(visita.total, visita.rounded);
});

test('extra da data soma no cachê da empresa', () => {
  const config = normalizeQuoteConfig({ ...DEFAULT_QUOTE_CONFIG, dateExtras: { '2026-10-12': 100 } });
  const quote = computeQuote({ packageId: 'visita', km: 10, date: '2026-10-12', city: 'Betim' }, config);
  assert.equal(quote.dateExtra, 100);
  assert.equal(quote.subtotal, 300 + 100 + 115 + 40);
});

test('Presença VIP exige o cachê do orçamento', () => {
  assert.match(computeQuote({ packageId: 'vip', km: 10 }).error, /cachê/);
  assert.equal(computeQuote({ packageId: 'vip', km: 10, companyBase: '800' }).base, 800);
});

test('configuração salva inválida cai no padrão', () => {
  const config = normalizeQuoteConfig({ agentFee: 'x', bases: { aniversario: -1 }, dateExtras: { nope: 10, '2026-01-01': 0 } });
  assert.equal(config.agentFee, 115);
  assert.equal(config.bases.aniversario, 450);
  assert.deepEqual(config.dateExtras, {});
  assert.equal(config.minimums.aniversario.Betim, 597);
});

test('mensagem do WhatsApp traz itens, valor, sinal e link', () => {
  const text = quoteMessage({ packageId: 'aniversario', date: '2026-11-20', total: 847, link: 'https://x/f?o=1' });
  assert.match(text, /Aniversário Espetacular\* · 20\/11\/2026/);
  assert.match(text, /R\$ 847,00/);
  assert.match(text, /R\$ 423,50/);
  assert.match(text, /https:\/\/x\/f\?o=1$/);
});
