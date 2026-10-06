import test from 'node:test';
import assert from 'node:assert/strict';
import { importReelsAsVideos, reelCode, provisionalTitle } from '../functions/instagram-video-import.js';

function fakeDb(videos = {}, imported) {
  const store = new Map(Object.entries(videos).map(([id, d]) => [`videos/${id}`, d]));
  if (imported) store.set('instagramPrivate/importedReels', { codes: imported });
  return {
    store,
    collection: () => ({ get: async () => ({ docs: [...store].filter(([k]) => k.startsWith('videos/')).map(([, d]) => ({ data: () => d })) }) }),
    doc: (path) => ({ get: async () => ({ exists: store.has(path), data: () => store.get(path) }), set: async (d) => { store.set(path, d); } }),
  };
}
const reel = (id, code, extra = {}) => ({ id, kind: 'reel', caption: 'Título legal\nresto', permalink: `https://www.instagram.com/reel/${code}/`, thumbnailUrl: `cdn/${id}`, publishedAt: '2026-01-01T00:00:00.000Z', ...extra });
const store = async (url) => `blob/${url}`;

test('helpers: código do post e título provisório', () => {
  assert.equal(reelCode('https://www.instagram.com/reel/AbC_1-2/?utm=x'), 'AbC_1-2');
  assert.equal(reelCode('https://instagram.com/p/XyZ/'), 'XyZ');
  assert.equal(reelCode(''), '');
  assert.equal(provisionalTitle('\n  Primeira linha \nsegunda'), 'Primeira linha');
  assert.equal(provisionalTitle(''), 'Reel do Instagram (sem título)');
  assert.equal(provisionalTitle('a'.repeat(100)).length, 80);
});

test('import: cria vídeo inativo só para Reels novos, com miniatura copiada e pendente de revisão', async () => {
  const db = fakeDb();
  const posts = [reel('1', 'AAA'), { id: '2', kind: 'image', permalink: 'https://www.instagram.com/p/BBB/' }];
  assert.deepEqual(await importReelsAsVideos({ db, posts, store }), { imported: 1, failed: 0 });
  const v = db.store.get('videos/ig_AAA');
  assert.deepEqual([v.active, v.featured, v.needsReview, v.source, v.title, v.instagramId, v.thumbnailUrl], [false, false, true, 'instagram-sync', 'Título legal', 'AAA', 'blob/cdn/1']);
  assert.equal(db.store.has('videos/ig_BBB'), false);
  assert.deepEqual(db.store.get('instagramPrivate/importedReels').codes, ['AAA']);
});

test('import: não toca em vídeo manual (mesmo código) nem recria vídeo excluído; segunda execução não duplica', async () => {
  const manual = { title: 'Meu', instagramUrl: 'https://www.instagram.com/reel/AAA/', instagramId: '', active: true };
  const db = fakeDb({ manual }, ['CCC']);
  const posts = [reel('1', 'AAA'), reel('3', 'CCC'), reel('4', 'DDD')];
  assert.equal((await importReelsAsVideos({ db, posts, store })).imported, 1);
  assert.equal(db.store.get('videos/manual'), manual);
  assert.equal(db.store.has('videos/ig_AAA'), false);
  assert.equal(db.store.has('videos/ig_CCC'), false);
  assert.equal((await importReelsAsVideos({ db, posts, store })).imported, 0);
});

test('import: falha na miniatura não cria o vídeo agora e tenta de novo depois', async () => {
  const db = fakeDb();
  const posts = [reel('1', 'AAA')];
  assert.deepEqual(await importReelsAsVideos({ db, posts, store: async () => { throw new Error('x'); } }), { imported: 0, failed: 1 });
  assert.equal(db.store.has('videos/ig_AAA'), false);
  assert.equal((await importReelsAsVideos({ db, posts, store })).imported, 1);
});
