import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { X509Certificate, createSign } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { handleAlexa, isValidCertUrl, verifyAlexaRequest } from '../api/alexa.ts';
import { extractDueDate, extractTime, handleAlexaEnvelope, missionIdFor } from '../functions/missions-alexa.js';

const SKILL = 'amzn1.ask.skill.test';
const USER = 'amzn1.ask.account.TESTUSER';
const config = { skillId: SKILL, allowedUserIds: [USER] };
// Quinta-feira, 2026-10-01 12:00 em Brasília.
const NOW = new Date('2026-10-01T15:00:00Z');

function fakeDb() {
  const docs = new Map();
  return {
    docs,
    collection: () => ({ doc: (id) => ({ id, create: async (data) => {
      if (docs.has(id)) throw Object.assign(new Error('exists'), { code: 6 });
      docs.set(id, data);
    } }) }),
  };
}

const envelope = (slots = {}, { requestId = 'req-1', intent = 'CriarMissaoIntent', user = USER, skill = SKILL, type = 'IntentRequest' } = {}) => ({
  session: { application: { applicationId: skill }, user: { userId: user } },
  request: { type, requestId, timestamp: NOW.toISOString(), intent: { name: intent, slots: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, { name: k, value: v }])) } },
});
const run = (env, db = fakeDb()) => handleAlexaEnvelope(env, { database: db, config, now: NOW, logger: { warn() {}, error() {} } }).then((out) => ({ out, db }));
const speech = (out) => out.response.outputSpeech.text;

test('extractDueDate: reconhece hoje/amanhã/dia da semana só nas pontas e não inventa o resto', () => {
  assert.deepEqual(extractDueDate('pagar a conta amanhã', '2026-10-01'), { title: 'pagar a conta', date: '2026-10-02' });
  assert.deepEqual(extractDueDate('gravar três vídeos para depois de amanhã', '2026-10-01'), { title: 'gravar três vídeos', date: '2026-10-03' });
  assert.deepEqual(extractDueDate('revisar os pedidos na sexta-feira', '2026-10-01'), { title: 'revisar os pedidos', date: '2026-10-02' });
  assert.deepEqual(extractDueDate('sábado comprar pilhas', '2026-10-01'), { title: 'comprar pilhas', date: '2026-10-03' });
  assert.equal(extractDueDate('ir ao banco quinta', '2026-10-01').date, '2026-10-08'); // hoje é quinta: próxima, não hoje
  assert.deepEqual(extractDueDate('ligar para o amanhã bar e grill', '2026-10-01'), { title: 'ligar para o amanhã bar e grill', date: null });
  assert.deepEqual(extractDueDate('preparar o roteiro do próximo vídeo', '2026-10-01'), { title: 'preparar o roteiro do próximo vídeo', date: null });
});

test('cria missão com prazo pelo slot AMAZON.DATE (fim do dia em Brasília) e dificuldade padrão', async () => {
  const { out, db } = await run(envelope({ tarefa: 'gravar três vídeos', data: '2026-10-02' }));
  assert.match(speech(out), /Missão criada para 2 de outubro: Gravar três vídeos\./);
  assert.equal(out.response.shouldEndSession, true);
  const [mission] = db.docs.values();
  assert.equal(mission.title, 'Gravar três vídeos');
  assert.equal(mission.source, 'alexa');
  assert.equal(mission.status, 'pending');
  assert.equal(mission.difficulty, 3);
  assert.equal(mission.description, '');
  assert.ok(mission.dueAt instanceof Timestamp);
  assert.equal(mission.dueAt.toDate().toISOString(), '2026-10-03T02:59:59.999Z'); // 23:59:59.999 de 02/10 em Brasília
});

test('sem data: missão sem prazo; data dentro do texto da tarefa é extraída; hora combina com a data', async () => {
  let r = await run(envelope({ tarefa: 'preparar o roteiro do próximo vídeo' }));
  assert.match(speech(r.out), /sem prazo/);
  assert.equal('dueAt' in [...r.db.docs.values()][0], false);

  r = await run(envelope({ tarefa: 'pagar a conta amanhã' }));
  assert.equal([...r.db.docs.values()][0].title, 'Pagar a conta');
  assert.equal([...r.db.docs.values()][0].dueAt.toDate().toISOString(), '2026-10-03T02:59:59.999Z');

  r = await run(envelope({ tarefa: 'ligar para o cliente', data: '2026-10-02' }));
  assert.equal(r.db.docs.size, 1);
});

test('extractTime: horários falados em vários formatos, sem confundir "as 3 propostas"', () => {
  const t = (text) => extractTime(text);
  assert.deepEqual(t('ligar para o cliente às 15h'), { title: 'ligar para o cliente', time: '15:00' });
  assert.equal(t('ligar às 15:30').time, '15:30');
  assert.equal(t('ligar às 15h30').time, '15:30');
  assert.equal(t('ligar às 9 horas').time, '09:00');
  assert.equal(t('ligar às 3 da tarde').time, '15:00');
  assert.equal(t('ligar às três e meia da tarde').time, '15:30');
  assert.equal(t('ligar às 8 da manhã').time, '08:00');
  assert.equal(t('ligar às 10 e 15 da noite').time, '22:15');
  assert.equal(t('almoço com cliente ao meio-dia').time, '12:00');
  assert.equal(t('fechar caixa à meia-noite').time, '00:00');
  assert.equal(t('amanhã às 15h ligar').title, 'amanhã ligar');
  assert.equal(t('ligar às 25 horas').time, 'invalid');
  assert.deepEqual(t('revisar as 3 propostas'), { title: 'revisar as 3 propostas', time: null });
});

test('horário falado: com dia vira prazo exato; sem dia usa o próximo horário que chegar', async () => {
  // NOW = quinta 01/10 12:00 em Brasília
  let r = await run(envelope({ tarefa: 'ligar para o cliente amanhã às 15h30' }));
  assert.match(speech(r.out), /Missão criada para 2 de outubro às 15h30: Ligar para o cliente./);
  assert.equal([...r.db.docs.values()][0].dueAt.toDate().toISOString(), '2026-10-02T18:30:00.000Z');

  r = await run(envelope({ tarefa: 'ligar para o cliente às 3 da tarde' })); // 15:00 ainda não passou: hoje
  assert.match(speech(r.out), /1 de outubro às 15h/);
  assert.equal([...r.db.docs.values()][0].dueAt.toDate().toISOString(), '2026-10-01T18:00:00.000Z');

  r = await run(envelope({ tarefa: 'tomar remédio às 8 da manhã' })); // 08:00 já passou: amanhã
  assert.match(speech(r.out), /2 de outubro às 8h/);

  r = await run(envelope({ tarefa: 'ligar às 25 horas' }));
  assert.match(speech(r.out), /Não entendi o horário/);
  assert.equal(r.db.docs.size, 0);
});

test('pede esclarecimento em vez de gravar quando falta tarefa, a data é vaga ou há hora sem dia', async () => {
  for (const [slots, expected] of [
    [{}, /O que você quer/],
    [{ tarefa: 'revisar pedidos', data: '2026-W41' }, /Não entendi o dia/],
    [{ tarefa: 'x'.repeat(121) }, /longa demais/],
  ]) {
    const { out, db } = await run(envelope(slots));
    assert.match(speech(out), expected);
    assert.equal(out.response.shouldEndSession, false);
    assert.equal(db.docs.size, 0);
  }
  assert.equal((await run(envelope({}))).out.response.directives[0].type, 'Dialog.ElicitSlot');
});

test('reenvio do mesmo requestId não duplica; outro requestId cria nova missão', async () => {
  const db = fakeDb();
  const first = await run(envelope({ tarefa: 'pagar a conta' }, { requestId: 'a' }), db);
  const again = await run(envelope({ tarefa: 'pagar a conta' }, { requestId: 'a' }), db);
  assert.equal(db.docs.size, 1);
  assert.equal(speech(first.out), speech(again.out));
  await run(envelope({ tarefa: 'pagar a conta' }, { requestId: 'b' }), db);
  assert.equal(db.docs.size, 2);
  assert.notEqual(missionIdFor('a'), missionIdFor('b'));
});

test('autorização: skill ou usuário diferentes e usuário não cadastrado nunca gravam', async () => {
  for (const opts of [{ skill: 'amzn1.ask.skill.outra' }, { user: 'amzn1.ask.account.OUTRO' }]) {
    const { out, db } = await run(envelope({ tarefa: 'algo' }, opts));
    assert.match(speech(out), /não está autorizad|ainda não está autorizado/);
    assert.equal(db.docs.size, 0);
  }
  const db = fakeDb();
  const out = await handleAlexaEnvelope(envelope({ tarefa: 'algo' }), { database: db, config: { skillId: SKILL, allowedUserIds: [] }, now: NOW, logger: { warn() {}, error() {} } });
  assert.match(speech(out), /ainda não está autorizado/);
  assert.equal(db.docs.size, 0);
});

test('Launch, Help, Stop e SessionEnded não gravam nada', async () => {
  const db = fakeDb();
  assert.equal((await run(envelope({}, { type: 'LaunchRequest' }), db)).out.response.shouldEndSession, false);
  assert.equal((await run(envelope({}, { intent: 'AMAZON.HelpIntent' }), db)).out.response.shouldEndSession, false);
  assert.equal((await run(envelope({}, { intent: 'AMAZON.StopIntent' }), db)).out.response.shouldEndSession, true);
  assert.deepEqual((await run(envelope({}, { type: 'SessionEndedRequest' }), db)).out.response, {});
  assert.equal(db.docs.size, 0);
});

// ------------------------------------------------------------------ HTTP + assinatura

function response() {
  return { statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}

test('endpoint: só POST, exige ALEXA_SKILL_ID e rejeita sem assinatura válida antes de tocar no banco', async () => {
  const body = Buffer.from(JSON.stringify(envelope({ tarefa: 'algo' })));
  const db = fakeDb();
  const call = async (req, deps) => { const res = response(); await handleAlexa(req, res, { config, database: db, now: NOW, ...deps }); return res; };
  const post = (extra = {}) => ({ method: 'POST', headers: { 'signature-256': 'x', signaturecertchainurl: 'https://s3.amazonaws.com/echo.api/echo-api-cert.pem' }, rawBody: body, ...extra });

  assert.equal((await call({ ...post(), method: 'GET' })).statusCode, 405);
  assert.equal((await call(post(), { config: { allowedUserIds: [] } })).statusCode, 500);
  assert.equal((await call(post({ headers: {} }))).statusCode, 401);
  assert.equal((await call(post(), { verify: async () => false })).statusCode, 401);
  assert.equal(db.docs.size, 0);

  const ok = await call(post(), { verify: async () => true });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.body.response.outputSpeech.text, /Missão criada/);
  assert.equal(db.docs.size, 1);
});

test('isValidCertUrl: aceita só https://s3.amazonaws.com/echo.api/', () => {
  assert.equal(isValidCertUrl('https://s3.amazonaws.com/echo.api/echo-api-cert-7.pem'), true);
  assert.equal(isValidCertUrl('https://s3.amazonaws.com:443/echo.api/x.pem'), true);
  for (const bad of ['http://s3.amazonaws.com/echo.api/x.pem', 'https://s3.amazonaws.com.evil.com/echo.api/x.pem', 'https://s3.amazonaws.com/EcHo.aPi/x.pem',
    'https://s3.amazonaws.com:8443/echo.api/x.pem', 'https://s3.amazonaws.com/echo.api/../x.pem', 'https://user@s3.amazonaws.com/echo.api/x.pem', 'lixo']) {
    assert.equal(isValidCertUrl(bad), false, bad);
  }
});

test('verifyAlexaRequest: assinatura RSA-SHA256, SAN, validade e timestamp (certificado de teste gerado com openssl)', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'alexa-'));
  const gen = (name, san) => {
    try {
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, `${name}.key`), '-out', join(dir, `${name}.pem`), '-days', '30', '-subj', '/CN=test', '-addext', `subjectAltName=DNS:${san}`], { stdio: 'ignore' });
      return { cert: new X509Certificate(readFileSync(join(dir, `${name}.pem`))), key: readFileSync(join(dir, `${name}.key`)) };
    } catch { return null; }
  };
  const good = gen('good', 'echo-api.amazon.com');
  const wrongSan = gen('wrong', 'example.com');
  if (!good || !wrongSan) return t.skip('openssl indisponível');

  const REAL = new Date(); // o certificado de teste vale a partir do relógio real
  const body = Buffer.from(JSON.stringify({ request: { timestamp: REAL.toISOString(), requestId: "r", type: "LaunchRequest", intent: { slots: { tarefa: { value: "algo" } } } } }));
  const sign = (key, data = body) => createSign('RSA-SHA256').update(data).sign(key, 'base64');
  const url = 'https://s3.amazonaws.com/echo.api/echo-api-cert.pem';
  const verify = (sig, data, cert, now = REAL) => verifyAlexaRequest({ signature: sig, certUrl: url }, data, now, async () => [cert]);

  assert.equal(await verify(sign(good.key), body, good.cert), true);
  assert.equal(await verify(sign(good.key), Buffer.from(body.toString().replace('algo', 'outra')), good.cert), false); // corpo adulterado
  assert.equal(await verify(sign(wrongSan.key), body, wrongSan.cert), false); // SAN errado
  assert.equal(await verify(sign(wrongSan.key), body, good.cert), false); // assinado por outra chave
  assert.equal(await verify(sign(good.key), body, good.cert, new Date(REAL.getTime() + 151_000)), false); // timestamp velho
  assert.equal(await verify(sign(good.key), body, good.cert, new Date('2030-01-01T00:00:00Z')), false); // certificado vencido
  assert.equal(await verifyAlexaRequest({ signature: sign(good.key), certUrl: "https://evil.com/echo.api/x.pem" }, body, REAL, async () => [good.cert]), false);
});
