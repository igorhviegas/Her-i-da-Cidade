import test from 'node:test';
import assert from 'node:assert/strict';
import { inviteLines, parseInviteFields } from './inviteArt.js';

// Textos reais de pedidos (enviados pelo dono), como ficam em order.content.
test('adicional de evento: linhas com rótulo; endereço sem UF e sem CEP', () => {
  const content = [
    'Vídeo Convite',
    'Nome do aniversariante: Zack Lucca',
    'Idade: 7 anos',
    'Data: 19/12/2026',
    'Horário: 17:00',
    'Local: R. Belarminio Francisco Pereira, 117 - Pedra Branca (Justinópolis), Ribeirão das Neves - MG, 33925-490',
    'Detalhes para o vídeo: Vir fantasiado ou fantasiada com a sua roupa do homem aranha, e não esqueça de confirmar sua presença que será primordial para a organização da festa.',
    'Valor incluso no orçamento do evento presencial (este pedido não é cobrado à parte).',
  ].join('\n');
  assert.deepEqual(parseInviteFields({ content }), {
    name: 'Zack Lucca', age: '7', date: '19 de dezembro', time: '17:00',
    place: 'R. Belarminio Francisco Pereira, 117 - Pedra Branca (Justinópolis), Ribeirão das Neves',
  });
});

test('ManyChat em texto livre: nome na 1ª linha, local na linha depois do horário', () => {
  const content = [
    'Detalhes: Matteo', '3 anos', 'Emilayne/Eduardo ', 'Meu nome é difícil de pronunciar se quiser gravo um vídeo ', '15/11', 'As 16h. ',
    'Canto do forte', 'É uma festa intimista gostaríamos que soubesse que todos que receberem o convite são muito especiais.',
  ].join('\n');
  assert.deepEqual(parseInviteFields({ content }), { name: 'Matteo', age: '3', date: '15 de novembro', time: '16:00', place: 'Canto do forte' });
});

test('"Será na minha casa" vira "Na casa do <aniversariante>"', () => {
  const content = ['Detalhes: Yuri', '5 anos', 'Mãe Sabrina e Pai Cleiton ', '14/11', 'A partir das 15:30', 'Será na minha casa'].join('\n');
  assert.deepEqual(parseInviteFields({ content }), { name: 'Yuri', age: '5', date: '14 de novembro', time: '15:30', place: 'Na casa do Yuri' });
});

test('nome do campo Aniversariante tem prioridade; "no Espaço" perde o "no"', () => {
  const order = { childName: 'Bryan e Davi', content: 'Aniversariante: Bryan e Davi\nDetalhes: 3 anos\n19/12\n14h\nNo Espaço da Déia' };
  assert.deepEqual(parseInviteFields(order), { name: 'Bryan e Davi', age: '3', date: '19 de dezembro', time: '14:00', place: 'Espaço da Déia' });
});

test('data por extenso e "15h30"', () => {
  const fields = parseInviteFields({ content: 'Detalhes: festa dia 7 de março às 15h30 no salão do prédio' });
  assert.equal(fields.date, '7 de março');
  assert.equal(fields.time, '15:30');
});

test('sem data no texto usa a data do evento (fuso de Brasília); o que falta volta vazio', () => {
  const fields = parseInviteFields({ content: 'Aniversariante: Ana' }, new Date('2026-03-07T15:00:00Z'));
  assert.deepEqual(fields, { name: 'Ana', age: '', date: '7 de março', time: '', place: '' });
});

test('telefone não vira data e "15 homens" não vira horário', () => {
  const fields = parseInviteFields({ content: 'Detalhes: me chama no 31 99904-4206, vão 15 homens' });
  assert.equal(fields.date, '');
  assert.equal(fields.time, '');
});

test('linhas da arte: maiúsculas e idade com ANO/ANOS', () => {
  assert.deepEqual(inviteLines({ name: 'Yuri', age: '5', date: '14 de novembro', time: '15:30', place: 'Na casa do Yuri' }),
    { name: 'YURI', age: '5 ANOS', date: '14 DE NOVEMBRO', time: '15:30', place: 'NA CASA DO YURI' });
  assert.equal(inviteLines({ name: '', age: '1', date: '', time: '', place: '' }).age, '1 ANO');
  assert.equal(inviteLines({ name: '', age: '3 e 5 anos', date: '', time: '', place: '' }).age, '3 E 5 ANOS');
});
