// Integração: executa servicesService.ts / siteConfigService.ts REAIS contra o Firestore Emulator
// (lib/firebase é trocado por um stub que usa o emulador; nada toca produção).
// Rodar com: npm run test:services-whatsapp
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const root = fileURLToPath(new URL('..', import.meta.url));
const PREFIX = 'Olá, gostaria de saber mais sobre os serviços do Herói da Cidade! Tenho interesse no ';
let env, db, tmp, svc;

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-da-cidade', firestore: { rules } });
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins/admin-user'), { enabled: true }); });
  db = env.authenticatedContext('admin-user').firestore();
  globalThis.__TEST_DB__ = db;

  tmp = await mkdtemp(join(tmpdir(), 'svc-wa-'));
  const entry = join(tmp, 'entry.ts');
  await writeFile(entry, `export * from ${JSON.stringify(join(root, 'services/servicesService.ts'))};\nexport * from ${JSON.stringify(join(root, 'services/siteConfigService.ts'))};\n`);
  const out = join(tmp, 'bundle.mjs');
  await build({
    entryPoints: [entry], outfile: out, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'error',
    external: ['firebase/*', 'react', 'react/*', 'lucide-react'],
    nodePaths: [join(root, 'node_modules')],
    plugins: [{
      name: 'stub-firebase-lib',
      setup(b) {
        b.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'stub', namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const db = globalThis.__TEST_DB__; export const auth = null;', loader: 'js' }));
      },
    }],
  });
  // O bundle fica em tmp: resolve firebase/react a partir do projeto copiando o import para dentro do repo.
  const inRepo = join(root, 'tests', '.bundle-services-whatsapp.mjs');
  await writeFile(inRepo, await readFile(out, 'utf8'));
  tmp = { dir: tmp, inRepo };
  const mod = await import(pathToFileURL(inRepo).href);
  svc = mod;
});

after(async () => {
  await env?.cleanup();
  if (tmp) { await rm(tmp.dir, { recursive: true, force: true }); await rm(tmp.inRepo, { force: true }); }
});

const setNumber = (url) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'siteConfig/public'), { whatsappUrl: url }));
const clearNumber = () => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'siteConfig/public'), {}));
const read = async (id) => (await getDoc(doc(db, 'services', id))).data();
const input = (title, extra = {}) => ({ title, price: 'R$ 10', description: 'd', imageUrl: 'https://x.test/i.png', category: 'Pronta entrega', ...extra });
const textOf = (u) => new URL(u).searchParams.get('text');

test('número ausente: criação sem link falha com mensagem clara e nada é salvo', async () => {
  await clearNumber();
  await assert.rejects(svc.createService(input('Sem número')), /número de WhatsApp padrão não está configurado/);
  await setNumber('https://wa.me/');
  await assert.rejects(svc.createService(input('Número inválido')), /não está configurado ou é inválido/);
});

test('criação sem link: gera com o número de siteConfig/public e grava source=auto', async () => {
  await setNumber('https://wa.me/5531999044206');
  const s = await svc.createService(input('Missão Digital: Vídeo & Cia 100%'));
  const data = await read(s.id);
  assert.equal(data.whatsappUrlSource, 'auto');
  assert.ok(data.whatsappUrl.startsWith('https://wa.me/5531999044206?text='));
  assert.equal(textOf(data.whatsappUrl), `${PREFIX}Missão Digital: Vídeo & Cia 100%`);
  assert.ok(!data.whatsappUrl.includes('+'));
});

test('criação com link manual válido é preservada; inválido é rejeitado', async () => {
  const manual = 'https://wa.me/5511988887777?text=oi';
  const s = await svc.createService(input('Manual', { whatsappUrl: manual }));
  assert.deepEqual([(await read(s.id)).whatsappUrl, (await read(s.id)).whatsappUrlSource], [manual, 'manual']);
  await assert.rejects(svc.createService(input('Ruim', { whatsappUrl: 'https://evil.com/x' })), /link do WhatsApp informado é inválido/);
});

test('edição: título alterado regenera; mesmo título e demais campos preservam o link', async () => {
  await setNumber('https://wa.me/5531999044206');
  const s = await svc.createService(input('Antes'));
  const before = (await read(s.id)).whatsappUrl;
  await svc.updateService(s.id, { title: 'Antes', price: 'R$ 99' });
  assert.equal((await read(s.id)).whatsappUrl, before);
  await svc.updateService(s.id, { active: false });
  assert.equal((await read(s.id)).whatsappUrl, before);
  await svc.updateService(s.id, { title: 'Depois' });
  const after = await read(s.id);
  assert.equal(textOf(after.whatsappUrl), `${PREFIX}Depois`);
  assert.equal(after.whatsappUrlSource, 'auto');
});

test('edição: link manual é preservado ao mudar o título', async () => {
  const manual = 'https://wa.me/5511988887777';
  const s = await svc.createService(input('M1', { whatsappUrl: manual }));
  await svc.updateService(s.id, { title: 'M2' });
  assert.equal((await read(s.id)).whatsappUrl, manual);
});

test('documento antigo (sem whatsappUrlSource): compatível', async () => {
  await setNumber('https://wa.me/5531999044206');
  const legacyUrl = `https://wa.me/5531999044206?text=${encodeURIComponent('Olá, gostaria de saber mais sobre os serviços do Heroi da Cidade! Tenho interesse no serviço: Legado')}`;
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'services/legacy'), { title: 'Legado', price: 'p', description: 'd', imageUrl: 'https://x.test/i.png', category: 'c', whatsappUrl: legacyUrl, active: true, order: 1 }));
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'services/legacy-custom'), { title: 'Custom', price: 'p', description: 'd', imageUrl: 'https://x.test/i.png', category: 'c', whatsappUrl: 'https://wa.me/5511977776666?text=VIP', active: true, order: 2 }));
  await svc.updateService('legacy', { price: 'novo' });
  assert.equal((await read('legacy')).whatsappUrl, legacyUrl, 'sem mudar título nada muda');
  await svc.updateService('legacy', { title: 'Legado 2' });
  assert.equal(textOf((await read('legacy')).whatsappUrl), `${PREFIX}Legado 2`);
  await svc.updateService('legacy-custom', { title: 'Custom 2' });
  assert.equal((await read('legacy-custom')).whatsappUrl, 'https://wa.me/5511977776666?text=VIP');
});

test('serviço interno não é alterado (edição nem sincronização)', async () => {
  const internal = await svc.ensureInternalContentService();
  await svc.updateService(internal.id, { price: 'R$ 0,00' });
  const d = await read(internal.id);
  assert.equal(d.whatsappUrl, '');
  assert.equal(d.whatsappUrlSource, undefined);
});

test('alterar o número padrão: sync atualiza só serviços auto (dryRun não grava)', async () => {
  await setNumber('https://wa.me/5531999044206');
  const auto = await svc.createService(input('Acompanha número'));
  const manual = await svc.createService(input('Fixo', { whatsappUrl: 'https://wa.me/5511988887777' }));
  const oldManualDoc = await read(manual.id);
  const oldLegacy = await read('legacy-custom');

  await setNumber('https://wa.me/5511900000000');
  const dry = await svc.syncAutoServiceWhatsAppUrls({ dryRun: true });
  assert.ok(dry.ids.includes(auto.id));
  assert.ok((await read(auto.id)).whatsappUrl.startsWith('https://wa.me/5531999044206'), 'dryRun não grava');

  const res = await svc.syncAutoServiceWhatsAppUrls();
  assert.ok(res.ids.includes(auto.id));
  const updated = await read(auto.id);
  assert.ok(updated.whatsappUrl.startsWith('https://wa.me/5511900000000?text='));
  assert.equal(textOf(updated.whatsappUrl), `${PREFIX}Acompanha número`);
  assert.equal((await read(manual.id)).whatsappUrl, oldManualDoc.whatsappUrl);
  assert.equal((await read('legacy-custom')).whatsappUrl, oldLegacy.whatsappUrl);
  assert.equal((await read('legacy')).whatsappUrlSource, 'auto' /* regenerado na edição de título acima */);
  assert.equal((await svc.syncAutoServiceWhatsAppUrls()).changed, 0, 'idempotente');
});

test('sync com número inválido falha sem gravar nada', async () => {
  await setNumber('https://wa.me/');
  await assert.rejects(svc.syncAutoServiceWhatsAppUrls(), /não está configurado ou é inválido/);
});

test('mensagem do Kanban: salva, recarrega, independe entre serviços, remove ao limpar; docs antigos seguem sem o campo', async () => {
  await setNumber('https://wa.me/5531999044206');
  const msg = 'Olá! 🕷️\nLinha 2 — “aspas” & 100%';
  const a = await svc.createService(input('Msg A', { deliveryMessage: msg }));
  const b = await svc.createService(input('Msg B'));
  assert.equal((await read(a.id)).deliveryMessage, msg);
  assert.equal((await read(b.id)).deliveryMessage, undefined);
  assert.equal(svc.mapDocToService(a.id, await read(a.id)).deliveryMessage, msg);
  assert.equal(svc.mapDocToService(b.id, await read(b.id)).deliveryMessage, undefined);

  await svc.updateService(b.id, { deliveryMessage: 'Só do B' });
  await svc.updateService(a.id, { price: 'R$ 11' }); // não mexer na mensagem quando não informada
  assert.equal((await read(a.id)).deliveryMessage, msg);
  assert.equal((await read(b.id)).deliveryMessage, 'Só do B');

  await svc.updateService(a.id, { deliveryMessage: '  \n ' });
  assert.equal('deliveryMessage' in (await read(a.id)), false, 'vazio remove o campo');
  assert.equal((await read(b.id)).deliveryMessage, 'Só do B');
  assert.equal((await read(a.id)).whatsappUrl.startsWith('https://wa.me/5531999044206?text='), true, 'link do serviço intacto');
});

test('dúvidas: salva, reordena, edita, remove; descarta itens incompletos; leitura pública; serviços sem dúvidas intactos', async () => {
  await setNumber('https://wa.me/5531999044206');
  const faq = [
    { id: 'a', title: 'Forma de pagamento', content: 'Pix ou cartão' },
    { id: 'b', title: 'Prazo de entrega', content: '7 dias úteis' },
    { id: 'c', title: 'Vazia', content: '  ' },
  ];
  const a = await svc.createService(input('Faq A', { faq }));
  const b = await svc.createService(input('Faq B'));
  assert.deepEqual((await read(a.id)).faq.map((i) => i.id), ['a', 'b'], 'item incompleto descartado');
  assert.equal('faq' in (await read(b.id)), false, 'serviço sem dúvidas não ganha o campo');
  assert.equal(svc.mapDocToService(b.id, await read(b.id)).faq, undefined);

  const stored = svc.mapDocToService(a.id, await read(a.id)).faq;
  await svc.updateService(a.id, { faq: [stored[1], { ...stored[0], title: 'Pagamento' }, { id: 'n', title: 'Roteiro', content: 'Novo' }] });
  assert.deepEqual((await read(a.id)).faq.map((i) => i.title), ['Prazo de entrega', 'Pagamento', 'Roteiro']);

  await svc.updateService(a.id, { price: 'R$ 12' }); // sem faq no update: não mexe
  assert.equal((await read(a.id)).faq.length, 3);

  const anonymous = env.unauthenticatedContext().firestore();
  assert.equal((await getDoc(doc(anonymous, 'services', a.id))).data().faq.length, 3, 'leitura pública');
  await assert.rejects(setDoc(doc(anonymous, 'services', a.id), { faq: [] }, { merge: true }), 'escrita pública negada');

  await svc.updateService(a.id, { faq: [] });
  assert.equal('faq' in (await read(a.id)), false, 'lista vazia remove o campo');
});
