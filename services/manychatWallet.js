// Gasto da carteira do ManyChat (WhatsApp API). Só acompanhamento: NÃO vira despesa no Financeiro (a despesa é a recarga, lançada à mão).
// Fonte: CSV "Wallet operations" (Settings → Billing → Wallet). Valores em US$ (moeda da carteira); a conversão para R$ é feita na tela.

const pad = (n) => String(n).padStart(2, '0');

/** Linhas do CSV (objetos por cabeçalho) → cobranças. Recargas (valor positivo) e linhas sem data/Id ficam de fora. */
export function parseWalletRows(rows) {
  const ops = [];
  for (const r of rows) {
    const amount = Number(r.Amount);
    const iso = r['Created at (ISO 8601)'] || '';
    if (!r.Id || !(amount < 0) || !/^\d{4}-\d{2}-\d{2}T/.test(iso)) continue;
    ops.push({
      id: String(r.Id).trim(), cost: -amount, type: r.Type || '',
      flow: String(r.Source || '').replace(/^Flow "(.*)"$/, '$1'),
      phone: String(r.Subscriber || '').replace(/\D/g, ''),
      day: iso.slice(0, 10), // o ISO já vem no fuso de Brasília (-03:00)
    });
  }
  return ops;
}

/** Chave de comparação de telefones: o WhatsApp às vezes omite o 9º dígito de celulares brasileiros (55 + DDD + 9 + 8 dígitos). */
export const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').replace(/^(55\d{2})9(\d{8})$/, '$1$2');

/** Um documento por dia × telefone, com as cobranças num mapa por Id: gravar com merge é idempotente (reimportar não duplica). */
export function groupByDayPhone(ops) {
  const groups = new Map();
  for (const o of ops) {
    const id = `${o.day}_${o.phone || '0'}`;
    const g = groups.get(id) ?? { day: o.day, phone: o.phone, ops: {} };
    g.ops[o.id] = { c: o.cost, t: o.type, f: o.flow };
    groups.set(id, g);
  }
  return groups;
}

export function expandDocs(docs) {
  return docs.flatMap((d) => Object.entries(d.ops ?? {}).map(([id, v]) => ({ id, day: d.day, phone: d.phone, cost: v.c, type: v.t, flow: v.f })));
}

const total = (list) => list.reduce((s, o) => s + o.cost, 0);

export function spendByMonth(ops, year) {
  return Array.from({ length: 12 }, (_, i) => {
    const monthKey = `${year}-${pad(i + 1)}`;
    const list = ops.filter((o) => o.day.startsWith(monthKey));
    return { monthKey, total: total(list), count: list.length };
  });
}

export function spendByDay(ops, monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const days = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => ({ day: i + 1, total: 0, count: 0 }));
  for (const o of ops) {
    if (!o.day.startsWith(monthKey)) continue;
    const slot = days[Number(o.day.slice(8)) - 1];
    slot.total += o.cost; slot.count += 1;
  }
  return days;
}

/** Semanas de segunda a domingo; a primeira e a última são cortadas nos limites do mês. */
export function spendByWeek(ops, monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const weeks = [];
  for (const d of spendByDay(ops, monthKey)) {
    const dow = (new Date(y, m - 1, d.day).getDay() + 6) % 7; // 0 = segunda
    if (dow === 0 || !weeks.length) weeks.push({ from: d.day, to: d.day, total: 0, count: 0 });
    const w = weeks[weeks.length - 1];
    w.to = d.day; w.total += d.total; w.count += d.count;
  }
  return weeks;
}

/**
 * Cruza o consumo de cada telefone no mês com as vendas do mês (entradas do Financeiro) pelo WhatsApp do cliente cadastrado.
 * O gasto do cliente é dividido igualmente entre os pedidos dele no mês.
 * ponytail: período único (mês do consumo = mês da venda); conversa num mês e venda no seguinte aparece como "sem venda".
 */
export function linkSpend({ ops, monthKey, entries, clients }) {
  const byPhone = new Map();
  for (const o of ops) {
    if (!o.day.startsWith(monthKey)) continue;
    const k = phoneKey(o.phone);
    const s = byPhone.get(k) ?? { total: 0, count: 0, phone: o.phone };
    s.total += o.cost; s.count += 1; byPhone.set(k, s);
  }
  const clientByPhone = new Map(clients.filter((c) => c.whatsappNormalized).map((c) => [phoneKey(c.whatsappNormalized), c]));

  const orders = new Map(); // pedido → { clientId, serviceId, value }
  for (const e of entries) {
    if (e.monthKey !== monthKey) continue;
    const key = e.order.orderId || e.order.id;
    const cur = orders.get(key) ?? { id: key, clientId: e.order.clientId, serviceId: e.order.serviceId || 'sem-servico', value: 0 };
    cur.value += e.value; orders.set(key, cur);
  }
  const ordersByClient = new Map();
  for (const o of orders.values()) ordersByClient.set(o.clientId, [...(ordersByClient.get(o.clientId) ?? []), o]);

  const rows = []; const services = new Map();
  const seen = new Set();
  for (const [k, s] of byPhone) {
    const client = clientByPhone.get(k) ?? null;
    const sold = client ? ordersByClient.get(client.id) ?? [] : [];
    if (client) seen.add(client.id);
    rows.push({ phone: s.phone, client, total: s.total, count: s.count, orders: sold });
    for (const o of sold) {
      const g = services.get(o.serviceId) ?? { serviceId: o.serviceId, orders: 0, revenue: 0, spend: 0 };
      g.orders += 1; g.revenue += o.value; g.spend += s.total / sold.length; services.set(o.serviceId, g);
    }
  }
  // Vendas de clientes sem consumo no mês entram na tabela por serviço (gasto 0), para não distorcer o custo por venda.
  for (const o of orders.values()) {
    if (seen.has(o.clientId)) continue;
    const g = services.get(o.serviceId) ?? { serviceId: o.serviceId, orders: 0, revenue: 0, spend: 0 };
    g.orders += 1; g.revenue += o.value; services.set(o.serviceId, g);
  }
  rows.sort((a, b) => b.total - a.total);
  return {
    rows, services: [...services.values()].sort((a, b) => b.spend - a.spend),
    spendSold: total(rows.filter((r) => r.orders.length).map((r) => ({ cost: r.total }))),
    spendNoSale: total(rows.filter((r) => !r.orders.length).map((r) => ({ cost: r.total }))),
  };
}
