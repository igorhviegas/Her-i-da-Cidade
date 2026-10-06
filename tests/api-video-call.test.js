import test from 'node:test';
import assert from 'node:assert/strict';
import { handleVideoCall } from '../api/video-call.ts';
import { GoogleCalendarError } from '../functions/google-calendar.js';
import { VideoCallError } from '../functions/video-call.js';
import { DEFAULT_VIDEO_CALL_CONFIG } from '../functions/video-call-config.js';

const response = () => ({ statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const call = async (req, deps) => { const res = response(); await handleVideoCall(req, res, { database: {}, expire: async () => 0, ...deps }); return res; };

test('GET devolve os horários livres; sem login e sem cache', async () => {
  const res = await call({ method: 'GET' }, { availability: async () => ({ days: [{ date: '2026-10-12', times: ['20:00'] }], config: DEFAULT_VIDEO_CALL_CONFIG }) });
  assert.deepEqual([res.statusCode, res.body.ok, res.body.days.length, res.headers['cache-control']], [200, true, 1, 'no-store']);
  assert.equal(res.body.config.priceLabel, 'R$ 75,00');
  assert.match(res.body.config.texts.confirm, /24h/);
  assert.equal(res.body.config.busyCalendarIds, undefined); // nada interno vai para o público
});

test('POST reserva e só diz ok com o resultado da reserva', async () => {
  const res = await call({ method: 'POST', body: { name: 'A' } }, { book: async ({ input }) => ({ orderId: 'o1', echoed: input.name }) });
  assert.deepEqual(res.body, { ok: true, booking: { orderId: 'o1', echoed: 'A' } });
});

test('horário tomado vira 409; falha do Google vira 503 sem vazar detalhes; método inválido 405', async () => {
  assert.equal((await call({ method: 'POST', body: {} }, { book: async () => { throw new VideoCallError('slot_unavailable', 'ocupado'); } })).statusCode, 409);
  const google = await call({ method: 'POST', body: {} }, { book: async () => { throw new GoogleCalendarError('permission'); } });
  assert.equal(google.statusCode, 503);
  assert.doesNotMatch(JSON.stringify(google.body), /permiss|conta de serviço/i);
  assert.equal((await call({ method: 'POST', body: {} }, { book: async () => { throw new Error('segredo interno'); } })).statusCode, 500);
  assert.equal((await call({ method: 'DELETE' }, {})).statusCode, 405);
});

test('reservas vencidas são limpas antes de responder; se a limpeza falhar, o agendamento segue', async () => {
  let ran = 0;
  const availability = async () => ({ days: [], config: DEFAULT_VIDEO_CALL_CONFIG });
  await call({ method: 'GET' }, { availability, expire: async () => { ran += 1; return 2; } });
  assert.equal(ran, 1);
  const res = await call({ method: 'POST', body: {} }, { book: async () => ({ orderId: 'o1' }), expire: async () => { throw new Error('firestore fora'); } });
  assert.deepEqual(res.body, { ok: true, booking: { orderId: 'o1' } });
});
