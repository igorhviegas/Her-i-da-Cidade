// Arte do Vídeo Convite: lê nome, idade, data, horário e local do texto do pedido (ManyChat ou adicional de evento)
// e monta as linhas que vão na arte. Sem Firebase/React; testado em Node.
import { extractBirthdayPerson } from './orderReference.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const UFS = 'AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO';
// "15:30", "16h", "15h30", "17hrs"; não pega "15 homens" nem datas.
const TIME_RE = /\b([01]?\d|2[0-3])[ \t]*(?::[ \t]*([0-5]\d)|h(?:rs?|oras?)?(?:[ \t]*([0-5]\d))?)(?![\dA-Za-zÀ-ú])/i;
const DATE_RE = /\b(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*\d{2,4})?\b/g;
const PLACE_WORDS = 'casa|sal[aã]o|espa[cç]o|buffet|ch[aá]cara|s[ií]tio|clube|condom[ií]nio|parque|escola|igreja|pra[cç]a|rua|avenida|av\\.?|r\\.';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clean = (s) => s.trim().replace(/[\s.,;:–-]+$/, '').trim();

function findDate(text) {
  for (const m of text.matchAll(DATE_RE)) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return `${day} de ${MONTHS[month - 1]}`;
  }
  const written = norm(text).match(/\b(\d{1,2})\s*de\s*(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/);
  if (written) return `${Number(written[1])} de ${MONTHS.find((name) => norm(name) === written[2])}`;
  return '';
}

function findTime(text) {
  const m = text.match(TIME_RE);
  return m ? `${m[1].padStart(2, '0')}:${m[2] ?? m[3] ?? '00'}` : '';
}

/** Primeira linha de "Detalhes:" quando parece um nome (o ManyChat pergunta o nome primeiro). */
function nameFromDetails(text) {
  const first = text.match(/^\s*detalhes\s*:\s*([^\n]+)/im)?.[1]?.trim() ?? '';
  return /^[A-Za-zÀ-ú' ]{2,40}$/.test(first) && first.split(/\s+/).length <= 4 ? first : '';
}

/** Local escrito livremente: a linha logo depois do horário (ordem das perguntas do ManyChat) ou uma frase com "na casa", "no salão"... */
function loosePlace(text) {
  const lines = text.split('\n').map((line) => line.replace(/^\s*detalhes\s*:\s*/i, '').trim());
  const timeLine = lines.findIndex((line) => TIME_RE.test(line));
  const next = timeLine >= 0 ? lines[timeLine + 1] : '';
  if (next && next.length <= 80 && !TIME_RE.test(next) && !/\d\s*anos?\b/i.test(next) && !findDate(next)) return next;
  const phrase = text.match(new RegExp(`(?:^|\\s)((?:na|no|em)\\s+(?:minha\\s+|nossa\\s+)?(?:${PLACE_WORDS})(?:\\s|$)[^\\n;]*)`, 'i'))
    ?? text.match(/(?:^|\s)((?:rua|avenida|av\.|r\.)\s[^\n;]*)/i);
  return phrase?.[1] ?? '';
}

/** Deixa o local como vai na arte: sem "Será", sem CEP e sem UF; "minha casa" vira "Na casa do <nome>". */
function tidyPlace(raw, name) {
  if (/\b(?:minha|nossa)\s+casa\b|^(?:ser[aá]\s+)?em\s+casa\b/i.test(raw)) return name ? `Na casa do ${name}` : clean(raw);
  const place = raw.trim()
    .replace(/^(?:ser[aá]|vai\s+ser|fica|é)\s+/i, '')
    .replace(/^(?:n[oa]s?|em)\s+(?!casa\b)/i, '')
    .replace(/\s+(?:[àa]s|dia|no dia|a partir)\s+\d.*$/i, '') // "na casa do Yuri às 15h" → "na casa do Yuri"
    .replace(/[\s,–-]*\b\d{5}-?\d{3}\b/g, '');
  return clean(clean(place).replace(new RegExp(`\\s*[-–,/]\\s*(?:${UFS})$`), ''));
}

/**
 * Leitura automática dos campos da arte. `eventDate` (Date) entra só se o texto não tiver data.
 * Campos não encontrados voltam vazios, para o administrador preencher.
 */
export function parseInviteFields(order, eventDate = null) {
  const content = typeof order?.content === 'string' ? order.content.replace(/\r\n/g, '\n') : '';
  const name = extractBirthdayPerson(order) ?? nameFromDetails(content);
  const age = content.match(/\b(\d{1,2})\s*(?:anos?|aninhos?)\b/i)?.[1] ?? '';
  let date = findDate(content);
  if (!date && eventDate instanceof Date && !Number.isNaN(eventDate.getTime())) {
    const [day, month] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'numeric' })
      .format(eventDate).split('/').map(Number);
    date = `${day} de ${MONTHS[month - 1]}`;
  }
  const labeledPlace = content.match(/(?:local|endere[cç]o)(?:\s+da\s+festa)?\s*:\s*([^\n]+)/i)?.[1];
  const rawPlace = labeledPlace ?? loosePlace(content);
  return { name, age, date, time: findTime(content), place: rawPlace ? tidyPlace(rawPlace, name) : '' };
}

/** Texto final de cada campo, em maiúsculas. Idade só com números vira "5 ANOS" / "1 ANO". */
export function inviteLines(fields) {
  const up = (s) => String(s ?? '').trim().toLocaleUpperCase('pt-BR');
  const age = String(fields.age ?? '').trim();
  return {
    name: up(fields.name),
    age: /^\d+$/.test(age) ? `${age} ${age === '1' ? 'ANO' : 'ANOS'}` : up(age),
    date: up(fields.date),
    time: up(fields.time),
    place: up(fields.place),
  };
}
