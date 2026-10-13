import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_MESSAGE_MAX, AUDIO_NOTICE, AUDIO_WHATSAPP_NUMBER, buildWhatsAppMessage, buildWhatsAppUrl, cleanMessage,
  isRealDate, validateAudioRequest,
} from './audioRequest.js';

const TODAY = '2026-10-12';
const valid = (over = {}) => ({ eventDate: '2026-10-10', childName: 'Maria Eduarda', message: 'Parabéns pela conquista!', accepted: true, ...over });

test('número do WhatsApp: DDI 55 + DDD 31 + celular de 9 dígitos, no formato do wa.me', () => {
  assert.equal(AUDIO_WHATSAPP_NUMBER, '5531997462823');
  assert.match(AUDIO_WHATSAPP_NUMBER, /^55(31)9\d{8}$/);
});

test('formulário válido é aceito e normalizado', () => {
  const result = validateAudioRequest(valid({ childName: '  Maria   Eduarda ', message: '  oi\r\nlinha 2 ' }), TODAY);
  assert.deepEqual(result, { ok: true, value: { eventDate: '2026-10-10', childName: 'Maria Eduarda', message: 'oi\nlinha 2' } });
});

test('formulário vazio não passa e aponta todos os campos', () => {
  const result = validateAudioRequest({}, TODAY);
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['accepted', 'childName', 'eventDate', 'message']);
});

test('data: precisa existir, não ser futura e não ser antiga demais; hoje vale', () => {
  const error = (eventDate) => validateAudioRequest(valid({ eventDate }), TODAY).errors?.eventDate;
  assert.equal(error(TODAY), undefined);
  assert.ok(error('2026-10-13'));
  assert.ok(error('2026-02-30'));
  assert.ok(error('12/10/2026'));
  assert.ok(error('2019-12-31'));
  assert.equal(isRealDate('2024-02-29'), true);
  assert.equal(isRealDate('2025-02-29'), false);
});

test('nome: aceita acentos, nomes compostos, apóstrofo e hífen; recusa números e vazio', () => {
  const error = (childName) => validateAudioRequest(valid({ childName }), TODAY).errors?.childName;
  for (const name of ['João', 'Ana Clara', "D'Ávila Júnior", 'Maria-Luiza', 'Zoë']) assert.equal(error(name), undefined, name);
  for (const name of ['', ' ', 'A', '123', 'Maria 2', '<b>x</b>', 'x'.repeat(61)]) assert.ok(error(name), name);
});

test('mensagem: obrigatória, com limite; caracteres de controle saem e quebras de linha ficam', () => {
  const error = (message) => validateAudioRequest(valid({ message }), TODAY).errors?.message;
  assert.ok(error(''));
  assert.ok(error('oi'));
  assert.equal(error('x'.repeat(AUDIO_MESSAGE_MAX)), undefined);
  assert.ok(error('x'.repeat(AUDIO_MESSAGE_MAX + 1)));
  assert.equal(cleanMessage('a\u0000b\u0007c\nd\r\ne'), 'abc\nd\ne');
});

test('aceite das condições é obrigatório e só vale o booleano true', () => {
  for (const accepted of [undefined, false, 'true', 1]) assert.ok(validateAudioRequest(valid({ accepted }), TODAY).errors?.accepted);
});

test('mensagem do WhatsApp segue o modelo e preserva acentos, pontuação e quebras de linha', () => {
  const text = buildWhatsAppMessage({ eventDate: '2026-10-10', childName: 'João', message: 'Linha 1: “ótimo”!\nLinha 2 & 3?' });
  assert.equal(text, [
    'Olá! Gostaria de solicitar meu áudio personalizado do Herói da Cidade.',
    'Data do evento: 10/10/2026',
    'Nome da criança: João',
    'Mensagem desejada:',
    'Linha 1: “ótimo”!',
    'Linha 2 & 3?',
  ].join('\n'));
});

test('link do WhatsApp: número correto, texto codificado e reversível', () => {
  const fields = { eventDate: '2026-10-10', childName: 'João', message: 'Olá, tudo bem?\nBeijo & abraço #1 100%' };
  const url = new URL(buildWhatsAppUrl(fields));
  assert.equal(url.origin + url.pathname, 'https://wa.me/5531997462823');
  assert.equal(url.searchParams.get('text'), buildWhatsAppMessage(fields));
  assert.ok(!url.search.includes('\n') && !url.search.includes(' '));
});

test('aviso: um único áudio gratuito por cliente, gravação no estúdio e sem promessa de prazo', () => {
  assert.match(AUDIO_NOTICE, /^Atenção: cada cliente tem direito a um único áudio gratuito. /);
  assert.match(AUDIO_NOTICE, /gravados pelo próprio Herói da Cidade, no horário em que ele estiver no estúdio./);
  assert.match(AUDIO_NOTICE, /A solicitação não significa que o áudio será gravado ou enviado imediatamente.$/);
});

test('mensagem do WhatsApp não leva o aviso nem o "Estou ciente"', () => {
  const text = buildWhatsAppMessage({ eventDate: '2026-10-10', childName: 'Ana', message: 'Oi Ana!' });
  assert.doesNotMatch(text, /Estou ciente|gratuito|estúdio/);
  assert.equal(text.split(String.fromCharCode(10)).at(-1), 'Oi Ana!');
});
