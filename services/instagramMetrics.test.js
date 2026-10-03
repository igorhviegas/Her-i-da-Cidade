import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMedia, sortPosts, topPost, totalFor } from './instagramMetrics.js';

const raw = (id, over = {}) => ({ id, media_type: 'IMAGE', media_url: `u${id}`, timestamp: `2026-01-0${id}T10:00:00+0000`, like_count: 1, comments_count: 1, ...over });

test('normalizeMedia: tipos, miniatura e métricas ausentes viram null (nunca 0)', () => {
  assert.equal(normalizeMedia(raw('1', { media_type: 'VIDEO', media_product_type: 'REELS', thumbnail_url: 't' })).kind, 'reel');
  assert.equal(normalizeMedia(raw('1', { media_type: 'CAROUSEL_ALBUM' })).kind, 'carousel');
  assert.equal(normalizeMedia(raw('1', { media_type: 'VIDEO', media_url: 'video.mp4' })).thumbnailUrl, null); // não usa o .mp4 como imagem
  const hidden = normalizeMedia(raw('1', { like_count: undefined }), undefined);
  assert.equal(hidden.likes, null);
  assert.equal(hidden.views, null);
  assert.equal(normalizeMedia(raw('1'), 0).views, 0); // zero real é preservado
});

test('totais, ordenação e ranking ignoram publicações sem a métrica', () => {
  const posts = [
    normalizeMedia(raw('1', { like_count: 5 }), 100),
    normalizeMedia(raw('2', { like_count: 9 }), null),
    normalizeMedia(raw('3', { like_count: 7 }), 300),
    normalizeMedia(raw('4', { like_count: undefined, comments_count: 20 }), 50),
  ];
  assert.deepEqual(totalFor(posts, 'likes'), { total: 21, counted: 3 });
  assert.deepEqual(totalFor(posts, 'views'), { total: 450, counted: 3 });
  assert.deepEqual(sortPosts(posts, 'likes').map((p) => p.id), ['2', '3', '1', '4']);
  assert.deepEqual(sortPosts(posts, 'views').map((p) => p.id), ['3', '1', '4', '2']);
  assert.deepEqual(sortPosts(posts, 'recent').map((p) => p.id), ['4', '3', '2', '1']);
  assert.equal(topPost(posts, 'views').id, '3');
  assert.equal(topPost(posts, 'comments').id, '4');
  assert.equal(topPost([normalizeMedia(raw('1'), null)], 'views'), null);
  assert.equal(posts[0].id, '1'); // não muta a entrada
});

test('datas: normaliza para ISO; inválida vira null/"—" sem lançar; só a última sincronização entra nos indicadores', async () => {
  const { currentPosts, formatDateTime } = await import('./instagramMetrics.js');
  assert.equal(normalizeMedia(raw('1', { timestamp: '2026-01-02T03:04:05+0000' })).publishedAt, '2026-01-02T03:04:05.000Z');
  assert.equal(normalizeMedia(raw('1', { timestamp: 'lixo' })).publishedAt, null);
  assert.equal(normalizeMedia(raw('1', { timestamp: undefined })).publishedAt, null);
  for (const bad of [null, undefined, 'lixo', 42]) assert.equal(formatDateTime(bad), '—');
  assert.notEqual(formatDateTime('2026-01-02T03:04:05.000Z'), '—');
  const posts = [{ id: 'a', syncedAt: 'S2' }, { id: 'b', syncedAt: 'S1' }];
  assert.deepEqual(currentPosts(posts, 'S2').map((p) => p.id), ['a']);
  assert.deepEqual(currentPosts(posts, undefined), []);
});
