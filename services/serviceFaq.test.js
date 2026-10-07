import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, normalizeFaq, findServiceBySlug } from './serviceFaq.js';

test('slugify remove acentos e símbolos', () => {
  assert.equal(slugify('Vídeo Convite'), 'video-convite');
  assert.equal(slugify('  Vídeo Chamada ao Vivo! '), 'video-chamada-ao-vivo');
  assert.equal(slugify('!!!'), '');
});

test('normalizeFaq descarta itens incompletos e deduplica ids', () => {
  assert.deepEqual(normalizeFaq(undefined), []);
  assert.deepEqual(normalizeFaq('x'), []);
  const out = normalizeFaq([
    { id: 'a', title: ' Pagamento ', content: ' Pix ' },
    { id: 'a', title: 'Prazo', content: '7 dias' },
    { id: 'b', title: 'Sem conteúdo', content: '  ' },
    null,
    { title: 'Sem id', content: 'ok' },
  ]);
  assert.deepEqual(out.map((i) => i.title), ['Pagamento', 'Prazo', 'Sem id']);
  assert.equal(new Set(out.map((i) => i.id)).size, 3);
  assert.equal(out[0].content, 'Pix');
});

test('findServiceBySlug encontra pelo título e devolve null quando não existe', () => {
  const list = [{ title: 'Vídeo Convite', n: 1 }, { title: 'Video convite', n: 2 }, { title: 'Presencial', n: 3 }];
  assert.equal(findServiceBySlug(list, 'video-convite').n, 1);
  assert.equal(findServiceBySlug(list, 'presencial').n, 3);
  assert.equal(findServiceBySlug(list, 'nada'), null);
  assert.equal(findServiceBySlug(null, 'x'), null);
});
