// Datas e fusos do agendamento de Vídeo Chamada (puro: só Intl; roda no servidor e no navegador).
// A agenda do negócio é sempre a de Brasília. O fuso do cliente só muda como o horário é MOSTRADO a ele.
// Nada aqui soma ou subtrai horas fixas: toda conversão passa pelo banco de fusos do Intl (horário de verão, mudanças de regra).

export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

const formatters = new Map();
function formatterFor(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  }
  return formatters.get(timeZone);
}

/** Instante → data e hora de parede no fuso: { date: 'YYYY-MM-DD', time: 'HH:mm' }. */
export function wallTime(ms, timeZone = BUSINESS_TIME_ZONE) {
  const parts = Object.fromEntries(formatterFor(timeZone).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

const asUtc = (date, time) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour, minute);
};

/** Data e hora de parede no fuso → instante (ms). Duas correções bastam para atravessar uma troca de horário de verão. */
export function zonedInstant(date, time, timeZone = BUSINESS_TIME_ZONE) {
  const target = asUtc(date, time);
  let guess = target;
  for (let i = 0; i < 2; i += 1) {
    const wall = wallTime(guess, timeZone);
    guess += target - asUtc(wall.date, wall.time);
  }
  return guess;
}

/** Identificador IANA aceito pelo ambiente ("Europe/Lisbon", "UTC"). Deslocamentos ("-03:00") não servem: não carregam as regras do fuso. */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.length > 64 || !/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/.test(timeZone)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone }); return true; } catch { return false; }
}

/**
 * Um horário da agenda (Brasília) visto no fuso do cliente: { date, time, same }.
 * `same` = mesma data e hora de Brasília (ex.: quem está no Brasil ou em outro fuso com o mesmo horário): não há o que converter.
 */
export function localSlot(date, time, timeZone) {
  const local = wallTime(zonedInstant(date, time), timeZone);
  return { ...local, same: local.date === date && local.time === time };
}
