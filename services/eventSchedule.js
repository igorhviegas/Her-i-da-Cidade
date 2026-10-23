// Viabilidade de horários de um dia de eventos (docs/deslocamento.md). Puro: recebe os minutos de cada trecho (Routes API) e
// devolve quando sair, a folga entre eventos e a previsão de chegada em casa. Horários = minutos desde a meia-noite.

/** Folgas padrão (min): chegar antes no 1º evento (saindo de casa), chegar antes nos seguintes, e organizar o carro após cada evento. */
export const DEFAULT_BUFFERS = { first: 35, next: 30, after: 10 };

/** 'HH:MM' -> minutos, ou null se inválido. */
export function parseTime(text) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(text ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Minutos -> 'HH:MM' (passou da meia-noite: 'HH:MM (dia seguinte)'). */
export function formatTime(minutes) {
  const day = Math.floor(minutes / 1440);
  const inDay = ((minutes % 1440) + 1440) % 1440;
  const text = `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`;
  return day > 0 ? `${text} (dia seguinte)` : text;
}

/**
 * `stops` = eventos em ordem de horário [{label, start, end}]; `legs` = minutos de cada trecho de
 * casa → 1º, entre eventos, último → casa e (se houver) casa → casa do Vitor.
 * O 1º evento sempre cabe (basta sair mais cedo); os seguintes precisam de: fim anterior + organização + trajeto + folga ≤ início.
 */
export function planDay(stops, legs, buffers = DEFAULT_BUFFERS) {
  const rows = stops.map((stop, i) => {
    const travel = legs[i].minutes;
    if (i === 0) return { ...stop, travel, leaveAt: stop.start - buffers.first - travel, slack: null, ok: true };
    const leaveAt = stops[i - 1].end + buffers.after;
    const slack = stop.start - buffers.next - (leaveAt + travel);
    return { ...stop, travel, leaveAt, slack, ok: slack >= 0 };
  });
  const homeAt = stops[stops.length - 1].end + buffers.after + legs[stops.length].minutes;
  const vitorAt = legs[stops.length + 1] ? homeAt + legs[stops.length + 1].minutes : null;
  return { rows, homeAt, vitorAt, feasible: rows.every((r) => r.ok) };
}

/** Mensagens "chegamos" (editáveis em Admin → Agente → Mensagens): `self` = do dono, `vitor` = do Vitor. Variáveis: {evento} {hora} {previsao}. */
export const DEFAULT_MESSAGES = {
  self: 'Oi, amor! Já chegamos no evento ({evento}), às {hora}. 🕷️\nPrevisão de chegada em casa depois de todos os eventos: ~{previsao}.\nSe mudar alguma coisa eu te aviso!',
  vitor: 'Oi, amor! Já chegamos no evento ({evento}), às {hora}. 🕷️\nPrevisão de chegada em casa depois de todos os eventos: ~{previsao}.\nSe mudar alguma coisa eu te aviso!',
};
export const MESSAGE_VARIABLES = ['{evento}', '{hora}', '{previsao}'];
export const MAX_MESSAGE_LENGTH = 1000;

/** Documento salvo -> { self, vitor } (texto vazio ou inválido volta ao padrão). */
export function normalizeMessages(data) {
  const pick = (value, fallback) => (typeof value === 'string' && value.trim() ? value.slice(0, MAX_MESSAGE_LENGTH) : fallback);
  return { self: pick(data?.self, DEFAULT_MESSAGES.self), vitor: pick(data?.vitor, DEFAULT_MESSAGES.vitor) };
}

/** Troca as variáveis do modelo pelos valores (variável desconhecida fica como foi escrita). */
export function renderMessage(template, values) {
  return String(template).replace(/{(evento|hora|previsao)}/g, (_, key) => values[key] ?? '');
}

/** Duração padrão (min) do evento por pacote na conta de horários; o dono pode trocar na tela. */
export const PACKAGE_MINUTES = { aniversario: 60, visita: 30, vip: 90 };
