import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFormConfig } from './eventFormConfig.js';
import { orderPdfInput } from './eventOrderPdf.js';
import { BUILTIN_TERMS } from './eventTerms.js';

const config = normalizeFormConfig(null);
const eventForm = { eventTime: '14:00', location: 'Rua 3, 60', imageAuthorization: true, extraWeb: 1, totalValue: 862, entryValue: 431, cost: null, observations: 'Tema: aranha', formType: 'Aniversário', pcd: false };

test('pedido do site: usa o envio guardado, preços da época e a versão aceita', () => {
  const site = { number: 215, termsVersion: '2', submittedAtMs: 1, whatsapp: '5531999990001', prices: { extraWeb: 12 }, form: { packageId: 'visita', childName: 'Miguel', cpf: '52998224725' } };
  const input = orderPdfInput({ eventForm, eventFormSite: site, childName: 'Miguel' }, { name: 'Kemily' }, config);
  assert.equal(input.label, 'A215');
  assert.equal(input.legacy, false);
  assert.equal(input.form.cpf, '52998224725');
  assert.equal(input.config.addonPrices.extraWeb, 12);
  assert.equal(input.config.addonPrices.inviteVideo, 45);
  assert.equal(input.config.termsText, BUILTIN_TERMS[2]);
  assert.equal(input.whatsappLabel, '+5531999990001');
});

test('pedido do Google Forms / manual: dados do CRM e termos versão 1', () => {
  const input = orderPdfInput({ eventForm: { ...eventForm, formType: 'A213 Aniversário' }, childName: 'Davi', eventDate: new Date('2026-11-22T15:00:00Z'), createdAt: new Date('2026-10-01T12:00:00Z') }, { name: 'Ana', whatsapp: '(31) 98888-0000' }, config);
  assert.equal(input.label, 'A213');
  assert.equal(input.legacy, true);
  assert.equal(input.termsVersion, '1');
  assert.match(input.config.termsText, /Ao assinalar a caixa no formulário/);
  assert.equal(input.form.packageId, 'aniversario');
  assert.equal(input.form.eventDate, '2026-11-22');
  assert.equal(input.form.responsibleName, 'Ana');
  assert.equal(input.form.cpf, '');
  assert.equal(orderPdfInput({ childName: 'x' }, null, config), null);
});
