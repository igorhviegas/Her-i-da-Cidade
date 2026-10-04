// Envio manual de pedidos de evento ao Google Agenda (Calendar API v3, conta de serviço). Só servidor.
// Fica fora de api/ pelo mesmo motivo de firebase-admin.js. Sem dependências novas: o JWT é assinado com node:crypto.
//
// Reutilizável por um futuro módulo de calendário: nada aqui conhece React/Kanban; recebe pedido + cliente e devolve o evento.
// Idempotência: o ID do evento é derivado do ID do pedido (hc + sha1 em hexadecimal, alfabeto permitido pelo Google), então
// reenviar o mesmo pedido atualiza o mesmo evento — mesmo se o vínculo não tiver sido gravado no pedido.

import { createHash, createSign } from 'node:crypto';

export const TIME_ZONE = 'America/Sao_Paulo';
export const EVENT_DURATION_MINUTES = 60;
/** Cor "Tangerina" da paleta de eventos do Google Agenda. */
export const TANGERINE_COLOR_ID = '6';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3/calendars';

const MESSAGES = {
  not_configured: 'Google Agenda não configurado no servidor (credenciais ou ID da agenda ausentes).',
  invalid_credentials: 'As credenciais do Google Agenda configuradas no servidor são inválidas.',
  invalid_order: 'Dados do pedido insuficientes para criar o evento (verifique cliente, data e horário).',
  auth: 'O Google recusou a autenticação do servidor. Revise a conta de serviço configurada.',
  permission: 'Sem permissão para editar a agenda. Compartilhe-a com a conta de serviço com permissão "Fazer alterações em eventos".',
  calendar_not_found: 'Agenda não encontrada. Confira o ID da agenda e se ela foi compartilhada com a conta de serviço.',
  rate_limited: 'O Google limitou as requisições. Tente novamente em instantes.',
  unavailable: 'Não foi possível falar com o Google Agenda agora. Tente novamente.',
  api_error: 'O Google Agenda recusou a operação.',
};

export class GoogleCalendarError extends Error {
  constructor(code, detail) { super(MESSAGES[code] ?? MESSAGES.api_error); this.name = 'GoogleCalendarError'; this.code = code; this.detail = detail; }
}

// ---------- conteúdo do evento (puro) ----------

const toJsDate = (value) => (value instanceof Date ? value : typeof value?.toDate === 'function' ? value.toDate() : value ? new Date(value) : null);
const brl = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

/** Data do evento ('YYYY-MM-DD') no fuso de Brasília. O pedido guarda a data ao meio-dia, então qualquer fuso do navegador cai no mesmo dia. */
export function eventDateKey(value) {
  const date = toJsDate(value);
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const brDate = (key) => key.split('-').reverse().join('/');

/** Início + duração como horário local de parede (sem conversão de fuso: o Google aplica `timeZone`). */
export function eventTimes(dateKey, time, minutes = EVENT_DURATION_MINUTES) {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const end = new Date(Date.UTC(y, mo - 1, d, h, mi + minutes));
  const pad = (n) => String(n).padStart(2, '0');
  const local = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`;
  return { start: `${dateKey}T${time}:00`, end: local(end) };
}

/** `Evento {#formulário}: {Cliente} - {nome da criança}`, só com os valores preenchidos. */
export const eventTitle = (order, client) => `Evento ${order.eventForm.formType}: ${client.name} - ${order.childName}`;

export function whatsappMessage(order, client) {
  const { eventTime, location } = order.eventForm;
  return [
    'Hoje é um dia espetacular!!🤩',
    '',
    `Olá ${client.name}, bom dia! Aqui é o Vitor, tudo bem?😊`,
    '',
    `Sou o Vitor, agente que acompanhará o Homem Aranha para o aniversário do ${order.childName} 🕸️🕷️`,
    '',
    'Me confirme alguns dados, por gentileza:',
    '',
    `O horário de início da nossa participação será às ${eventTime} e o endereço é no: ${location}`,
    '',
    'Qualquer coisa que precisar, estou a disposição! Pode me mandar mensagem ou me ligar!🥰🙏',
    '',
    'Te enviaremos mensagem assim que chegarmos!😉',
  ].join('\n');
}

/** Número com DDI 55 (cadastro do cliente já traz o normalizado; aceita também o texto digitado). null se inválido. */
export function whatsappPhone(client) {
  const digits = String(client.whatsappNormalized || client.whatsapp || '').replace(/\D/g, '');
  const phone = /^55\d{10,11}$/.test(digits) ? digits : /^\d{10,11}$/.test(digits) ? `55${digits}` : null;
  return phone;
}

export function whatsappLink(order, client) {
  const phone = whatsappPhone(client);
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage(order, client))}` : null;
}

/** Descrição enxuta (com emojis para leitura rápida): contato, autorização de imagem, teia extra, observações e o link de WhatsApp. */
export function eventDescription(order, client) {
  const f = order.eventForm;
  const link = whatsappLink(order, client);
  return [
    `👤 Cliente: ${client.name}`,
    `📱 WhatsApp: ${client.whatsapp}`,
    `📸 Autorização do uso de imagem: ${f.imageAuthorization ? 'Sim' : 'Não'}`,
    `🕸️ Teia extra: ${f.extraWeb ? f.extraWeb : 'Não'}`,
    `📝 Observações: ${f.observations || '—'}`,
    '',
    '💬 Abrir conversa com a mensagem pronta:',
    link || '⚠️ Link indisponível: o WhatsApp do cliente não é um número válido.',
  ].join('\n');
}

/** Corpo do evento para a Calendar API. Lança invalid_order se faltar algo que o título/horário exigem. */
export function buildCalendarEvent(order, client) {
  const f = order?.eventForm;
  const dateKey = eventDateKey(order?.eventDate);
  if (!f || !client?.name || !order.childName || !f.formType || !f.location || !dateKey || !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.eventTime ?? '')) {
    throw new GoogleCalendarError('invalid_order');
  }
  const { start, end } = eventTimes(dateKey, f.eventTime);
  return {
    status: 'confirmed',
    colorId: TANGERINE_COLOR_ID,
    summary: eventTitle(order, client),
    location: f.location,
    description: eventDescription(order, client),
    start: { dateTime: start, timeZone: TIME_ZONE },
    end: { dateTime: end, timeZone: TIME_ZONE },
  };
}

/** ID do evento no Google: 'hc' + sha1(pedido) em hexadecimal (a-v e 0-9 são os caracteres aceitos). */
export const calendarEventId = (orderId) => `hc${createHash('sha1').update(String(orderId)).digest('hex')}`;

// ---------- autenticação (conta de serviço) ----------

function parseCredentials(env) {
  let text = String(env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY || env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!text) return null;
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1).trim();
  if (!text.startsWith('{')) {
    const decoded = Buffer.from(text, 'base64').toString('utf8').trim();
    if (decoded.startsWith('{')) text = decoded;
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new GoogleCalendarError('invalid_credentials'); }
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const privateKey = (parsed.private_key || parsed.privateKey)?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new GoogleCalendarError('invalid_credentials');
  return { clientEmail, privateKey };
}

const b64url = (input) => Buffer.from(input).toString('base64url');
let cachedToken = null; // { token, expiresAt, email }

/** Token de acesso (cacheado até 1 min antes de expirar). O conteúdo da chave e do token nunca vai para logs nem erros. */
export async function getAccessToken({ env = process.env, fetchImpl = fetch, now = Date.now() } = {}) {
  const creds = parseCredentials(env);
  if (!creds) throw new GoogleCalendarError('not_configured');
  if (cachedToken && cachedToken.email === creds.clientEmail && cachedToken.expiresAt - 60_000 > now) return cachedToken.token;
  const iat = Math.floor(now / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: creds.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }))}`;
  let signature;
  try { signature = createSign('RSA-SHA256').update(unsigned).sign(creds.privateKey, 'base64url'); } catch { throw new GoogleCalendarError('invalid_credentials'); }
  let response;
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    });
  } catch { throw new GoogleCalendarError('unavailable'); }
  if (response.status === 400 || response.status === 401) throw new GoogleCalendarError('auth');
  if (!response.ok) throw new GoogleCalendarError(response.status === 429 ? 'rate_limited' : 'unavailable');
  const body = await response.json().catch(() => null);
  if (!body?.access_token) throw new GoogleCalendarError('auth');
  cachedToken = { token: body.access_token, expiresAt: now + (Number(body.expires_in) || 3600) * 1000, email: creds.clientEmail };
  return cachedToken.token;
}

export const resetTokenCache = () => { cachedToken = null; };

// ---------- criar / atualizar ----------

function failureFor(status) {
  if (status === 401) return 'auth';
  if (status === 403) return 'permission';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unavailable';
  return 'api_error';
}

/**
 * Cria ou atualiza o evento do pedido. Retorna só o que o Google confirmou: { eventId, htmlLink, created, calendarId }.
 * PUT no ID determinístico atualiza (e reativa um evento que tenha sido apagado na agenda); 404 -> cria com esse mesmo ID.
 */
export async function syncOrderToCalendar({ orderId, order, client, env = process.env, fetchImpl = fetch, now }) {
  const calendarId = String(env.GOOGLE_CALENDAR_ID || '').trim();
  if (!calendarId) throw new GoogleCalendarError('not_configured');
  const resource = buildCalendarEvent(order, client);
  const token = await getAccessToken({ env, fetchImpl, now });
  const eventId = calendarEventId(orderId);
  const base = `${API}/${encodeURIComponent(calendarId)}/events`;
  const call = async (method, url, body) => {
    try {
      return await fetchImpl(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch { throw new GoogleCalendarError('unavailable'); }
  };
  const confirmed = async (response, created) => {
    const data = await response.json().catch(() => null);
    if (!data?.id) throw new GoogleCalendarError('api_error');
    return { eventId: data.id, htmlLink: data.htmlLink, created, calendarId };
  };

  let response = await call('PUT', `${base}/${eventId}`, resource);
  if (response.ok) return confirmed(response, false);
  if (response.status !== 404) throw new GoogleCalendarError(failureFor(response.status));

  response = await call('POST', base, { ...resource, id: eventId });
  if (response.ok) return confirmed(response, true);
  if (response.status === 404) throw new GoogleCalendarError('calendar_not_found');
  if (response.status === 409) { // criado por outra requisição entre o PUT e o POST: atualiza esse mesmo evento
    response = await call('PUT', `${base}/${eventId}`, resource);
    if (response.ok) return confirmed(response, false);
  }
  throw new GoogleCalendarError(failureFor(response.status));
}
