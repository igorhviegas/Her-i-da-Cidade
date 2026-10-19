import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundSetUrls, normalizeArt, priceNumber, splitTitle, wrapRich } from './serviceArt.js';

test('preço: número depois de R$, sem centavos zerados; sem R$ a arte fica sem preço', () => {
  assert.equal(priceNumber('A partir de R$ 65'), '65');
  assert.equal(priceNumber('15 minutos R$ 75'), '75');
  assert.equal(priceNumber('R$ 59,90'), '59,90');
  assert.equal(priceNumber('R$30,00'), '30');
  assert.equal(priceNumber('Sob Consulta'), '');
});

test('descrição: quebra pela largura, mantém negrito e respeita Enter', () => {
  const measure = (text) => text.length; // 1 por caractere
  assert.deepEqual(wrapRich('Um bate-papo **ao vivo** com o Herói da Cidade', 22, measure), [
    [{ text: 'Um bate-papo', bold: false }, { text: ' ao vivo', bold: true }],
    [{ text: 'com o Herói da Cidade', bold: false }],
  ]);
  assert.deepEqual(wrapRich('linha um\nlinha dois', 100, measure), [
    [{ text: 'linha um', bold: false }],
    [{ text: 'linha dois', bold: false }],
  ]);
  assert.deepEqual(wrapRich('', 100, measure), []);
});

test('título em duas linhas equilibradas', () => {
  assert.deepEqual(splitTitle('VÍDEO ESPECIAL DE ANIVERSÁRIO'), ['VÍDEO ESPECIAL DE', 'ANIVERSÁRIO']);
  assert.deepEqual(splitTitle('VÍDEO ESPECIAL ANIVERSÁRIO'), ['VÍDEO ESPECIAL', 'ANIVERSÁRIO']);
  assert.deepEqual(splitTitle('VÍDEO PERSONALIZADO'), ['VÍDEO', 'PERSONALIZADO']);
  assert.deepEqual(splitTitle('CONVITE'), ['CONVITE']);
});

test('fundos prontos: só os formatos que existem', () => {
  assert.deepEqual(backgroundSetUrls('natal'), { square: '/images/service-art/natal-square.jpg', story: '/images/service-art/natal-story.jpg' });
  assert.deepEqual(backgroundSetUrls('nada'), {});
});

test('arte gravada: só campos preenchidos e fundos com endereço válido', () => {
  assert.deepEqual(normalizeArt({ title: ' Vídeo Convite ', badge: '', description: 'x', backgrounds: { square: '/images/service-art/convite-square.jpg', story: 'javascript:1', wide: '' } }),
    { title: 'Vídeo Convite', description: 'x', backgrounds: { square: '/images/service-art/convite-square.jpg' } });
  assert.equal(normalizeArt({ title: ' ', backgrounds: {} }), undefined);
  assert.equal(normalizeArt(null), undefined);
});
