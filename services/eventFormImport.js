// Leitura do texto do "Formulário da Missão" (Google Forms impresso em PDF). Sem I/O: recebe o texto já extraído (services/pdfExtract.js).
// Limite conhecido: opções de rádio/caixa marcadas (tipo do evento, PCD, autorização de imagem, teias extras) são desenho no PDF, não texto;
// por isso essas respostas NÃO são lidas e continuam manuais. Seções de vídeo só existem no PDF quando o cliente as encomendou.

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// pdf.js às vezes parte ligaduras ("con fi rmar"), o que não atrapalha o que lemos, mas limpamos o ruído de URL/rodapé de impressão.
const isNoise = (line) => /^https?:\/\//.test(line) || /^\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}\s/.test(line);

export function toIsoDate(text) {
  const m = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/.exec(text ?? '');
  if (!m) return '';
  const [d, mo, y] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function toTime(text) {
  const m = /^(\d{1,2})\s*:\s*(\d{2})$/.exec((text ?? '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return '';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** Idade completa em anos em `on` (ambos 'YYYY-MM-DD'); '' se faltar data ou for negativa. */
export function ageOn(birthDate, on) {
  if (!birthDate || !on) return '';
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = on.split('-').map(Number);
  const age = y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
  return age >= 0 ? String(age) : '';
}

const HEADING = /^(dados d|possui alguma|data |hor[aá]rio|endere[cç]o|nome d|termos|clique aqui|autoriza|adicionais|lancamento|v[ií]deo|escolha o tipo|qual [eé] o primeiro)/i;

/** Valor de um campo: primeira linha depois do rótulo, pulando a explicação (termina em "?") e o placeholder (DD MM AAAA / Horário). */
function fieldValue(lines, labelPattern) {
  const at = lines.findIndex((l) => labelPattern.test(norm(l)));
  if (at < 0) return '';
  for (let i = at + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/\?$/.test(line) || /^(dd mm aaaa|hor[aá]rio)$/i.test(line)) continue;
    return HEADING.test(norm(line)) ? '' : line;
  }
  return '';
}

/**
 * Extrai os campos do formulário. Retorna só o que foi reconhecido (strings vazias = não encontrado):
 * { childName, birthDate, eventDate, eventTime, location, responsible, birthdayVideo: {firstName}|null, inviteVideo: {name, age, time, details}|null }
 */
export function parseGoogleEventForm(text) {
  const lines = String(text ?? '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !isNoise(l));
  if (!lines.some((l) => /formul[aá]rio da miss[aã]o/i.test(l))) return null;

  const birthdayName = fieldValue(lines, /^qual e o primeiro nome da sua crianca/);
  const out = {
    childName: fieldValue(lines, /^nome do aniversariante/),
    birthDate: toIsoDate(fieldValue(lines, /^data de nascimento/)),
    eventDate: toIsoDate(fieldValue(lines, /^data do evento/)),
    eventTime: toTime(fieldValue(lines, /^horario de inicio/)),
    location: fieldValue(lines, /^endereco do local/),
    responsible: fieldValue(lines, /^nome do responsavel/),
    birthdayVideo: birthdayName ? { firstName: birthdayName } : null,
    inviteVideo: null,
  };

  // Vídeo Convite: os rótulos (emoji + texto) vêm todos juntos e os valores logo depois, na mesma ordem; campos opcionais em branco somem.
  const last = lines.findIndex((l) => /fantasiado\)_?$/i.test(l));
  if (last >= 0) {
    const end = lines.findIndex((l, i) => i > last && /^o prazo para o envio/i.test(l));
    const v = lines.slice(last + 1, end < 0 ? undefined : end);
    if (v.length) {
      const take = (re) => (re.test(v[idx] ?? '') ? v[idx++] : '');
      let idx = 1;
      const age = take(/^\d{1,2}\s*anos?$/i);
      take(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
      const time = toTime(take(/^\d{1,2}\s*:\s*\d{2}$/));
      idx += 1; // local: o evento já tem o endereço
      out.inviteVideo = { name: v[0], age: age.replace(/\D/g, ''), time, details: v.slice(idx).join(' ') };
    }
  }
  return out;
}
