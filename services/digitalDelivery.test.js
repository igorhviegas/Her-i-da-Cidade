import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeliveryWhatsAppUrl, extractBirthdayPerson, initialStatusFor, isDigitalDeliveryService } from './digitalDelivery.js';

test('os três serviços digitais nascem em Entregar; os demais preservam o status', () => {
  assert.equal(initialStatusFor({ id: '1', title: 'x' }, 'completed'), 'delivery');
  assert.equal(initialStatusFor({ id: '5', title: 'Vídeo Temático' }, 'editing'), 'delivery');
  assert.equal(initialStatusFor({ id: 'abc', title: 'Missão Digital' }, 'recording'), 'delivery');
  assert.equal(initialStatusFor({ id: '3', title: 'Vídeo Personalizado' }, 'recording'), 'recording');
  assert.equal(isDigitalDeliveryService(null), false);
});

test('WhatsApp usa telefone e nome corretos, com mensagem codificada', () => {
  const url = buildDeliveryWhatsAppUrl('(31) 98765-4321', 'Aniversariante: Pedro');
  const [base, query] = url.split('?text=');
  assert.equal(base, 'https://wa.me/5531987654321');
  assert.equal(decodeURIComponent(query), 'Olááá! 🕸️ Aqui está o vídeo para Pedro! 🥰 Espero que gostem, foi feito com muito carinho pelo Homem-Aranha!');
  assert.ok(!query.includes(' '));
});

test('sem nome da criança usa alternativa segura; sem telefone válido retorna null', () => {
  assert.equal(extractBirthdayPerson('texto livre'), null);
  const text = decodeURIComponent(buildDeliveryWhatsAppUrl('31987654321', '').split('?text=')[1]);
  assert.match(text, /para seu pequeno herói!/);
  assert.doesNotMatch(text, /undefined|null/);
  assert.equal(buildDeliveryWhatsAppUrl('', 'Aniversariante: Pedro'), null);
  assert.equal(buildDeliveryWhatsAppUrl('123', 'Aniversariante: Pedro'), null);
});
