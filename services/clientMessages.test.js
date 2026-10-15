import test from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_REVIEW_URL, buildClientWhatsAppUrl, firstName, reactivationMessage, reviewRequestMessage } from './clientMessages.js';
import { buildDeliveryWhatsAppUrl, whatsappPhone } from './digitalDelivery.js';

test('firstName: primeiro nome com inicial maiúscula; vazio quando não há nome', () => {
  assert.equal(firstName('maria clara SILVA'), 'Maria');
  assert.equal(firstName('  joão  '), 'João');
  for (const empty of ['', '   ', null, undefined]) assert.equal(firstName(empty), '');
});

test('reactivationMessage: cumprimenta pelo primeiro nome e funciona sem nome', () => {
  assert.match(reactivationMessage('ana paula'), /^Oi, Ana! Tudo bem\?/);
  assert.match(reactivationMessage(''), /^Oi! Tudo bem\?/);
  assert.doesNotMatch(reactivationMessage(undefined), /undefined|null/);
});

test('reviewRequestMessage: traz o link de avaliação do Google; com e sem o nome da criança', () => {
  const withChild = reviewRequestMessage('Bia Souza', 'Davi');
  assert.ok(withChild.startsWith('Oi, Bia!'));
  assert.ok(withChild.includes('o Davi tenha gostado'));
  assert.ok(withChild.includes(GOOGLE_REVIEW_URL));
  assert.ok(reviewRequestMessage('Bia').includes('o seu pequeno herói tenha gostado'));
  assert.match(GOOGLE_REVIEW_URL, /^https:\/\/search\.google\.com\/local\/writereview\?placeid=ChIJ/);
});

test('buildClientWhatsAppUrl: aceita nacional e internacional, codifica o texto e devolve null para telefone inválido', () => {
  const url = buildClientWhatsAppUrl('(31) 99999-0000', 'Olá! Tudo bem?');
  assert.equal(url, `https://wa.me/5531999990000?text=${encodeURIComponent('Olá! Tudo bem?')}`);
  assert.equal(buildClientWhatsAppUrl('+351 912 345 678', 'oi'), 'https://wa.me/351912345678?text=oi');
  for (const bad of ['', '123', 'abc', null, undefined]) assert.equal(buildClientWhatsAppUrl(bad, 'oi'), null);
});

test('whatsappPhone mantém o comportamento do envio de entrega (mesmo telefone, mesmo link)', () => {
  assert.equal(whatsappPhone('31 99999-0000'), '5531999990000');
  assert.equal(whatsappPhone('+55 31 99999-0000'), '5531999990000');
  assert.equal(whatsappPhone('abc'), null);
  const delivery = buildDeliveryWhatsAppUrl('31 99999-0000', { childName: 'Davi' }, { id: '1', title: 'Vídeo' });
  assert.ok(delivery.startsWith('https://wa.me/5531999990000?text='));
  assert.equal(buildDeliveryWhatsAppUrl('xx', {}, {}), null);
});
