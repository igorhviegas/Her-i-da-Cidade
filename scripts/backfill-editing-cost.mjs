// Grava `editingCost` (R$ 25) nos pedidos de Vídeo Personalizado JÁ concluídos que ainda não têm o campo.
// Idempotente: não toca em pedidos que já têm editingCost. Por padrão apenas SIMULA; use --apply para gravar.
//   node scripts/backfill-editing-cost.mjs            (simulação)
//   node scripts/backfill-editing-cost.mjs --apply    (grava no Firestore do projeto da service account)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { editingCostFields } from '../services/financeCalculations.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || [
  'firebase-service-account.json', 'credentials/firebase-service-account.json', '.firebase/heroi-da-cidade-service-account.json',
].map((p) => path.join(rootDir, p)).find((p) => fs.existsSync(p));
if (!credPath || !fs.existsSync(credPath)) { console.error('❌ Service Account não encontrada.'); process.exit(1); }
const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });

const snapshot = await admin.firestore().collection('orders').where('serviceId', '==', '3').where('status', '==', 'completed').get();
let updated = 0; let skipped = 0;
for (const doc of snapshot.docs) {
  const fields = editingCostFields(doc.data().serviceId, doc.data());
  if (!fields.editingCost) { skipped += 1; continue; }
  if (apply) await doc.ref.update(fields);
  console.log(`${apply ? '✓ atualizado' : '[simulação]'} orders/${doc.id} → editingCost ${fields.editingCost}`);
  updated += 1;
}
console.log(`\nProjeto: ${serviceAccount.project_id} | concluídos: ${snapshot.size} | ${apply ? 'atualizados' : 'seriam atualizados'}: ${updated} | já com custo: ${skipped}`);
if (!apply) console.log('Nada foi gravado. Rode com --apply para gravar.');
process.exit(0);
