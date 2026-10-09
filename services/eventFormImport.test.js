import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ageOn, parseGoogleEventForm, toIsoDate, toTime } from './eventFormImport.js';
import { buildVideoContents, findVideoService } from './eventVideos.js';

const sample = readFileSync(new URL('./fixtures/formulario-missao.txt', import.meta.url), 'utf8');

test('lê o Formulário da Missão completo (com os dois vídeos)', () => {
  assert.deepEqual(parseGoogleEventForm(sample), {
    childName: 'Davi Luca Souza Lima', birthDate: '2019-12-19', eventDate: '2026-12-19', eventTime: '18:45',
    location: 'Rua das Flores, 100 - Centro, Belo Horizonte - MG', responsible: 'Ana Souza Lima',
    birthdayVideo: { firstName: 'Davi' },
    inviteVideo: { name: 'Davi Luca', age: '7', time: '17:00', details: 'Vir fantasiado ou fantasiada com a sua roupa do homem aranha, e não esqueça de confirmar sua presença que será primordial para a organização da festa.' },
  });
});

test('sem as seções de vídeo, os adicionais vêm nulos', () => {
  const cut = sample.slice(0, sample.indexOf('Lançamento de teia EXTRA'));
  const parsed = parseGoogleEventForm(cut);
  assert.equal(parsed.birthdayVideo, null);
  assert.equal(parsed.inviteVideo, null);
  assert.equal(parsed.eventTime, '18:45');
});

test('texto que não é o formulário é recusado', () => assert.equal(parseGoogleEventForm('qualquer coisa'), null));

test('datas, horas e idade', () => {
  assert.equal(toIsoDate('31 / 02 / 2026'), '');
  assert.equal(toIsoDate('05 / 3 / 2026'), '2026-03-05');
  assert.equal(toTime('9 : 05'), '09:05');
  assert.equal(toTime('25:00'), '');
  assert.equal(ageOn('2019-12-19', '2026-12-19'), '7');
  assert.equal(ageOn('2019-12-19', '2026-12-18'), '6');
  assert.equal(ageOn('', '2026-12-18'), '');
});

test('conteúdo dos pedidos de vídeo: sem valor e com "Nome do aniversariante"', () => {
  const event = { eventDate: '2026-12-19', eventTime: '18:45', location: 'Rua A' };
  const { value } = buildVideoContents({ birthday: true, birthdayName: 'Davi', invite: true, inviteName: 'Davi Luca', inviteAge: '7', inviteTime: '', inviteDetails: '' }, event);
  assert.match(value.birthday, /Nome do aniversariante: Davi\n/);
  assert.match(value.invite, /Idade: 7 anos\nData: 19\/12\/2026\nHorário: 18:45\nLocal: Rua A/);
  assert.match(value.invite, /não é cobrado à parte/);
  assert.match(buildVideoContents({ birthday: true, birthdayName: ' ', invite: false }, event).error, /primeiro nome/);
  assert.deepEqual(buildVideoContents({ birthday: false, invite: false }, event), { value: {} });
});

test('acha o serviço pelo título sem diferenciar acento/caixa', () => {
  const services = [{ id: 'a', title: 'VIDEO convite' }, { id: 'b', title: 'Vídeo Especial de Aniversário' }];
  assert.equal(findVideoService(services, 'invite').id, 'a');
  assert.equal(findVideoService(services, 'birthday').id, 'b');
  assert.equal(findVideoService([], 'invite'), undefined);
});
