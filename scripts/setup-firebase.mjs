import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { seedServices, INITIAL_SERVICES } from './seed-services.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Utilitário simples para carregar variáveis de arquivo .env ou .env.local se existirem
function loadEnvFile(envPath) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0 && !process.env[key.trim()]) {
          process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    });
  }
}

loadEnvFile(path.join(rootDir, '.env'));
loadEnvFile(path.join(rootDir, '.env.local'));

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('====================================================');
  console.log(`  FIREBASE ENVIRONMENT SETUP ${isDryRun ? '[MODO DRY RUN]' : ''}`);
  console.log('====================================================\n');

  // 1. AUTENTICAÇÃO DA FERRAMENTA & LOCALIZAÇÃO DE CREDENCIAIS
  let credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let serviceAccountContent = null;

  if (!credPath) {
    // Procura por arquivo de service account local na raiz ou em credentials/
    const candidates = [
      path.join(rootDir, 'firebase-service-account.json'),
      path.join(rootDir, 'credentials', 'firebase-service-account.json')
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        credPath = cand;
        process.env.GOOGLE_APPLICATION_CREDENTIALS = cand;
        break;
      }
    }
  }

  if (!credPath || !fs.existsSync(credPath)) {
    console.error('❌ [ERRO DE CREDENCIAIS] Credencial de Service Account não configurada ou arquivo não encontrado.');
    console.error('\nPara executar o setup, configure a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS.');
    console.error('\nNo Windows (PowerShell):');
    console.error('  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\caminho\\para\\firebase-service-account.json"');
    console.error('\nNo Windows (CMD):');
    console.error('  set GOOGLE_APPLICATION_CREDENTIALS=C:\\caminho\\para\\firebase-service-account.json');
    console.error('\nNo Linux/macOS:');
    console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/caminho/para/firebase-service-account.json"\n');
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(credPath, 'utf-8');
    serviceAccountContent = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ [ERRO] Falha ao ler ou interpretar o arquivo de credenciais em '${credPath}':`, err.message);
    process.exit(1);
  }

  // 2. PROJECT ID RESOLUTION & VALIDATION
  const projectId = serviceAccountContent.project_id || process.env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId || typeof projectId !== 'string' || projectId.trim() === '' || projectId.includes('YOUR_')) {
    console.error('❌ [ERRO DE CONFIGURAÇÃO] Não foi possível determinar o Project ID do Firebase com segurança.');
    console.error('Por favor, garanta que a Service Account possui o campo "project_id" válido ou configure a variável VITE_FIREBASE_PROJECT_ID.');
    console.error('O script foi interrompido para evitar alterações em um projeto indefinido.\n');
    process.exit(1);
  }

  console.log(`✓ Project ID identificado com segurança: [${projectId}]`);
  console.log(`✓ Credencial utilizada: ${credPath}`);

  // Inicializa o Firebase Admin SDK
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountContent),
      projectId: projectId
    });
  }

  const db = admin.firestore();

  // 3. DEPLOY DAS FIRESTORE RULES
  console.log('\n--- 1. Publicação de Segurança (Firestore Rules) ---');
  const rulesPath = path.join(rootDir, 'firestore.rules');

  if (!fs.existsSync(rulesPath)) {
    console.error(`❌ [ERRO] Arquivo 'firestore.rules' não foi encontrado na raiz do projeto (${rulesPath}).`);
    process.exit(1);
  }

  if (isDryRun) {
    console.log(`  [DRY RUN] O deploy do arquivo 'firestore.rules' seria executado para o projeto '${projectId}'.`);
  } else {
    try {
      console.log(`  Publicando firestore.rules no projeto '${projectId}' via Firebase CLI...`);
      execSync(`npx -y firebase-tools deploy --only firestore:rules --project ${projectId}`, {
        cwd: rootDir,
        stdio: 'inherit'
      });
      console.log(`  ✓ Security Rules publicadas com sucesso!`);
    } catch (err) {
      console.warn(`  ⚠️ [AVISO] Falha ao publicar Security Rules automaticamente via CLI.`);
      console.warn(`  Certifique-se de ter feito login no Firebase CLI ('firebase login') ou ter permissão no projeto.`);
      console.warn(`  Mensagem do erro: ${err.message}`);
    }
  }

  // 4. CONFIGURAÇÃO IDEMPOTENTE DO ADMINISTRADOR INICIAL
  console.log('\n--- 2. Configuração do Administrador Inicial ---');
  const adminEmail = (process.env.FIREBASE_ADMIN_EMAIL || 'igorhviegas@gmail.com').trim();
  console.log(`  Buscando usuário administrador no Firebase Auth com e-mail: '${adminEmail}'...`);

  let adminUid = null;
  try {
    const userRecord = await admin.auth().getUserByEmail(adminEmail);
    adminUid = userRecord.uid;
    console.log(`  ✓ Usuário localizado no Auth! UID: ${adminUid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.warn(`  ⚠️ [AVISO] O e-mail '${adminEmail}' ainda não foi cadastrado no Firebase Authentication.`);
      console.warn(`  Crie a conta deste usuário no Firebase Console ou via login público para vincular a role de administrador.`);
    } else {
      console.error(`  ❌ Erro ao buscar usuário no Auth:`, err.message);
    }
  }

  if (adminUid) {
    const adminDocRef = db.collection('admins').doc(adminUid);
    const adminDocSnap = await adminDocRef.get();

    if (adminDocSnap.exists) {
      console.log(`  [OK] Documento 'admins/${adminUid}' já existe no Firestore. Dados administradores preservados.`);
    } else {
      if (isDryRun) {
        console.log(`  [CREATE - DRY RUN] Documento 'admins/${adminUid}' seria criado no Firestore.`);
      } else {
        await adminDocRef.set({
          uid: adminUid,
          email: adminEmail,
          role: 'superadmin',
          active: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`  [CREATED] Documento 'admins/${adminUid}' criado com sucesso no Firestore!`);
      }
    }
  }

  // 5. POPULAÇÃO IDEMPOTENTE DOS SERVIÇOS
  const servicesResult = await seedServices(db, isDryRun);

  // 6. VALIDAÇÃO FINAL E RESUMO DE EXECUÇÃO
  console.log('\n====================================================');
  console.log(`  RESUMO DA DE INICIALIZAÇÃO ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log('====================================================');
  console.log(`  Projeto Firebase : ${projectId}`);
  console.log(`  Firestore Rules  : ${isDryRun ? 'Simulado (OK)' : 'Processado'}`);
  console.log(`  Admin User Email : ${adminEmail}`);
  console.log(`  Admin Document   : ${adminUid ? `admins/${adminUid} [OK]` : 'Pendente (Criar usuário no Auth)'}`);
  console.log(`  Serviços Criados : ${servicesResult.created}`);
  console.log(`  Serviços Mantidos: ${servicesResult.existing}`);
  console.log('====================================================');

  if (isDryRun) {
    console.log('\nℹ️ Modo Dry Run finalizado. Nenhuma alteração foi realizada no Firestore.');
  } else {
    console.log('\n✅ Setup do Firebase concluído com sucesso!');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ [FALHA NO SETUP DO FIREBASE]', err);
  process.exit(1);
});
