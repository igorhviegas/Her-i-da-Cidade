import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previousWeek, periodLabel, editionTitle, eventCandidates, revokedSources, viewGains, followersSummary, compactNumber,
  pickAdFormat, serviceFormats, fitLines, newPage, pageHash, pageStatus, pageIssues, pageFileName, AD_SLOTS, consentIssues,
} from './clarim.js';

const at = (key, hour = 15) => new Date(`${key}T${String(hour).padStart(2, '0')}:00:00-03:00`);
const week = { start: '2026-10-12', end: '2026-10-18' };

test('previousWeek: segunda a domingo anteriores, em qualquer dia da semana', () => {
  assert.deepEqual(previousWeek('2026-10-19'), week); // segunda
  assert.deepEqual(previousWeek('2026-10-25'), week); // domingo
  assert.deepEqual(previousWeek('2026-10-21'), week); // quarta
  assert.deepEqual(previousWeek('2026-11-02'), { start: '2026-10-26', end: '2026-11-01' });
});

test('periodLabel e editionTitle, inclusive virando o mês', () => {
  assert.equal(periodLabel(week), '12 a 18 de outubro');
  assert.equal(periodLabel({ start: '2026-09-28', end: '2026-10-04' }), '28 de setembro a 4 de outubro');
  assert.equal(editionTitle(week), 'Clarim Semanal — 12 a 18 de outubro');
});

test('eventCandidates: só festas do período; elegível exige formulário, pagamento e autorização', () => {
  const ev = (id, key, extra = {}) => ({ id, serviceId: '6', eventDate: at(key), eventForm: { imageAuthorization: true }, childName: 'Nome', ...extra });
  const orders = [
    ev('ok', '2026-10-15'),
    ev('sem-aut', '2026-10-17', { eventForm: { imageAuthorization: false } }),
    ev('rascunho', '2026-10-16', { eventDraft: true }),
    ev('pendente', '2026-10-14', { paymentPending: true }),
    ev('fora', '2026-10-19'),
    { id: 'chamada', serviceId: '2', eventDate: at('2026-10-15') },
  ];
  const list = eventCandidates(orders, week);
  assert.deepEqual(list.map((c) => [c.orderId, c.eligible]), [['pendente', false], ['ok', true], ['rascunho', false], ['sem-aut', false]]);
  assert.equal(list.find((c) => c.orderId === 'sem-aut').reason, 'Sem autorização de imagem');
  assert.equal(list.find((c) => c.orderId === 'ok').weekday, 'Quinta');
  assert.ok(list.every((c) => !('childName' in c)), 'nenhum dado pessoal no resultado');
  // festa no domingo às 22h de Brasília ainda é do período (UTC já é segunda)
  assert.equal(eventCandidates([ev('noite', '2026-10-18', { eventDate: at('2026-10-18', 22) })], week)[0].day, '2026-10-18');
});

test('revokedSources: autorização retirada depois da escolha bloqueia a aprovação', () => {
  const orders = [{ id: 'a', serviceId: '6', eventDate: at('2026-10-15'), eventForm: { imageAuthorization: false } }];
  assert.deepEqual(revokedSources(['a'], orders, week), ['a']);
  assert.deepEqual(revokedSources(['sumiu'], [], week), ['sumiu']);
});

test('viewGains: ganho na semana por retratos diários; novo começa em 0; sem base fica de fora', () => {
  const posts = [
    { id: 'antigo', kind: 'reel', publishedAt: '2026-10-01T12:00:00Z', views: 9000 },
    { id: 'novo', kind: 'reel', publishedAt: '2026-10-14T12:00:00Z', views: 5000 },
    { id: 'sem-base', kind: 'reel', publishedAt: '2026-09-01T12:00:00Z', views: 7000 },
    { id: 'foto', kind: 'image', publishedAt: '2026-10-14T12:00:00Z', views: null },
    { id: 'depois', kind: 'reel', publishedAt: '2026-10-20T12:00:00Z', views: 100 },
  ];
  const stats = [
    { day: '2026-10-12', posts: { antigo: [0, 0, 1000] } },
    { day: '2026-10-19', posts: { antigo: [0, 0, 4000], novo: [0, 0, 3000] } },
  ];
  const gains = viewGains(posts, stats, week, '2026-10-20');
  assert.deepEqual(gains.map((g) => [g.post.id, g.gain]), [['antigo', 3000], ['novo', 3000]]);
  // período em andamento: fim = valor atual
  const live = viewGains(posts, stats, week, '2026-10-16');
  assert.equal(live.find((g) => g.post.id === 'antigo').gain, 8000);
  // base no meio da semana = parcial
  const partial = viewGains(posts, [{ day: '2026-10-14', posts: { antigo: [0, 0, 2000] } }], week, '2026-10-16');
  assert.equal(partial[0].partial, true);
});

test('followersSummary: ganho só com retrato no período', () => {
  const stats = [{ day: '2026-10-12', followers: 8000 }, { day: '2026-10-19', followers: 8132 }];
  assert.deepEqual(followersSummary({ followers: 8214 }, stats, week, '2026-10-20'), { followers: 8214, gain: 132, partial: false });
  assert.equal(followersSummary({ followers: 8214 }, [], week, '2026-10-20').gain, null);
});

test('compactNumber', () => {
  assert.equal(compactNumber(950), '950');
  assert.equal(compactNumber(12400), '12,4 mil');
  assert.equal(compactNumber(7900), '7,9 mil');
  assert.equal(compactNumber(8214), '8,2 mil');
  assert.equal(compactNumber(1250000), '1,3 mi');
  assert.equal(compactNumber(null), '—');
});

test('pickAdFormat: proporção mais próxima, escolha manual quando possível, null sem arte compatível', () => {
  assert.equal(pickAdFormat(AD_SLOTS.cover, ['square', 'wide']), 'wide');
  assert.equal(pickAdFormat(AD_SLOTS.cover, ['square']), 'square');
  assert.equal(pickAdFormat(AD_SLOTS.events, ['square', 'wide']), 'square');
  assert.equal(pickAdFormat(AD_SLOTS.events, ['square', 'wide'], 'wide'), 'wide');
  assert.equal(pickAdFormat(AD_SLOTS.cover, ['story']), null);
  assert.deepEqual(serviceFormats({ art: { backgrounds: { square: '/a.jpg', wide: '' } } }), ['square']);
});

test('fitLines: reduz o tamanho até caber; null quando nem o mínimo cabe', () => {
  const measure = (t, size) => t.length * size * 0.5;
  assert.deepEqual(fitLines('abc def', { maxWidth: 100, maxLines: 1, maxSize: 40, minSize: 10 }, measure), { size: 28, lines: ['abc def'] });
  assert.deepEqual(fitLines('abc def', { maxWidth: 70, maxLines: 2, maxSize: 40, minSize: 10 }, measure), { size: 40, lines: ['abc', 'def'] });
  assert.equal(fitLines('palavraenorme', { maxWidth: 10, maxLines: 3, maxSize: 40, minSize: 30 }, measure), null);
});

test('aprovação: editar depois de aprovar volta para revisão', () => {
  const page = { ...newPage('news', 0), fields: { ...newPage('news', 0).fields, variant: 'notice', headline: 'Agenda aberta' } };
  assert.equal(pageStatus(page, pageIssues(page)), 'review');
  const approved = { ...page, approval: { by: 'u', at: null, hash: pageHash(page) } };
  assert.equal(pageStatus(approved, []), 'approved');
  const edited = { ...approved, fields: { ...approved.fields, headline: 'Agenda de dezembro aberta' } };
  assert.equal(pageStatus(edited, pageIssues(edited)), 'review');
  // pendência que surge depois (autorização retirada) derruba a aprovação
  assert.equal(pageStatus(approved, ['x']), 'pending');
});

test('consentIssues: página aprovada perde a validade quando a autorização é retirada', () => {
  const page = { ...newPage('events', 0), sources: ['a'] };
  const ok = [{ id: 'a', serviceId: '6', eventDate: at('2026-10-15'), eventForm: { imageAuthorization: true } }];
  assert.deepEqual(consentIssues(page, ok, week), []);
  assert.equal(consentIssues(page, [{ ...ok[0], eventForm: { imageAuthorization: false } }], week).length, 1);
  assert.deepEqual(consentIssues(newPage('news', 0), [], week), []);
});

test('pageIssues por template', () => {
  assert.deepEqual(pageIssues(newPage('performance', 0)), []);
  assert.ok(pageIssues(newPage('cover', 0)).includes('Preencha: manchete.'));
  const events = { ...newPage('events', 0), fields: { headline: 'x' }, sources: ['a'] };
  assert.deepEqual(pageIssues(events), ['Envie a foto de cada festa escolhida.']);
  assert.deepEqual(pageIssues({ ...newPage('classifieds', 0), services: ['1', '2', '3'] }), ['Escolha de 4 a 6 serviços.']);
});

test('pageFileName', () => {
  assert.equal(pageFileName(7, 3, 'events'), 'clarim-007-p3-eventos.png');
});
