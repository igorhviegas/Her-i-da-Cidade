import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFormConfigDoc, normalizeFormConfig, publicFormConfig } from './eventFormConfig.js';
import { BUILTIN_TERMS, TERMS_TEMPLATE, parseTerms, termsSections, unknownTermsFields } from './eventTerms.js';

test('sem nada salvo: padrão (pacotes, preços, 3 dias, termos v3; v2 guardada)', () => {
  const config = normalizeFormConfig(null);
  assert.equal(config.packages[0].title, 'Aniversário Espetacular');
  assert.deepEqual(config.addonPrices, { extraWeb: 15, birthdayVideo: 20, inviteVideo: 45, extraChild: 10 });
  assert.equal(config.depositDays, 3);
  assert.equal(config.termsVersion, '3');
  assert.equal(parseTerms(config.termsText).length, 13);
  assert.match(config.terms['2'], /aguarda até 15 minutos/);
  assert.match(config.termsText, /tolerância de 10 minutos/);
  assert.doesNotMatch(config.termsText, /se trocar/);
  assert.match(config.termsText, /o ator ou o agente avisa/);
  assert.equal(publicFormConfig(config).terms, undefined);
});

test('modelo preenchido: campos do cliente, prazo e [campo] quando vazio', () => {
  const sections = termsSections({ name: 'Kemily', cpf: '529.982.247-25', packageTitle: 'Visita Espetacular', duration: '30 minutos', date: '22/11/2026', time: '14:00', location: 'Rua 3' }, { depositDays: 5 });
  assert.match(sections[0].items[0], /^Prestador: Herói da Cidade, 52\.411\.770 IGOR HENRIQUES VIEGAS \(MEI\), CNPJ 52\.411\.770\/0001-20, Betim\/MG\.$/);
  assert.equal(sections[0].items[1], 'Contratante: Kemily, CPF 529.982.247-25, WhatsApp [WhatsApp], e-mail [e-mail].');
  assert.match(sections[1].items[0], /no pacote Visita Espetacular \(30 minutos\), em 22\/11\/2026 às 14:00, no endereço Rua 3\./);
  assert.match(sections[2].items[1], /em até 5 dias/);
  assert.deepEqual(unknownTermsFields('{cpf} {nomee}'), ['nomee']);
});

test('salvar texto diferente cria a próxima versão e mantém as anteriores', () => {
  const v2 = normalizeFormConfig(null);
  const edits = { packages: v2.packages, addonPrices: { extraWeb: 20, birthdayVideo: 20, inviteVideo: 50 }, depositDays: 4, termsText: `${TERMS_TEMPLATE}\n\n## 14. Extra\nNovo item.` };
  const first = buildFormConfigDoc(v2, edits);
  assert.equal(first.newVersion, '4');
  const v3 = normalizeFormConfig(first.doc);
  assert.equal(v3.termsVersion, '4');
  assert.equal(v3.terms['2'], BUILTIN_TERMS[2]);
  assert.equal(v3.terms['3'], TERMS_TEMPLATE);
  assert.equal(parseTerms(v3.termsText).length, 14);
  assert.equal(v3.addonPrices.inviteVideo, 50);
  assert.equal(v3.depositDays, 4);

  const same = buildFormConfigDoc(v3, { ...edits, termsText: v3.termsText });
  assert.equal(same.newVersion, null);
  assert.equal(same.doc.termsVersion, '4');

  assert.match(buildFormConfigDoc(v3, { ...edits, termsText: 'sem seções' }).error, /seção/);
});

test('valores salvos inválidos caem no padrão', () => {
  const config = normalizeFormConfig({ addonPrices: { extraWeb: -1 }, depositDays: 0, termsVersion: '9', terms: { 9: 'sem seções' }, packages: { vip: { title: '  ', items: [] } } });
  assert.equal(config.addonPrices.extraWeb, 15);
  assert.equal(config.depositDays, 3);
  assert.equal(config.termsVersion, '3');
  assert.equal(normalizeFormConfig({ terms: { 2: '## Falso\nTexto trocado.' } }).terms['2'], BUILTIN_TERMS[2]); // versão embutida não é sobrescrita
  assert.equal(config.packages[2].title, 'Presença VIP');
});
