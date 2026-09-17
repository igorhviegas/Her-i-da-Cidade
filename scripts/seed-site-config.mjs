import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const INITIAL_WHATSAPP_URL = 'https://wa.me/5531999044206';

export async function seedSiteConfig(dbInstance) {
  const db = dbInstance || admin.firestore();
  const configDocRef = db.collection('siteConfig').doc('public');

  const docSnap = await configDocRef.get();

  if (docSnap.exists) {
    const data = docSnap.data();
    console.log(`  ℹ️ Documento 'siteConfig/public' já existe. whatsappUrl atual: ${data.whatsappUrl}`);
    return {
      executed: false,
      whatsappUrl: data.whatsappUrl,
      message: "Documento 'siteConfig/public' já existe. Dados preservados sem alteração."
    };
  }

  const payload = {
    whatsappUrl: INITIAL_WHATSAPP_URL,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await configDocRef.set(payload);
  console.log(`  ✓ Documento 'siteConfig/public' criado com sucesso com a URL oficial: ${INITIAL_WHATSAPP_URL}`);

  return {
    executed: true,
    whatsappUrl: INITIAL_WHATSAPP_URL,
    message: "Documento 'siteConfig/public' inicializado com sucesso no Firestore."
  };
}

async function runStandalone() {
  if (process.argv[1] === __filename) {
    console.log('--- Inicializando siteConfig/public no Firestore ---');

    let credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath) {
      const candidates = [
        path.join(rootDir, 'firebase-service-account.json'),
        path.join(rootDir, 'credentials', 'firebase-service-account.json'),
        path.join(rootDir, '.firebase', 'heroi-da-cidade-service-account.json')
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          credPath = cand;
          break;
        }
      }
    }

    if (!credPath || !fs.existsSync(credPath)) {
      console.error('❌ Service Account não encontrada para execução de seed.');
      process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }

    await seedSiteConfig();
    console.log('Concluído.');
    process.exit(0);
  }
}

runStandalone().catch((err) => {
  console.error('Erro no seed de siteConfig:', err);
  process.exit(1);
});
