import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { localImageUrl } from './localImages.js';

const EDGE = [
  ['https://strict-bronze-c9lmqpt5fv.edgeone.app/Anivers%C3%A1rio.jpeg', '/images/site/servico-aniversario.webp'],
  ['https://eerie-chocolate-cuzaxle2lt.edgeone.app/Chamada.jpeg', '/images/site/servico-chamada.webp'],
  ['https://young-blush-amffe0wipw.edgeone.app/Personalizado.jpeg', '/images/site/servico-personalizado.webp'],
  ['https://wooden-chocolate-e7hrhsuhzk.edgeone.app/Convite.jpeg', '/images/site/servico-convite.webp'],
  ['https://sunny-amethyst-y7zbexuydq.edgeone.app/Tem%C3%A1tico.jpeg', '/images/site/servico-tematico.webp'],
  ['https://grateful-bronze-9xbpmjgfbs.edgeone.app/Presencial.jpeg', '/images/site/servico-presencial.webp'],
  ['https://rising-brown-rufjc3ycjc.edgeone.app/WhatsApp%20Image%202026-01-08%20at%2015.00.34.jpeg', '/images/site/hero.webp'],
  ['https://disciplinary-peach-obfj8i7gqu.edgeone.app/profissional%201.jpeg', '/images/site/sobre.webp'],
];

test('as 8 URLs do edgeone viram o arquivo local, e o arquivo existe em public/', () => {
  for (const [from, to] of EDGE) {
    assert.equal(localImageUrl(from), to);
    assert.ok(existsSync(new URL(`../public${to}`, import.meta.url)), `${to} não existe em public/`);
  }
});

test('funciona com outro subdomínio do edgeone e com acento decomposto (NFD)', () => {
  assert.equal(localImageUrl('https://outro-nome-qualquer.edgeone.app/Chamada.jpeg'), '/images/site/servico-chamada.webp');
  assert.equal(localImageUrl(`https://x.edgeone.app/${encodeURIComponent('Aniversário.jpeg'.normalize('NFD'))}`), '/images/site/servico-aniversario.webp');
});

test('outras URLs, arquivos desconhecidos e valores não textuais ficam como estão', () => {
  for (const same of ['https://zlysbsezt51qmj7i.public.blob.vercel-storage.com/a.png', '/images/site/hero.webp', 'https://x.edgeone.app/Outra.jpeg', 'não é url', '']) assert.equal(localImageUrl(same), same);
  assert.equal(localImageUrl(undefined), undefined);
  assert.equal(localImageUrl(null), null);
});
