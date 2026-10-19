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

/** Separa o que ainda não existe e já aplica a categoria das regras salvas. */
export function planImport(items, existingIds, rules) {
  const fresh = items.filter((t) => !existingIds.has(t.id));
  let auto = 0;
  const toWrite = fresh.map((t) => {
    const category = rules.get(categoryKey(t)) ?? null;
    if (category) auto += 1;
    return { ...t, category };
  });
  return { toWrite, skipped: items.length - fresh.length, auto };
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
