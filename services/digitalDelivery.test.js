import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeliveryWhatsAppUrl, isInviteVideoService } from './digitalDelivery.js';

test('WhatsApp usa telefone e nome corretos, com mensagem codificada', () => {
  const url = buildDeliveryWhatsAppUrl('(31) 98765-4321', { content: 'Aniversariante: Pedro' });
  const [base, query] = url.split('?text=');
  assert.equal(base, 'https://wa.me/5531987654321');
  assert.equal(decodeURIComponent(query), 'Olááá! 🕸️ Aqui está o vídeo para Pedro! 🥰 Espero que gostem, foi feito com muito carinho pelo Homem-Aranha!');
  assert.ok(!query.includes(' '));
});

test('sem nome da criança usa alternativa segura; sem telefone válido retorna null', () => {
  const text = decodeURIComponent(buildDeliveryWhatsAppUrl('31987654321', { content: 'texto livre' }).split('?text=')[1]);
  assert.match(text, /para seu pequeno herói!/);
  assert.doesNotMatch(text, /undefined|null/);
  assert.equal(buildDeliveryWhatsAppUrl('', { content: 'Aniversariante: Pedro' }), null);
  assert.equal(buildDeliveryWhatsAppUrl('123', { content: 'Aniversariante: Pedro' }), null);
});

test('Vídeo Convite usa mensagem própria com o nome da criança; sem nome, alternativa segura', () => {
  const invite = { id: '4', title: 'Vídeo Convite' };
  const text = (order) => decodeURIComponent(buildDeliveryWhatsAppUrl('31987654321', order, invite).split('?text=')[1]);
  assert.equal(text({ content: 'Aniversariante: Pedro' }), 'Olá! Aqui está o vídeo convite para a festa do Pedro 🥰 espero que gostem, foi feito com muito carinho pelo Homem-Aranha! 🕸️');
  assert.equal(text({ childName: 'Lucas' }).includes('festa do Lucas'), true);
  assert.doesNotMatch(text({ content: 'x' }), /undefined|null/);
  assert.match(text({ content: 'x' }), /festa do seu pequeno herói/);
  assert.equal(isInviteVideoService({ id: 'abc', title: 'Video Convite' }), true);
});

test('outros serviços mantêm a mensagem padrão', () => {
  const url = buildDeliveryWhatsAppUrl('31987654321', { childName: 'Ana' }, { id: '1', title: 'Vídeo Especial de Aniversário' });
  assert.match(decodeURIComponent(url.split('?text=')[1]), /^Olááá! 🕸️ Aqui está o vídeo para Ana!/);
});
