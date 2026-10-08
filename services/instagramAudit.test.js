import test from 'node:test';
import assert from 'node:assert/strict';
import { auditPosts, lintCaption } from './instagramAudit.js';

const post = (id, views, over = {}) => ({ id, caption: '', kind: 'reel', publishedAt: null, likes: 1, comments: 0, views, ...over });
const status = (lint, label) => lint.checks.find((c) => c.label === label).status;

test('lintCaption: janela visível, hashtags acima do limite e veredito', () => {
  const long = `${'a'.repeat(130)} #um #dois #tres #quatro #cinco #seis`;
  const lint = lintCaption(long);
  assert.equal(lint.visible.length, 125);
  assert.equal(lint.truncated, true);
  assert.equal(lint.tags.length, 6);
  assert.equal(status(lint, 'Hashtags'), 'FAIL');
  assert.equal(lint.verdict, 'FIX');
  assert.equal(status(lint, 'Primeira linha'), 'WARN'); // 1ª linha passa de 125
});

test('lintCaption: legenda boa fica READY; pedidos e links são detectados', () => {
  const ok = lintCaption(`Perdi R$ 18 mil por um contrato.\n\nComente EU para receber o modelo.\n\n${'Detalhes do contrato. '.repeat(6)}\n\n#contratos #freelas`);
  assert.deepEqual(ok.asks, ['comentar']);
  assert.equal(ok.verdict, 'READY');
  assert.equal(status(lintCaption('Veja em https://x.com e salve, compartilhe'), 'Links'), 'WARN');
  assert.equal(status(lintCaption('Texto salve e compartilhe'), 'Um pedido só'), 'WARN'); // dois pedidos
  assert.equal(status(lintCaption('#viral olha'), 'Primeira linha'), 'FAIL');
  assert.equal(status(lintCaption('Olá #viral'), 'Hashtags'), 'WARN');
  assert.equal(status(lintCaption('#a ' + 'x'.repeat(130)), 'Posição das hashtags'), 'WARN');
  assert.equal(lintCaption(undefined).chars, 0); // legenda ausente não lança
});

test('auditPosts: poucas publicações não afirmam padrão', () => {
  const audit = auditPosts(Array.from({ length: 9 }, (_, i) => post(String(i), 100)));
  assert.equal(audit.enough, false);
  assert.deepEqual(audit.top, []);
});

test('auditPosts: múltiplo sobre a mediana, top/bottom e grupos; sem visualizações cai para curtidas', () => {
  const views = [10, 20, 30, 40, 50, 60, 70, 80, 90, 1000];
  const posts = views.map((v, i) => post(String(i), v, { kind: i < 5 ? 'image' : 'reel', caption: i % 2 ? 'Comente já' : 'oi' }));
  posts.push(post('x', null)); // sem a métrica: fica de fora
  const audit = auditPosts(posts);
  assert.equal(audit.metric, 'views');
  assert.equal(audit.n, 10);
  assert.equal(audit.median, 55);
  assert.equal(audit.top[0].post.id, '9');
  assert.equal(audit.top[0].multiple, 1000 / 55);
  assert.equal(audit.bottom[0].post.id, '0');
  const reel = audit.groups.kind.find((g) => g.key === 'reel');
  assert.deepEqual([reel.n, reel.small], [5, false]);
  assert.equal(audit.groups.kind[0].key, 'reel'); // melhor grupo primeiro
  assert.equal(audit.groups.ask.length, 2);

  const likes = auditPosts(views.map((v, i) => post(String(i), null, { likes: v })));
  assert.equal(likes.metric, 'likes');
  assert.equal(likes.enough, true);
  assert.equal(auditPosts(views.map((v, i) => post(String(i), 0))).enough, false); // mediana 0: sem base
});
