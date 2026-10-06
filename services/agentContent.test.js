import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTimer, formatClock, dueAlert, markFired, resetFired, moveItem, sortByOrder,
  DEFAULT_AGENT_STEPS, EVENT_DURATION_MS,
} from './agentContent.js';

const MIN = 60_000;

test('timer: 1 h contratada, ajuste soma/subtrai, termina em zero', () => {
  const t0 = 1_000_000;
  assert.equal(computeTimer({ startedAt: t0 }, t0).remainingMs, EVENT_DURATION_MS);
  assert.equal(computeTimer({ startedAt: t0, adjustMs: 10 * MIN }, t0 + 20 * MIN).remainingMs, 50 * MIN);
  assert.equal(computeTimer({ startedAt: t0, adjustMs: -5 * MIN }, t0 + 20 * MIN).elapsedMs, 20 * MIN);
  assert.equal(computeTimer({ startedAt: t0 }, t0 + 60 * MIN).finished, true);
  assert.equal(computeTimer({ startedAt: t0 }, t0 + 59 * MIN).finished, false);
});

test('formatClock: mm:ss, h:mm:ss e valor absoluto', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(61_000), '01:01');
  assert.equal(formatClock(60 * MIN), '1:00:00');
  assert.equal(formatClock(-90_000), '01:30');
});

test('alertas: 30 min e 5 min disparam uma vez; 5 min tem prioridade e encerra o de 30', () => {
  assert.equal(dueAlert(31 * MIN, {}), null);
  assert.equal(dueAlert(30 * MIN, {}), 'm30');
  assert.equal(dueAlert(30 * MIN, { m30: true }), null);
  assert.equal(dueAlert(5 * MIN, { m30: true }), 'm5');
  assert.equal(dueAlert(3 * MIN, {}), 'm5'); // app voltou do segundo plano já nos 5 min finais
  assert.deepEqual(markFired({}, 'm5'), { m30: true, m5: true });
  assert.deepEqual(markFired({}, 'm30'), { m30: true });
  assert.equal(dueAlert(2 * MIN, markFired({}, 'm5')), null);
});

test('alertas: adicionar tempo rearma só os limiares que voltaram ao futuro', () => {
  assert.deepEqual(resetFired(40 * MIN, { m30: true, m5: true }), { m30: false, m5: false });
  assert.deepEqual(resetFired(20 * MIN, { m30: true, m5: true }), { m30: true, m5: false });
  assert.deepEqual(resetFired(4 * MIN, { m30: true, m5: true }), { m30: true, m5: true });
});

test('moveItem e sortByOrder', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
  assert.deepEqual(sortByOrder([{ order: 2, n: 'x' }, { order: 0, n: 'y' }]).map((x) => x.n), ['y', 'x']);
});

test('roteiro padrão: ordem operacional, alerta de voltagem na instalação, ids únicos', () => {
  const ids = DEFAULT_AGENT_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(DEFAULT_AGENT_STEPS.map((s) => s.order), ids.map((_, i) => i));
  const install = DEFAULT_AGENT_STEPS.find((s) => s.id === 'instalacao');
  assert.match(install.alert, /voltagem/i);
  assert.ok(ids.indexOf('chegada') < ids.indexOf('instalacao'));
  assert.ok(ids.indexOf('dez-minutos') < ids.indexOf('parabens'));
  for (const s of DEFAULT_AGENT_STEPS) {
    const itemIds = s.items.map((i) => i.id);
    assert.equal(new Set(itemIds).size, itemIds.length);
  }
  // progresso salvo depende de IDs estáveis entre cargas do módulo
  assert.equal(install.items[0].id, 'instalacao-1');
});

test('suporte: link do WhatsApp do Vitor com a mensagem urgente e FAQ padrão com IDs estáveis', async () => {
  const { SUPPORT_WHATSAPP_URL, DEFAULT_AGENT_FAQ } = await import('./agentContent.js');
  const url = new URL(SUPPORT_WHATSAPP_URL);
  assert.equal(url.pathname, '/5531995152224');
  assert.equal(url.searchParams.get('text'), 'Olá Vitor, preciso de um suporte urgente!');
  assert.equal(DEFAULT_AGENT_FAQ[0].title, 'Caixa de som');
  assert.equal(DEFAULT_AGENT_FAQ[0].items[0].id, 'caixa-de-som-1');
});

test('busca: ignora acento/maiúscula, exige todas as palavras e olha pergunta e resposta de todo o FAQ', async () => {
  const { matchesQuery, searchFaq } = await import('./agentContent.js');
  assert.equal(matchesQuery('', 'qualquer'), true);
  assert.equal(matchesQuery('VOLTAGEM tomada', 'Confira a voltagém da tomada'), true);
  assert.equal(matchesQuery('voltagem caixa', 'Confira a tomada'), false);
  assert.equal(matchesQuery('tomada confira', 'Confira a voltagem da tomada'), true); // ordem livre
  const faq = [
    { id: 'a', title: 'Caixa de som', items: [{ id: 'a1', question: 'A caixa não liga', answer: 'Troque a tomada.' }, { id: 'a2', question: 'Sem som', answer: 'Aumente o volume do microfone.' }] },
    { id: 'b', title: 'Microfone', items: [{ id: 'b1', question: 'Chiado', answer: 'Afaste o MICROFONE da caixa.' }] },
  ];
  assert.deepEqual(searchFaq(faq, 'microfone').map((r) => r.item.id), ['a2', 'b1']); // acha na resposta, em duas categorias
  assert.deepEqual(searchFaq(faq, 'nao liga').map((r) => r.item.id), ['a1']); // acha na pergunta, sem acento
  assert.deepEqual(searchFaq(faq, 'xyz'), []);
});

test('parents: agrupa efeitos sob a música principal, sem perder faixas órfãs ou aninhadas', async () => {
  const { groupTracks } = await import('./agentContent.js');
  const t = (id, parentId) => ({ id, parentId, title: id });
  const groups = groupTracks([t('a'), t('estatua'), t('e1', 'estatua'), t('b'), t('e2', 'estatua'), t('orf', 'sumiu'), t('neto', 'e1'), t('eu', 'eu')]);
  assert.deepEqual(groups.map((g) => g.track.id), ['a', 'estatua', 'b', 'orf', 'neto', 'eu']); // órfã, neto e auto-parent viram principais
  assert.deepEqual(groups.find((g) => g.track.id === 'estatua').children.map((c) => c.id), ['e1', 'e2']); // ordem preservada
  assert.deepEqual(groupTracks([]), []);
});
