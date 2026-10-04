import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeliveryWhatsAppUrl, buildDeliveryMessage, isInviteVideoService, isVideoCallService } from './digitalDelivery.js';

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

const VIDEO_CALL_TEXT = [
  'Ooii! Aqui é o Homem-Aranha 🕷️🕸️',
  'Nossa vídeo chamada espetacular será por este número!',
  'Para deixar esse momento ainda mais incrível, seguem algumas orientações:',
  '✨ Quando faltar cerca de 5 minutos, envie um “Ok” para confirmar que está tudo pronto.',
  '📱 Deixe o celular apoiado, em um local com boa iluminação e pouco barulho.',
  '👨‍👩‍👧‍👦 É importante que um responsável esteja presente durante a chamada, pois algumas crianças podem ficar tímidas no início e vão se soltando aos poucos.',
  'Nos vemos em breve! 🥳🤟🏻',
].join('\n');

test('Vídeo Chamada: mensagem padrão exata, identificada por id ou título, sem afetar outros serviços', () => {
  assert.equal(buildDeliveryMessage({}, { id: '2', title: 'qualquer' }), VIDEO_CALL_TEXT);
  assert.equal(buildDeliveryMessage({}, { id: 'abc', title: 'Vídeo Chamada ao Vivo' }), VIDEO_CALL_TEXT);
  assert.equal(buildDeliveryMessage({}, { id: 'abc', title: 'video chamada ao vivo' }), VIDEO_CALL_TEXT);
  assert.equal(isVideoCallService({ id: '1', title: 'Vídeo Personalizado' }), false);
  assert.notEqual(buildDeliveryMessage({}, { id: '1', title: 'Vídeo Personalizado' }), VIDEO_CALL_TEXT);
  assert.match(buildDeliveryMessage({ content: 'Aniversariante: Pedro' }, { id: '1', title: 'Vídeo Personalizado' }), /^Olááá! 🕸️ Aqui está o vídeo para Pedro!/);
  assert.match(buildDeliveryMessage({}, { id: '4' }), /^Olá! Aqui está o vídeo convite/);
});

test('mensagem personalizada vence o padrão (inclusive Vídeo Chamada); vazia ou só espaços usa o padrão', () => {
  assert.equal(buildDeliveryMessage({}, { id: '2', deliveryMessage: 'Oi, tudo bem?' }), 'Oi, tudo bem?');
  assert.equal(buildDeliveryMessage({}, { id: '2', deliveryMessage: '   \n ' }), VIDEO_CALL_TEXT);
  assert.equal(buildDeliveryMessage({}, { id: '2', deliveryMessage: '' }), VIDEO_CALL_TEXT);
  assert.equal(buildDeliveryMessage({}, { id: '2' }), VIDEO_CALL_TEXT);
});

test('mensagens independentes por serviço', () => {
  const a = { id: 'a', title: 'A', deliveryMessage: 'Mensagem A' };
  const b = { id: 'b', title: 'B', deliveryMessage: 'Mensagem B' };
  const c = { id: 'c', title: 'C' };
  assert.equal(buildDeliveryMessage({}, a), 'Mensagem A');
  assert.equal(buildDeliveryMessage({}, b), 'Mensagem B');
  assert.match(buildDeliveryMessage({}, c), /^Olááá!/);
});

test('link: mesmo número e estrutura; texto com emoji, acento e quebra de linha codificado e preservado', () => {
  const msg = 'Olá! 🕷️\nLinha 2 — “aspas” & 100%\n\nFim';
  const url = buildDeliveryWhatsAppUrl('(31) 98765-4321', {}, { id: 'x', deliveryMessage: msg });
  const [base, query] = url.split('?text=');
  assert.equal(base, 'https://wa.me/5531987654321');
  assert.equal(decodeURIComponent(query), msg);
  assert.match(query, /%0A/);
  assert.ok(!/[\s&]/.test(query));
  assert.equal(buildDeliveryWhatsAppUrl('123', {}, { id: 'x', deliveryMessage: msg }), null);
  assert.equal(buildDeliveryWhatsAppUrl('(31) 98765-4321', {}, { id: '2' }).split('?text=')[0], 'https://wa.me/5531987654321');
});
