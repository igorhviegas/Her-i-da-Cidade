// Interpretação do texto de PDFs de formulários (Google Forms) em campos do pedido. Funções puras.
//
// ATENÇÃO: este parser NÃO foi validado contra um PDF real do formulário do Herói da Cidade (nenhum exemplo estava
// disponível). Ele reconhece o padrão genérico "pergunta + resposta" / "Pergunta: resposta" e rótulos comuns em
// português. Tudo que não for reconhecido com segurança é sinalizado para revisão humana; nada é criado automaticamente.

const strip = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const normalizeLabel = (s) => strip(s).replace(/[^a-z0-9]+/g, ' ').trim();

/** Rótulos conhecidos (normalizados), do mais específico ao mais genérico. */
export const FIELD_DEFS = [
  { key: 'childName', label: 'Nome do aniversariante', keywords: ['nome do aniversariante', 'nome da crianca', 'nome do homenageado', 'nome do aniversariante s', 'aniversariante', 'homenageado', 'crianca', 'criancas'] },
  { key: 'clientName', label: 'Nome do responsável', keywords: ['nome do responsavel', 'nome do contratante', 'nome do cliente', 'nome completo', 'seu nome', 'responsavel', 'contratante'] },
  { key: 'whatsapp', label: 'WhatsApp', keywords: ['whatsapp', 'whats app', 'telefone', 'celular', 'contato'] },
  { key: 'eventDate', label: 'Data do evento', keywords: ['data da festa', 'data do evento', 'data do aniversario', 'data da comemoracao', 'data'] },
  { key: 'eventTime', label: 'Horário', keywords: ['horario', 'horario da festa', 'hora do evento', 'hora da festa', 'hora de inicio', 'inicio', 'hora'] },
  { key: 'address', label: 'Endereço', keywords: ['endereco', 'endereco da festa', 'local da festa', 'local do evento', 'local'] },
  { key: 'age', label: 'Idade', keywords: ['idade', 'quantos anos', 'vai fazer quantos anos', 'faz quantos anos'] },
  { key: 'extras', label: 'Serviços adicionais', keywords: ['teia extra', 'adicional', 'adicionais', 'extras', 'servicos adicionais'] },
];
const AMBIGUOUS_LABELS = ['nome', 'contato'];
const IGNORED_LABEL = /carimbo|timestamp|data hora|endereco de e mail|e mail|email/;

/** Classifica um rótulo: { key, level: 'high'|'medium'|'low' } ou null. */
export function classifyLabel(rawLabel) {
  const label = normalizeLabel(rawLabel).replace(/ obrigatori[oa]$/, '');
  if (!label || IGNORED_LABEL.test(label)) return null;
  if (label === 'nome') return { key: 'clientName', level: 'low' }; // ambíguo: responsável ou criança?
  for (const def of FIELD_DEFS) {
    if (def.keywords.includes(label)) return { key: def.key, level: AMBIGUOUS_LABELS.includes(label) ? 'low' : 'high' };
  }
  for (const def of FIELD_DEFS) {
    const hit = def.keywords.find((k) => k.length > 4 && new RegExp(`(^| )${k}( |$)`).test(label));
    if (hit) return { key: def.key, level: 'medium' };
  }
  return null;
}

// ---- datas e horários ----
const MONTHS = { janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12 };
const validDate = (y, m, d) => { const date = new Date(y, m - 1, d); return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d; };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** { iso: 'YYYY-MM-DD', ambiguous } ou null. Datas sem ano assumem a próxima ocorrência e são marcadas como ambíguas. */
export function parseDate(text, today = new Date()) {
  const s = strip(text);
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m && validDate(+m[1], +m[2], +m[3])) return { iso: iso(+m[1], +m[2], +m[3]), ambiguous: false };
  m = s.match(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4}|\d{2})(?!\d)/);
  if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; if (validDate(y, +m[2], +m[1])) return { iso: iso(y, +m[2], +m[1]), ambiguous: false }; }
  m = s.match(/(\d{1,2})\s*(?:de\s+)?([a-z]{3,9})(?:\s*(?:de|,)?\s*(\d{4}))?/);
  if (m && MONTHS[m[2]]) {
    const month = MONTHS[m[2]];
    if (m[3]) return validDate(+m[3], month, +m[1]) ? { iso: iso(+m[3], month, +m[1]), ambiguous: false } : null;
    let y = today.getFullYear();
    if (new Date(y, month - 1, +m[1]) < new Date(today.getFullYear(), today.getMonth(), today.getDate())) y += 1;
    return validDate(y, month, +m[1]) ? { iso: iso(y, month, +m[1]), ambiguous: true } : null;
  }
  m = s.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?!\d)/);
  if (m) {
    let y = today.getFullYear();
    if (validDate(y, +m[2], +m[1]) && new Date(y, +m[2] - 1, +m[1]) < new Date(today.getFullYear(), today.getMonth(), today.getDate())) y += 1;
    if (validDate(y, +m[2], +m[1])) return { iso: iso(y, +m[2], +m[1]), ambiguous: true };
  }
  return null;
}

/** 'HH:MM' a partir de "15h", "15:30", "15h30", "às 15 horas". */
export function parseTime(text) {
  const m = strip(text).match(/(?<!\d)([01]?\d|2[0-3])\s*(?:h|hs|horas?|:)\s*([0-5]\d)?(?!\d)/);
  return m ? `${m[1].padStart(2, '0')}:${m[2] ?? '00'}` : null;
}

export function normalizeWhatsApp(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13 ? digits : null;
}

// ---- pares pergunta/resposta ----
const CHECKBOX = /^[\s☐☑☒✓✔○●◯◉▢□■]+|^\[[ xX]?\]\s*/;
const PAGE_FOOTER = /^(p[aá]gina\s+\d+(\s*(de|\/)\s*\d+)?|\d+\s+de\s+\d+)$/i; // "12/03" sozinho é data, não rodapé
const TIME_LIKE = /^\d{1,2}:\d{2}/;

function labelLike(line) {
  if (/[?*:]\s*$/.test(line)) return line.length <= 160;
  return Boolean(classifyLabel(line)) && normalizeLabel(line).split(' ').length <= 6 && !/\d/.test(line);
}

/** Lê "Pergunta: resposta" na mesma linha e "pergunta" seguida de linhas de resposta. */
export function extractPairs(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.replace(CHECKBOX, '').trim()).filter((l) => l && !PAGE_FOOTER.test(l));
  const pairs = [];
  let current = null;
  const flush = () => { if (current) { current.value = current.valueLines.join('\n').trim(); delete current.valueLines; pairs.push(current); current = null; } };
  for (const line of lines) {
    const inline = line.match(/^([^:?]{2,80})[:?]\s*(\S.*)$/);
    if (inline && !TIME_LIKE.test(line) && /[A-Za-zÀ-ÿ]/.test(inline[1]) && (classifyLabel(inline[1]) || (inline[1].length <= 40 && !/[\d,]/.test(inline[1])))) {
      flush(); current = { label: inline[1].replace(/\*+$/, '').trim(), valueLines: [inline[2].trim()] }; flush(); continue;
    }
    if (labelLike(line)) { flush(); current = { label: line.replace(/[?*:]+\s*$/, '').replace(/\*+$/, '').trim(), valueLines: [] }; continue; }
    if (current) current.valueLines.push(line);
  }
  flush();
  return pairs.filter((p) => p.label);
}

const downgrade = { high: 'medium', medium: 'low', low: 'low' };

/**
 * Interpreta o texto extraído. `ocr: true` rebaixa a confiança (leitura por OCR pode errar caracteres).
 * Retorno: { fields: { [key]: { value, label, confidence, parsed?, notes[] } }, others: [{label, value}], childrenCount, warnings[] }
 */
export function parseFormText(text, { ocr = false, today = new Date() } = {}) {
  const fields = {};
  const others = [];
  const warnings = [];
  for (const pair of extractPairs(text)) {
    const cls = pair.value ? classifyLabel(pair.label) : null;
    if (!cls) { others.push({ label: pair.label, value: pair.value }); continue; }
    if (fields[cls.key]) { others.push({ label: pair.label, value: pair.value }); warnings.push(`Mais de uma resposta para "${FIELD_DEFS.find((d) => d.key === cls.key).label}": a primeira foi usada, as outras ficaram em "outras informações".`); continue; }
    const field = { value: pair.value.replace(/\s*\n\s*/g, cls.key === 'address' ? ', ' : ' ').trim(), label: pair.label, confidence: cls.level, notes: [] };
    if (cls.key === 'clientName' && normalizeLabel(pair.label) === 'nome') field.notes.push('Rótulo "Nome" é ambíguo: confirme se é o responsável ou a criança.');
    if (cls.key === 'whatsapp') {
      const digits = normalizeWhatsApp(field.value);
      if (digits) field.parsed = digits; else { field.confidence = 'low'; field.notes.push('Telefone com quantidade de dígitos inesperada.'); }
    }
    if (cls.key === 'eventDate') {
      const date = parseDate(field.value, today);
      if (date) { field.parsed = date.iso; if (date.ambiguous) { field.confidence = 'low'; field.notes.push('Data sem ano: foi assumida a próxima ocorrência. Confirme.'); } }
      else { field.confidence = 'low'; field.notes.push('Data não reconhecida.'); }
      const time = parseTime(field.value);
      if (time && !fields.eventTime) fields.eventTime = { value: time, label: pair.label, confidence: 'medium', parsed: time, notes: ['Horário lido junto da data.'] };
    }
    if (cls.key === 'eventTime') {
      const time = parseTime(field.value);
      if (time) field.parsed = time; else { field.confidence = 'low'; field.notes.push('Horário não reconhecido.'); }
    }
    if (ocr) field.confidence = downgrade[field.confidence];
    fields[cls.key] = field;
  }
  const childrenCount = fields.childName ? fields.childName.value.split(/\s*(?:,|;|\/|&|\be\b|\n)\s*/i).filter(Boolean).length : 0;
  if (childrenCount > 1) fields.childName.notes.push(`${childrenCount} crianças identificadas: ajuste o consumo de materiais na conclusão.`);
  const haystack = normalizeLabel(text);
  if (/teia extra/.test(haystack) && !fields.extras) warnings.push('O documento menciona "teia extra": confira o conteúdo e o consumo de materiais.');
  if (ocr) warnings.push('Texto lido por OCR: confira cada campo, principalmente nomes, telefone e datas.');
  return { fields, others, childrenCount, warnings };
}

/** Conteúdo do pedido: tudo o que não é nome/WhatsApp do cliente (que têm campos próprios). */
export function buildOrderContent(parsed) {
  const f = parsed.fields;
  const lines = [];
  if (f.childName) lines.push(`Nome do aniversariante: ${f.childName.value}`);
  if (f.age) lines.push(`Idade: ${f.age.value}`);
  if (f.eventTime) lines.push(`Horário: ${f.eventTime.parsed ?? f.eventTime.value}`);
  if (f.address) lines.push(`Endereço: ${f.address.value}`);
  if (f.extras) lines.push(`Serviços adicionais: ${f.extras.value}`);
  for (const o of parsed.others) if (o.value) lines.push(`${o.label}: ${o.value}`);
  return lines.join('\n');
}

/** Valores sugeridos para o formulário de pedido: { name, whatsapp, eventDate (YYYY-MM-DD), content }. */
export function toOrderFormValues(parsed) {
  const f = parsed.fields;
  return {
    name: f.clientName?.value ?? '', whatsapp: f.whatsapp?.parsed ?? f.whatsapp?.value ?? '',
    eventDate: f.eventDate?.parsed ?? '', content: buildOrderContent(parsed),
  };
}

/** Impressão digital do texto (para detectar o mesmo formulário importado duas vezes). */
export async function importFingerprint(text) {
  const normalized = strip(text).replace(/\s+/g, ' ').trim();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return `sha256:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
