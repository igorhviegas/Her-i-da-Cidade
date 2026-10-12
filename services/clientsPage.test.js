import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIENTS_FEATURED_MAX, DEFAULT_THANK_YOU_VIDEO_URL, parsePoster, parseThankYouVideo, pickFeaturedVideos, resolveClientsConfig } from './clientsPage.js';

const video = (id, over = {}) => ({ id, title: `Vídeo ${id}`, active: true, featured: false, order: 1, ...over });

test('destaque do admin vem primeiro; depois a ordem do catálogo e os mais recentes', () => {
  const picked = pickFeaturedVideos([
    video('a', { order: 2 }),
    video('b', { order: 1, publishedAt: '2026-01-01' }),
    video('c', { order: 1, publishedAt: '2026-06-01' }),
    video('d', { order: 5, featured: true }),
  ]);
  assert.deepEqual(picked.map((v) => v.id), ['d', 'c', 'b', 'a']);
});

test('só vídeos reais e ativos; respeita o limite; sem vídeos devolve lista vazia', () => {
  const picked = pickFeaturedVideos([video('a'), video('off', { active: false }), video('', {}), video('x', { title: '' }), video('b')], 1);
  assert.deepEqual(picked.map((v) => v.id), ['a']);
  assert.deepEqual(pickFeaturedVideos([]), []);
  assert.deepEqual(pickFeaturedVideos(null), []);
});

test('não altera a lista original', () => {
  const input = [video('b', { order: 2 }), video('a', { order: 1 })];
  pickFeaturedVideos(input);
  assert.deepEqual(input.map((v) => v.id), ['b', 'a']);
});

test('YouTube em todos os formatos vira embed sem cookies, com capa', () => {
  const id = 'dQw4w9WgXcQ';
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}`, `https://youtube.com/shorts/${id}`,
    `https://m.youtube.com/watch?v=${id}&t=3`, `https://www.youtube.com/embed/${id}`,
  ]) {
    const parsed = parseThankYouVideo(url);
    assert.equal(parsed?.kind, 'youtube', url);
    assert.equal(parsed.embedUrl, `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1`);
    assert.equal(parsed.poster, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  }
});

test('arquivo de vídeo direto em HTTPS é aceito', () => {
  assert.deepEqual(parseThankYouVideo('https://abc.public.blob.vercel-storage.com/obrigado.mp4'), { kind: 'file', src: 'https://abc.public.blob.vercel-storage.com/obrigado.mp4' });
  assert.equal(parseThankYouVideo('https://x.com/a.WEBM')?.kind, 'file');
});

test('Instagram, HTTP, lixo e vazio não são incorporáveis', () => {
  for (const value of [
    'https://www.instagram.com/reel/ABC123/', 'http://x.com/a.mp4', 'https://www.youtube.com/watch?v=curto',
    'https://www.youtube.com/', 'javascript:alert(1)', 'obrigado', '', undefined, null, 42,
  ]) assert.equal(parseThankYouVideo(value), null, String(value));
});

test('capa só em HTTPS', () => {
  assert.equal(parsePoster(' https://x.com/capa.jpg '), 'https://x.com/capa.jpg');
  for (const value of ['http://x.com/capa.jpg', 'data:image/png;base64,AAA', '', null]) assert.equal(parsePoster(value), null);
});

test('ids escolhidos no admin: só esses, na ordem escolhida; inativos e inexistentes saem', () => {
  const list = [video('a'), video('b', { featured: true }), video('c'), video('off', { active: false })];
  assert.deepEqual(pickFeaturedVideos(list, 10, ['c', 'off', 'nao-existe', 'a']).map((v) => v.id), ['c', 'a']);
  assert.deepEqual(pickFeaturedVideos(list, 1, ['c', 'a']).map((v) => v.id), ['c']);
});

test('ids que não valem mais (todos inativos) voltam para a seleção automática', () => {
  const list = [video('a', { order: 2 }), video('b', { order: 1 }), video('off', { active: false })];
  assert.deepEqual(pickFeaturedVideos(list, 10, ['off', 'x']).map((v) => v.id), ['b', 'a']);
});

test('configuração: padrão com o vídeo de agradecimento e sem destaques escolhidos', () => {
  assert.deepEqual(resolveClientsConfig(undefined), { videoUrl: DEFAULT_THANK_YOU_VIDEO_URL, poster: '', orientation: 'horizontal', featuredIds: [] });
  assert.equal(DEFAULT_THANK_YOU_VIDEO_URL, 'https://youtu.be/SzTLExDEMQY');
  assert.equal(parseThankYouVideo(DEFAULT_THANK_YOU_VIDEO_URL)?.kind, 'youtube');
});

test('configuração: usa o que o admin salvou e descarta valores inválidos', () => {
  const config = resolveClientsConfig({
    clientsVideoUrl: '  https://x.com/v.mp4 ', clientsVideoPoster: 'https://x.com/c.jpg', clientsVideoOrientation: 'vertical',
    clientsFeaturedVideoIds: ['a', 'a', 7, '', null, 'b'],
  });
  assert.deepEqual(config, { videoUrl: 'https://x.com/v.mp4', poster: 'https://x.com/c.jpg', orientation: 'vertical', featuredIds: ['a', 'b'] });
  assert.equal(resolveClientsConfig({ clientsVideoUrl: 42, clientsVideoOrientation: 'diagonal', clientsFeaturedVideoIds: 'a' }).orientation, 'horizontal');
  assert.equal(resolveClientsConfig({ clientsFeaturedVideoIds: Array.from({ length: 30 }, (_, i) => `v${i}`) }).featuredIds.length, CLIENTS_FEATURED_MAX);
});
