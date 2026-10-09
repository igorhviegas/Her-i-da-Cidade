import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultEntry, eventContentSummary, isValidDateInput, isValidTimeInput, validateEventForm } from './eventForm.js';

const valid = {
  childName: ' Pedro ', eventDate: '2026-10-10', eventTime: '14:00', location: 'Rua A, 10', imageAuthorization: 'yes', extraWeb: '1',
  totalValue: '1000', entryValue: '500', cost: '150', observations: '', formType: 'Aniversário',
};

test('entrada padrão = 50% do total, em centavos', () => {
  assert.equal(defaultEntry(1000), 500);
  assert.equal(defaultEntry(333.33), 166.67);
  assert.equal(defaultEntry(NaN), 0);
});

test('datas e horários: só valores reais do calendário/relógio', () => {
  assert.ok(isValidDateInput('2026-02-28'));
  assert.ok(!isValidDateInput('2026-02-31'));
  assert.ok(!isValidDateInput('10/10/2026'));
  assert.ok(isValidTimeInput('00:00') && isValidTimeInput('23:59'));
  assert.ok(!isValidTimeInput('24:00') && !isValidTimeInput('9:30') && !isValidTimeInput(''));
});

test('formulário válido vira valores tipados e normalizados', () => {
  const { value, error } = validateEventForm(valid);
  assert.equal(error, undefined);
  assert.deepEqual(value, {
    childName: 'Pedro', eventDate: '2026-10-10', eventTime: '14:00', location: 'Rua A, 10', imageAuthorization: true, extraWeb: 1,
    totalValue: 1000, entryValue: 500, cost: 150, observations: '', formType: 'Aniversário', birthDate: '', pcd: null,
  });
});

test('data de nascimento e PCD são opcionais; data inválida é recusada', () => {
  const ok = validateEventForm({ ...valid, birthDate: '2019-12-19', pcd: 'yes' }).value;
  assert.equal(ok.birthDate, '2019-12-19');
  assert.equal(ok.pcd, true);
  assert.equal(validateEventForm({ ...valid, pcd: 'no' }).value.pcd, false);
  assert.match(validateEventForm({ ...valid, birthDate: '2019-02-31' }).error, /nascimento/i);
});

test('campos obrigatórios e valores inválidos são recusados com mensagem', () => {
  const bad = (patch) => validateEventForm({ ...valid, ...patch }).error;
  assert.match(bad({ childName: ' ' }), /nome da criança/i);
  assert.match(bad({ eventDate: '' }), /data/i);
  assert.match(bad({ eventTime: '25:00' }), /horário/i);
  assert.match(bad({ location: '' }), /local/i);
  assert.match(bad({ imageAuthorization: '' }), /imagem/i);
  assert.match(bad({ extraWeb: '3' }), /teia/i);
  assert.match(bad({ totalValue: '' }), /total/i);
  assert.match(bad({ totalValue: '-5' }), /total/i);
  assert.match(bad({ entryValue: 'abc' }), /entrada/i);
  assert.match(bad({ entryValue: '1200' }), /maior que o valor total/i);
  assert.match(bad({ cost: 'abc' }), /custo/i);
  assert.match(bad({ cost: '-1' }), /custo/i);
  assert.match(bad({ formType: ' ' }), /#formulário/i);
  assert.equal(validateEventForm({ ...valid, cost: '' }).value.cost, null); // custo é opcional até a conclusão
  assert.equal(validateEventForm({ ...valid, cost: '0' }).value.cost, 0);
  assert.equal(validateEventForm({ ...valid, cost: '0', entryValue: '0', observations: 'x' }).error, undefined); // zero é válido
});

test('vírgula decimal é aceita; "content" traz o aniversariante para a busca existente', () => {
  const { value } = validateEventForm({ ...valid, totalValue: '1.000,50'.replace('.', ''), entryValue: '500,25' });
  assert.equal(value.totalValue, 1000.5);
  assert.equal(value.entryValue, 500.25);
  assert.match(eventContentSummary(value), /Nome do aniversariante: Pedro/);
});
