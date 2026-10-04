// Firestore Admin para rotas /api, com as mesmas variáveis de ambiente do ManyChat.
// Fica fora de api/ de propósito: na Vercel, uma função de api/ que importa outra de api/ (./x.ts) falha ao carregar (FUNCTION_INVOCATION_FAILED).
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/** Aceita JSON ou Base64, com ou sem aspas externas. Nunca inclui o conteúdo da chave nas mensagens de erro. */
function parseServiceAccount(rawInput) {
  let text = String(rawInput ?? '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1).trim();
  if (!text.startsWith('{')) {
    const decoded = Buffer.from(text, 'base64').toString('utf8').trim();
    if (decoded.startsWith('{')) text = decoded;
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY inválida (JSON/Base64).'); }
  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const privateKey = (parsed.private_key || parsed.privateKey)?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY sem project_id, client_email ou private_key.');
  return { projectId, clientEmail, privateKey };
}

let instance = null;

export function getAdminFirestore(env = process.env) {
  if (instance) return instance;
  const existing = getApps();
  if (existing.length) return (instance = getFirestore(existing[0]));

  const fallbackProjectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || 'heroi-da-cidade';
  let options;
  if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const creds = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_KEY);
    options = { credential: cert(creds), projectId: creds.projectId };
  } else if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    options = {
      credential: cert({ projectId: fallbackProjectId, clientEmail: env.FIREBASE_CLIENT_EMAIL.trim(), privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }),
      projectId: fallbackProjectId,
    };
  } else {
    options = { projectId: fallbackProjectId }; // credenciais padrão do ambiente (ADC/emulador)
  }
  return (instance = getFirestore(initializeApp(options)));
}
