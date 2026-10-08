import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTemplateSteps, calendarEntries, campaignProgress, campaignSpan, campaignsOnDay, describeOffset, missionIdFor, resolveSteps,
  stepDate, taskDueChanges, taskFromStep, templateFor, validateCampaign, validatePlan, DEFAULT_TEMPLATES, offsetFrom, splitOffset, daysUntil,
} from './instagramPlanning.js';

const step = (id, title, offset, status = 'pending', extra = {}) => ({ id, title, offset, status, notes: '', ...extra });
const campaign = (over = {}) => ({
  id: 'c1', title: 'Lançamento da plataforma', category: 'new_service', launchDate: '2026-10-20', status: 'active', notes: '',
  steps: [step('a', 'Criar roteiro', -7), step('b', 'Gravar', -5), step('c', 'Publicar', 0)], ...over,
});

test('datas relativas ao lançamento: antes, no dia e depois; recálculo ao mudar o lançamento', () => {
  assert.equal(stepDate('2026-10-20', -7), '2026-10-13');
  assert.equal(stepDate('2026-10-20', 0), '2026-10-20');
  assert.equal(stepDate('2026-10-20', 3), '2026-10-23');
  assert.equal(stepDate('2026-03-02', -14), '2026-02-16'); // cruza o mês
  assert.equal(stepDate('2026-01-05', -10), '2025-12-26'); // cruza o ano
  assert.equal(stepDate('lixo', -1), null);
  assert.equal(stepDate('2026-10-20', 1.5), null);
  const before = resolveSteps(campaign()).map((s) => s.date);
  assert.deepEqual(before, ['2026-10-13', '2026-10-15', '2026-10-20']);
  const moved = resolveSteps(campaign({ launchDate: '2026-11-02' })).map((s) => s.date); // lançamento adiado: nada fica gravado, tudo recalcula
  assert.deepEqual(moved, ['2026-10-26', '2026-10-28', '2026-11-02']);
});

test('textos do prazo', () => {
  assert.equal(describeOffset(-7), '7 dias antes do lançamento');
  assert.equal(describeOffset(-1), '1 dia antes do lançamento');
  assert.equal(describeOffset(0), 'No dia do lançamento');
  assert.equal(describeOffset(2), '2 dias depois do lançamento');
});

test('período, progresso e etapas posteriores ao lançamento', () => {
  assert.deepEqual(campaignSpan(campaign()), { start: '2026-10-13', end: '2026-10-20' });
  const withAfter = campaign({ steps: [step('a', 'Roteiro', -7), step('d', 'Relatório', 5)] });
  assert.deepEqual(campaignSpan(withAfter), { start: '2026-10-13', end: '2026-10-25' }); // vai até a última etapa
  assert.deepEqual(campaignSpan(campaign({ steps: [] })), { start: '2026-10-20', end: '2026-10-20' });
  const progress = campaignProgress(campaign({ steps: [step('a', 'x', -7, 'done'), step('b', 'y', -5, 'doing'), step('c', 'z', 0)] }));
  assert.deepEqual([progress.done, progress.total, progress.next.id], [1, 3, 'b']);
});

test('validação de campanha: título, categoria, lançamento, etapas, prazos e duplicidades', () => {
  assert.deepEqual(validateCampaign(campaign()), []);
  assert.match(validateCampaign(campaign({ title: '  ' })).join('|'), /título/);
  assert.match(validateCampaign(campaign({ launchDate: '' })).join('|'), /lançamento/);
  assert.match(validateCampaign(campaign({ launchDate: '2026-02-30' })).join('|'), /lançamento/); // data impossível
  assert.match(validateCampaign(campaign({ category: '' })).join('|'), /categoria/);
  assert.match(validateCampaign(campaign({ status: 'xyz' })).join('|'), /Status da campanha/);
  assert.match(validateCampaign(campaign({ steps: [step('a', '  ', -1)] })).join('|'), /sem nome/);
  assert.match(validateCampaign(campaign({ steps: [step('a', 'x', 1.5)] })).join('|'), /Prazo inválido/);
  assert.match(validateCampaign(campaign({ steps: [step('a', 'x', 999)] })).join('|'), /Prazo inválido/);
  assert.match(validateCampaign(campaign({ steps: [step('a', 'x', 0, 'zzz')] })).join('|'), /Status inválido/);
  // duplicada = mesmo nome (sem diferenciar caixa/espaços) e mesmo prazo; mesmo nome com prazo diferente é permitido
  assert.match(validateCampaign(campaign({ steps: [step('a', 'Gravar', -5), step('b', ' gravar ', -5)] })).join('|'), /duplicada/);
  assert.deepEqual(validateCampaign(campaign({ steps: [step('a', 'Gravar', -5), step('b', 'Gravar', -4)] })), []);
});

test('validação do planejamento avulso: data, título, formato e limites', () => {
  const ok = { date: '2026-10-12', title: 'Dia das crianças', format: 'reels', notes: '' };
  assert.deepEqual(validatePlan(ok), []);
  assert.match(validatePlan({ ...ok, title: ' ' }).join('|'), /título/);
  assert.match(validatePlan({ ...ok, format: 'tv' }).join('|'), /formato/);
  assert.match(validatePlan({ ...ok, date: '12/10' }).join('|'), /Data/);
  assert.match(validatePlan({ ...ok, title: 'x'.repeat(121) }).join('|'), /120/);
  assert.match(validatePlan({ ...ok, notes: 'x'.repeat(501) }).join('|'), /500/);
});

test('etapas padrão: modelo por categoria, modelo personalizado prevalece e editar na campanha não altera o modelo', () => {
  assert.deepEqual(DEFAULT_TEMPLATES.new_service.map(([title, offset]) => `${title}:${offset}`), ['Definir estratégia:-14', 'Criar roteiro:-7', 'Gravar:-5', 'Criar thumbnail:-3', 'Editar:-2', 'Publicar:0']);
  let n = 0;
  const steps = buildTemplateSteps(templateFor('new_service'), () => `id${n++}`);
  assert.equal(steps.length, 6);
  assert.deepEqual(steps.map((s) => s.id), ['id0', 'id1', 'id2', 'id3', 'id4', 'id5']);
  assert.ok(steps.every((s) => s.status === 'pending'));
  steps[1].offset = -10; // ajuste só na campanha
  assert.equal(DEFAULT_TEMPLATES.new_service[1][1], -7);
  assert.equal(templateFor('categoria-inventada')[0][0], 'Planejar'); // categoria desconhecida cai no modelo "Outro"
  const custom = { new_service: [{ title: 'Só publicar', offset: 0 }] };
  assert.deepEqual(templateFor('new_service', custom), [['Só publicar', 0]]);
  assert.deepEqual(templateFor('new_service', { new_service: [{ title: 5 }] }), DEFAULT_TEMPLATES.new_service); // modelo corrompido é ignorado
  assert.deepEqual(templateFor('new_service', { new_service: [] }), DEFAULT_TEMPLATES.new_service);
});

test('calendário: etapas e planejamentos por dia, lançamento destacado, período e arquivadas ignoradas', () => {
  const plans = [{ id: 'p1', date: '2026-10-15', title: 'Vídeo convite', format: 'story' }, { id: 'p2', date: '2026-10-15', title: 'Alimentação', format: 'reels' }];
  const archived = campaign({ id: 'c2', status: 'archived' });
  const { byDay, spans } = calendarEntries({ plans, campaigns: [campaign(), archived] });
  assert.equal(byDay.get('2026-10-15').plans.length, 2);
  assert.deepEqual(byDay.get('2026-10-15').steps.map((s) => s.title), ['Gravar']);
  assert.equal(byDay.get('2026-10-13').steps[0].title, 'Criar roteiro');
  const launch = byDay.get('2026-10-20').steps[0];
  assert.deepEqual([launch.title, launch.launch], ['Publicar', true]);
  assert.equal(spans.length, 1); // a arquivada não aparece
  assert.deepEqual(campaignsOnDay(spans, '2026-10-17'), ['c1']);
  assert.deepEqual(campaignsOnDay(spans, '2026-10-12'), []);
  assert.deepEqual(campaignsOnDay(spans, '2026-10-21'), []);
  // sem etapa no dia do lançamento: o lançamento é mostrado mesmo assim
  const noLaunchStep = calendarEntries({ plans: [], campaigns: [campaign({ steps: [step('a', 'Roteiro', -7)] })] });
  assert.equal(noLaunchStep.byDay.get('2026-10-20').steps[0].title, 'Lançamento');
  // lançamento alterado: o calendário acompanha (fonte única de verdade)
  assert.equal(calendarEntries({ plans: [], campaigns: [campaign({ launchDate: '2026-11-02' })] }).byDay.has('2026-10-13'), false);
});

test('To-do: tarefa da etapa (título, dificuldade 2, prazo = data calculada), id determinístico e prazos que acompanham o lançamento', () => {
  const c = campaign();
  const task = taskFromStep(c, step('a', 'Criar roteiro', -7, 'pending', { notes: 'usar o briefing' }));
  assert.equal(task.title, 'Criar roteiro');
  assert.equal(task.difficulty, 2);
  assert.equal(task.dueAt.toISOString(), '2026-10-13T21:00:00.000Z'); // 18:00 em Brasília
  assert.match(task.description, /Lançamento da plataforma/);
  assert.match(task.description, /7 dias antes do lançamento \(13\/10\/2026\)/);
  assert.match(task.description, /usar o briefing/);
  assert.equal(missionIdFor('c1', 'a'), missionIdFor('c1', 'a')); // converter duas vezes cai no mesmo documento
  assert.notEqual(missionIdFor('c1', 'a'), missionIdFor('c1', 'b'));
  assert.throws(() => taskFromStep({ title: 'x', launchDate: 'lixo' }, step('a', 'x', 0)), /data válida/);
  // lançamento adiado: só as etapas COM tarefa geram atualização de prazo
  const before = campaign({ steps: [step('a', 'Roteiro', -7, 'pending', { missionId: 'm1' }), step('b', 'Gravar', -5)] });
  const after = { ...before, launchDate: '2026-10-27' };
  const changes = taskDueChanges(before, after);
  assert.deepEqual(changes.map((x) => [x.missionId, x.dueAt.toISOString()]), [['m1', '2026-10-20T21:00:00.000Z']]);
  assert.deepEqual(taskDueChanges(before, { ...before }), []); // nada mudou, nada a atualizar
  const retimed = { ...before, steps: [{ ...before.steps[0], offset: -3 }, before.steps[1]] };
  assert.equal(taskDueChanges(before, retimed)[0].dueAt.toISOString(), '2026-10-17T21:00:00.000Z');
});

test('conversões do formulário: direção + dias <-> prazo; contagem de dias', () => {
  assert.equal(offsetFrom('before', '7'), -7);
  assert.equal(offsetFrom('after', '3'), 3);
  assert.equal(offsetFrom('on', ''), 0);
  assert.ok(Number.isNaN(offsetFrom('before', '')));
  assert.ok(Number.isNaN(offsetFrom('before', '7.5')));
  assert.ok(Number.isNaN(offsetFrom('after', '-2')));
  assert.deepEqual(splitOffset(-7), { direction: 'before', days: '7' });
  assert.deepEqual(splitOffset(0), { direction: 'on', days: '0' });
  assert.deepEqual(splitOffset(4), { direction: 'after', days: '4' });
  assert.equal(daysUntil('2026-10-08', '2026-10-20'), 12);
  assert.equal(daysUntil('2026-10-20', '2026-10-08'), -12);
  assert.equal(daysUntil('2026-10-08', 'lixo'), null);
  // NaN vindo de um prazo mal digitado é barrado pela validação (nunca chega ao banco)
  assert.match(validateCampaign(campaign({ steps: [step('a', 'x', offsetFrom('before', ''))] })).join('|'), /Prazo inválido/);
});
