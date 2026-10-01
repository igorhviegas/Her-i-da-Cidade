import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./AdminOrdersPage.tsx', import.meta.url), 'utf8');
const columns = source.slice(source.indexOf('const COLUMNS'), source.indexOf('] as const'));
const completed = source.slice(source.indexOf('Pedidos concluídos ('));

test('colunas do Kanban: Entregar, Gravar, Editar, Agendado, Concluído', () => {
  const order = [...columns.matchAll(/status: '(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(order, ['delivery', 'recording', 'editing', 'scheduled', 'completed']);
});

test('botão de WhatsApp na etapa Entregar não move nem abre o card', () => {
  assert.match(source, /order\.status === 'delivery'/);
  assert.match(source, /Enviar pelo WhatsApp/);
  assert.match(source, /buildDeliveryWhatsAppUrl\(client\?\.whatsapp, order, service\)/);
  assert.match(source, /draggable=\{false\}/);
  assert.match(source, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(source, /WhatsApp indisponível<\/p>/);
});

test('concluídos iniciam recolhidos; Ver mais/Ver menos alternam; busca e detalhes preservados', () => {
  assert.match(source, /const \[completedOpen, setCompletedOpen\] = useState\(false\)/);
  assert.match(completed, /completedOpen \? 'Ver menos' : 'Ver mais'/);
  assert.match(completed, /!completedOpen \? null : filteredCompletedOrders/);
  assert.match(completed, /setSelectedOrder\(\{ order, client, service, script \}\)/);
});

test('Concluir em todos os cards: confirma, reutiliza handleStatusChange e não abre WhatsApp', () => {
  assert.match(source, /Concluir/);
  assert.match(source, /window\.confirm\(`Concluir o pedido/);
  assert.match(source, /handleStatusChange\(view\.order\.id, 'completed'\)/);
});

test('cards exibem o nome da criança e há botão de atualizar', () => {
  assert.match(source, /Criança: /);
  assert.match(source, /aria-label="Atualizar pedidos"/);
});
