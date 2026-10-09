import test from 'node:test';
import assert from 'node:assert/strict';
import { handleKartPdfUpload, isPdf } from '../api/upload-kart-pdf.ts';

const fakeRes = () => {
  const res = { statusCode: 0, body: null, ended: false };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; res.done?.(); return res; };
  res.end = () => { res.ended = true; res.done?.(); return res; };
  return res;
};
const call = (req) => new Promise((resolve) => { const res = fakeRes(); res.done = () => resolve(res); handleKartPdfUpload(req, res); });

test('isPdf: só aceita arquivo que começa com %PDF-', () => {
  assert.equal(isPdf(Buffer.from('%PDF-1.7 ...')), true);
  assert.equal(isPdf(Buffer.from('<html>')), false);
  assert.equal(isPdf(Buffer.alloc(0)), false);
});

test('upload do PDF da corrida: só POST e só com login de administrador', async () => {
  assert.equal((await call({ method: 'GET', headers: {} })).statusCode, 405);
  assert.equal((await call({ method: 'OPTIONS', headers: {} })).statusCode, 204);
  const anonymous = await call({ method: 'POST', headers: {} });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(anonymous.body.success, false);
});
