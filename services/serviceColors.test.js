import test from 'node:test';
import assert from 'node:assert/strict';
import { getServiceColor } from './serviceColors.js';

test('cor por serviço, por título ou id; sem cor para desconhecidos', () => {
  assert.equal(getServiceColor({ id: 'x', title: 'Vídeo Especial de Aniversário' }), 'red');
  assert.equal(getServiceColor({ id: 'x', title: 'Vídeo Temático' }), 'yellow');
  assert.equal(getServiceColor({ id: 'x', title: 'Vídeo Personalizado' }), 'blue');
  assert.equal(getServiceColor({ id: 'x', title: 'Vídeo Convite' }), 'purple');
  assert.equal(getServiceColor({ id: 'x', title: 'Vídeo Chamada ao Vivo' }), 'green');
  assert.equal(getServiceColor({ id: '4', title: 'Renomeado' }), 'purple');
  assert.equal(getServiceColor({ id: 'z', title: 'Missão Digital' }), null);
  assert.equal(getServiceColor(null), null);
});
