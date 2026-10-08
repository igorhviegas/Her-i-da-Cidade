import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// A página foi dividida em ./orders/*: as verificações de texto leem o conjunto de arquivos.
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const orderView = await read('./orders/orderView.ts');
const completedSource = await read('./orders/CompletedOrders.tsx');
const source = (await Promise.all([
  './AdminOrdersPage.tsx', './orders/OrderCard.tsx', './orders/OrdersKanban.tsx', './orders/OrdersToolbar.tsx', './orders/CompletedOrders.tsx', './orders/orderView.ts',
].map(read))).join('\n');
const columns = orderView.slice(orderView.indexOf('const COLUMNS'), orderView.indexOf('] as const'));
const completed = completedSource.slice(completedSource.indexOf('Pedidos concluídos ('));

test('colunas do Kanban: Entregar, Gravar, Editar, Agendado, Concluído', () => {
  const order = [...columns.matchAll(/status: '(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(order, ['delivery', 'recording', 'editing', 'scheduled', 'completed']);
});

test('botão de WhatsApp nos cards não move nem abre o card', () => {
  assert.match(source, /Enviar pelo WhatsApp/);
  // número da chamada (agendamento do site para outro número) tem prioridade; sem ele, o WhatsApp do cliente
  assert.match(source, /buildDeliveryWhatsAppUrl\(order\.videoCall\?\.callWhatsapp \? `\+\$\{order\.videoCall\.callWhatsapp\}` : client\?\.whatsapp, order, service\)/);
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

test('cards ganham cor por serviço', () => {
  assert.match(source, /getServiceColor\(service\)/);
  assert.match(source, /SERVICE_COLOR_CLASSES/);
});
