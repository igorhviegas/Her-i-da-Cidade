import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Função utilitária para gerar a URL inicial padrão do WhatsApp com base no título do serviço.
 */
export function buildDefaultServiceWhatsAppUrl(title) {
  const customMessage = `Olá, gostaria de saber mais sobre os serviços do Heroi da Cidade! Tenho interesse no serviço: ${title || ''}`;
  return `https://wa.me/5531999044206?text=${encodeURIComponent(customMessage)}`;
}

/**
 * Migração idempotente para preencher whatsappUrl nos serviços existentes no Firestore.
 * Regras:
 * - Se whatsappUrl já existe e não é vazia -> NÃO ALTERAR (preserva valor)
 * - Se não existe ou é vazia -> preenche com a URL oficial baseada no título
 * - NUNCA duplica documentos
 * - NUNCA apaga serviços
 */
export async function migrateServicesWhatsAppUrls(dbInstance, isDryRun = false) {
  const db = dbInstance || admin.firestore();
  console.log('\n--- Migração Idempotente de whatsappUrl nos Serviços ---');

  const snapshot = await db.collection('services').get();
  const summary = {
    total: snapshot.size,
    migrated: 0,
    preserved: 0
  };

  if (snapshot.empty) {
    console.log('  ℹ️ Nenhum serviço encontrado no Firestore para migrar.');
    return summary;
  }

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const currentWhatsapp = data.whatsappUrl;

    if (currentWhatsapp && typeof currentWhatsapp === 'string' && currentWhatsapp.trim().length > 0) {
      summary.preserved++;
      console.log(`  [PRESERVADO] services/${docSnap.id} ('${data.title}') já possui WhatsApp: ${currentWhatsapp}`);
      continue;
    }

    const defaultUrl = buildDefaultServiceWhatsAppUrl(data.title);

    if (isDryRun) {
      console.log(`  [SIMULAÇÃO] services/${docSnap.id} ('${data.title}') receberia: ${defaultUrl}`);
    } else {
      await docSnap.ref.update({
        whatsappUrl: defaultUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  ✓ [MIGRADO] services/${docSnap.id} ('${data.title}') atualizado com: ${defaultUrl}`);
    }
    summary.migrated++;
  }

  console.log('-------------------------------------------------------');
  console.log(`  Resumo: ${summary.total} serviços analisados | ${summary.migrated} migrados | ${summary.preserved} preservados.`);
  console.log('-------------------------------------------------------\n');

  return summary;
}

async function runStandalone() {
  if (process.argv[1] === __filename) {
    const isDryRun = process.argv.includes('--dry-run');

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
      console.error('❌ Service Account não encontrada para migração.');
      process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }

    await migrateServicesWhatsAppUrls(admin.firestore(), isDryRun);
    process.exit(0);
  }
}

runStandalone().catch((err) => {
  console.error('❌ Erro na migração dos serviços:', err);
  process.exit(1);
});
