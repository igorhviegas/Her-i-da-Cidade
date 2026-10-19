// Extrato do Banco Inter importado de arquivo (CSV ou OFX exportado pelo app/Internet Banking).
// Puro: sem Firebase, para teste em node. O id de cada lançamento é derivado do próprio lançamento, então
// reimportar o mesmo período (ou um arquivo que se sobrepõe ao anterior) não duplica nada.

export const IN_CATEGORIES = ['Serviços (clientes)', 'Transferência entre contas', 'Rendimentos', 'Reembolso', 'Outras entradas'];
export const OUT_CATEGORIES = ['Materiais e fantasias', 'Edição de vídeo', 'Combustível e transporte', 'Alimentação', 'Impostos (DAS)', 'Tarifas bancárias', 'Anúncios e marketing', 'Assinaturas e software', 'Retirada (pró-labore)', 'Transferência entre contas', 'Outras saídas'];
export const UNCATEGORIZED = 'Sem categoria';

const clean = (v) => String(v ?? '').replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim();
const fold = (v) => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "1.234,56", "-12,30", "R$ 10,00" ou "1234.56" -> número. */
export function parseMoney(raw) {
  let s = clean(raw).replace(/R\$\s?/i, '').replace(/\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return s && Number.isFinite(n) ? n : null;
}

/** "02/01/2024" ou "2024-01-02" -> "2024-01-02". */
function parseDate(raw) {
  const s = clean(raw);
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

const cents = (n) => Math.round(n * 100);

/** Mesmo dia + valor + saldo pode repetir (entra e sai o mesmo valor); o contador de ocorrência no arquivo desempata. */
function withIds(items, prefix) {
  const seen = new Map();
  return items.map(({ sourceId, ...t }) => {
    if (sourceId) return { id: `${prefix}_${sourceId.replace(/[^\w.-]/g, '_')}`, ...t };
    const key = `${t.date}_${cents(t.kind === 'out' ? -t.amount : t.amount)}_${t.balance === null ? 'x' : cents(t.balance)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return { id: `${prefix}_${key}_${n}`, ...t };
  });
}

function tx({ date, signed, title, description, balance = null, source, sourceId = null }) {
  return { date, monthKey: date.slice(0, 7), amount: Math.abs(cents(signed)) / 100, kind: signed < 0 ? 'out' : 'in', title: clean(title).slice(0, 300), description: clean(description).slice(0, 500), balance, source, category: null, sourceId };
}

/** Linhas do CSV (já separadas, ex.: Papa.parse sem header). Acha o cabeçalho "Data Lançamento;Histórico;Descrição;Valor;Saldo". */
export function parseCsvRows(rows) {
  const headerAt = rows.findIndex((r) => r.some((c) => fold(c).startsWith('data')) && r.some((c) => fold(c) === 'valor' || fold(c).startsWith('valor')));
  if (headerAt < 0) return [];
  const head = rows[headerAt].map(fold);
  const col = (test) => head.findIndex(test);
  const iDate = col((h) => h.startsWith('data'));
  const iValue = col((h) => h.startsWith('valor'));
  const iBalance = col((h) => h.startsWith('saldo'));
  const iTitle = col((h) => h.startsWith('hist'));
  const iDesc = col((h) => h.startsWith('descri'));
  const items = [];
  for (const r of rows.slice(headerAt + 1)) {
    const date = parseDate(r[iDate]);
    const signed = parseMoney(r[iValue]);
    if (!date || signed === null) continue;
    items.push(tx({ date, signed, title: iTitle >= 0 ? r[iTitle] : '', description: iDesc >= 0 ? r[iDesc] : '', balance: iBalance >= 0 ? parseMoney(r[iBalance]) : null, source: 'csv' }));
  }
  return withIds(items, 'c');
}

/** OFX (SGML ou XML): um lançamento por <STMTTRN>, id pelo FITID do banco. */
export function parseOfx(text) {
  const field = (block, tag) => block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '';
  const items = [];
  for (const [, block] of String(text).matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)) {
    const date = parseDate(field(block, 'DTPOSTED'));
    const signed = parseMoney(field(block, 'TRNAMT'));
    if (!date || signed === null) continue;
    items.push(tx({ date, signed, title: field(block, 'NAME') || field(block, 'TRNTYPE'), description: field(block, 'MEMO'), source: 'ofx', sourceId: field(block, 'FITID') || null }));
  }
  return withIds(items, 'o');
}

/** Escolhe o leitor pelo conteúdo; `csvRows` só é usado quando o texto não é OFX. */
export function parseStatement(text, csvRows) {
  return /<OFX>|OFXHEADER/i.test(text) ? parseOfx(text) : parseCsvRows(csvRows);
}

/** Chave da regra de categoria: mesmo tipo + histórico + descrição (ex.: "out|pagamento|adobe") recebe a mesma categoria. */
export function categoryKey(t) {
  return `${t.kind}|${fold(t.title)}|${fold(t.description)}`.slice(0, 400);
}

/** Id de documento seguro para a regra (sem "/"). */
export const ruleId = (key) => encodeURIComponent(key).replace(/\./g, '%2E').slice(0, 1400);

/** Categoria das entradas que nenhuma regra lembrada cobre. */
export const DEFAULT_IN_CATEGORY = 'Serviços (clientes)';

/**
 * Separa o que ainda não existe e já aplica a categoria das regras salvas; entrada sem regra recebe `defaultIn`
 * (null = deixa sem categoria, ex.: a categoria padrão foi renomeada/excluída).
 */
export function planImport(items, existingIds, rules, defaultIn = null) {
  const fresh = items.filter((t) => !existingIds.has(t.id));
  let auto = 0, defaulted = 0;
  const toWrite = fresh.map((t) => {
    const ruled = rules.get(categoryKey(t)) ?? null;
    if (ruled) auto += 1;
    const category = ruled ?? (t.kind === 'in' ? defaultIn : null);
    if (!ruled && category) defaulted += 1;
    return { ...t, category };
  });
  return { toWrite, skipped: items.length - fresh.length, auto, defaulted };
}

const pad = (n) => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthStart = (y, m) => { const d = new Date(Date.UTC(y, m - 1, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };

/**
 * Período do filtro da aba Banco: 'month' (mês escolhido no topo, um raio por dia), 'year' (ano corrente),
 * '12m' (últimos 12 meses) ou 'all' (do 1º lançamento importado até hoje; por ano quando passa de 36 meses).
 */
export function bankPeriod(period, monthKey, now = new Date(), items = []) {
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const current = `${y}-${pad(m)}`;
  const endOf = (mk) => `${mk}-${pad(lastDay(Number(mk.slice(0, 4)), Number(mk.slice(5, 7))))}`;
  if (period === 'month') return { from: `${monthKey}-01`, to: endOf(monthKey), unit: 'day' };
  if (period === 'year') return { from: `${y}-01-01`, to: `${y}-12-31`, unit: 'month' };
  if (period === '12m') return { from: `${monthStart(y, m - 11)}-01`, to: endOf(current), unit: 'month' };
  const first = items.reduce((min, t) => (t.date < min ? t.date : min), `${current}-01`).slice(0, 7);
  const months = (y - Number(first.slice(0, 4))) * 12 + m - Number(first.slice(5, 7)) + 1;
  return { from: `${first}-01`, to: endOf(current), unit: months > 36 ? 'year' : 'month' };
}

/** Entradas e saídas por dia, mês ou ano do período, incluindo os vazios (cada um vira um raio da bússola). */
export function bankSeries(items, { from, to, unit }) {
  const size = unit === 'day' ? 10 : unit === 'month' ? 7 : 4;
  const keys = [];
  const [fy, fm] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  if (unit === 'year') for (let yy = fy; yy <= Number(to.slice(0, 4)); yy += 1) keys.push(String(yy));
  else if (unit === 'month') for (let i = 0; monthStart(fy, fm + i) <= to.slice(0, 7); i += 1) keys.push(monthStart(fy, fm + i));
  else for (const d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) keys.push(d.toISOString().slice(0, 10));
  const map = new Map(keys.map((key) => [key, { key, in: 0, out: 0, count: 0 }]));
  for (const t of items) {
    const row = map.get(t.date.slice(0, size));
    if (!row) continue;
    row[t.kind] = cents(row[t.kind] + t.amount) / 100;
    row.count += 1;
  }
  return [...map.values()];
}

/** Configuração padrão das categorias (antes de o dono salvar a dele em bankSettings/categories). */
export const DEFAULT_CATEGORY_SETTINGS = { in: IN_CATEGORIES, out: OUT_CATEGORIES, hidden: [] };

/** Tira as categorias ocultas e, se escolhida, deixa só uma categoria (UNCATEGORIZED = sem categoria). */
export function visibleItems(items, hidden = [], category = null) {
  const off = new Set(hidden);
  return items.filter((t) => !(t.category && off.has(t.category)) && (!category || (t.category || UNCATEGORIZED) === category));
}

/** Troca (ou remove, com `next` nulo) um nome numa lista de categorias, sem repetir. */
export function replaceCategory(list, old, next) {
  return [...new Set(list.map((c) => (c === old ? next : c)).filter(Boolean))];
}

/** Totais e quebra por categoria (maior primeiro). */
export function bankTotals(items) {
  const group = (kind) => {
    const map = new Map();
    for (const t of items) if (t.kind === kind) map.set(t.category || UNCATEGORIZED, (map.get(t.category || UNCATEGORIZED) ?? 0) + t.amount);
    return [...map].map(([category, total]) => ({ category, total: cents(total) / 100 })).sort((a, b) => b.total - a.total);
  };
  const sum = (kind) => cents(items.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0)) / 100;
  const totalIn = sum('in'), totalOut = sum('out');
  return { totalIn, totalOut, balance: cents(totalIn - totalOut) / 100, count: items.length, uncategorized: items.filter((t) => !t.category).length, byCategory: { in: group('in'), out: group('out') } };
}
