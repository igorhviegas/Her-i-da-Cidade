import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, ddiOf, flagEmoji, phoneCountryOptions } from './phoneCountries.js';

test('Brasil é o padrão e a primeira opção: "🇧🇷 +55"', () => {
  assert.equal(DEFAULT_PHONE_COUNTRY, 'BR');
  const [first] = phoneCountryOptions();
  assert.deepEqual([first.iso, first.ddi, first.flag], ['BR', '55', '🇧🇷']);
  assert.match(first.label, /^🇧🇷 \+55 Brasil$/);
  assert.equal(ddiOf('BR'), '55');
  assert.equal(ddiOf('ZZ'), '55'); // país desconhecido cai no padrão
});

test('outros países podem ser escolhidos: lista ampla, sem repetição e com DDI válido', () => {
  const options = phoneCountryOptions();
  assert.ok(options.length > 150);
  assert.equal(new Set(options.map((o) => o.iso)).size, options.length);
  for (const { iso, ddi } of PHONE_COUNTRIES) { assert.match(iso, /^[A-Z]{2}$/); assert.match(ddi, /^[1-9]\d{0,2}$/); }
  assert.deepEqual(['PT', 'US', 'AR', 'GB', 'JP', 'AO'].map(ddiOf), ['351', '1', '54', '44', '81', '244']);
  assert.equal(options.find((o) => o.iso === 'PT').label, '🇵🇹 +351 Portugal');
  assert.equal(flagEmoji('US'), '🇺🇸');
});

test('depois do Brasil, os países vêm em ordem alfabética (nomes em português)', () => {
  const names = phoneCountryOptions().slice(1).map((o) => o.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  assert.ok(names.includes('Estados Unidos'));
  assert.ok(!names.includes('Brasil'));
});
