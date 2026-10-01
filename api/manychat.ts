import type { Request, Response } from 'express';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { handleManyChatOrderRequest } from '../functions/manychat-handler.js';

let firestoreInstance: Firestore | null = null;

export function getAdminFirestore(): Firestore {
  if (firestoreInstance) return firestoreInstance;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firestoreInstance = getFirestore(existingApps[0]);
    return firestoreInstance;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'heroi-da-cidade';

  // Opção 1: Chave de conta de serviço completa em JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      const app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      firestoreInstance = getFirestore(app);
      return firestoreInstance;
    } catch {
      throw new Error('Falha ao decodificar FIREBASE_SERVICE_ACCOUNT_KEY.');
    }
  }

  // Opção 2: Variáveis separadas (Email e Chave Privada)
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const app = initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    firestoreInstance = getFirestore(app);
    return firestoreInstance;
  }

  // Opção 3: Credenciais padrão do ambiente (Google ADC ou Emulador)
  const app = initializeApp({ projectId });
  firestoreInstance = getFirestore(app);
  return firestoreInstance;
}

export async function handleManyChatWebhook(req: Request | any, res: Response | any) {
  const secret = process.env.MANYCHAT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[ManyChat Webhook] Segredo MANYCHAT_WEBHOOK_SECRET não configurado nas variáveis de ambiente.');
    return res.status(500).json({
      ok: false,
      error: {
        code: 'server_misconfigured',
        message: 'Serviço temporariamente indisponível. Configuração de segredo pendente no servidor.',
      },
    });
  }

  let db: Firestore;
  try {
    db = getAdminFirestore();
  } catch (_err) {
    console.error('[ManyChat Webhook] Falha ao inicializar Firebase Admin SDK.');
    return res.status(500).json({
      ok: false,
      error: {
        code: 'database_unavailable',
        message: 'Não foi possível conectar ao banco de dados administrativo.',
      },
    });
  }

  // Normalização de request/response para compatibilidade universal (Vercel Serverless / Express)
  const normalizedReq = {
    ...req,
    method: req.method,
    headers: req.headers,
    body: req.body,
    rawBody: req.rawBody,
    get: (headerName: string) => {
      if (typeof req.get === 'function') return req.get(headerName);
      const val = req.headers?.[headerName.toLowerCase()];
      return Array.isArray(val) ? val[0] : val;
    },
    is: (type: string) => {
      if (typeof req.is === 'function') return req.is(type);
      const contentType = req.headers?.['content-type'] || '';
      return contentType.includes(type);
    },
  };

  const normalizedRes = {
    ...res,
    set: (name: string, val: string) => {
      if (typeof res.set === 'function') res.set(name, val);
      else if (typeof res.setHeader === 'function') res.setHeader(name, val);
      return normalizedRes;
    },
    status: (code: number) => {
      if (typeof res.status === 'function') res.status(code);
      else res.statusCode = code;
      return normalizedRes;
    },
    json: (payload: unknown) => {
      if (typeof res.json === 'function') return res.json(payload);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
      return normalizedRes;
    },
  };

  return handleManyChatOrderRequest(normalizedReq, normalizedRes, {
    database: db,
    secret,
    logger: console,
  });
}

export default handleManyChatWebhook;
