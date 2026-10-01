import type { Request, Response } from 'express';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { handleManyChatOrderRequest } from '../functions/manychat-handler.js';

let firestoreInstance: Firestore | null = null;

export function resetAdminFirestore(): void {
  firestoreInstance = null;
}

export interface ServiceAccountCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function parseServiceAccountCredentials(rawInput: string): ServiceAccountCredentials {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY vazia ou inválida.');
  }

  let cleaned = rawInput.trim();

  // Remove aspas externas delimitadoras residuais
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Detecta e decodifica Base64 se não começar diretamente com '{'
  if (!cleaned.startsWith('{')) {
    try {
      const decoded = Buffer.from(cleaned, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) {
        cleaned = decoded;
      }
    } catch {
      // Prossegue para a tentativa padrão de JSON.parse
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Falha ao decodificar JSON da FIREBASE_SERVICE_ACCOUNT_KEY.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY deve ser um objeto JSON.');
  }

  const projectId = (parsed.project_id || parsed.projectId) as string | undefined;
  const clientEmail = (parsed.client_email || parsed.clientEmail) as string | undefined;
  const rawKey = (parsed.private_key || parsed.privateKey) as string | undefined;

  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    throw new Error('Campo obrigatório project_id ausente na Service Account.');
  }

  if (!clientEmail || typeof clientEmail !== 'string' || !clientEmail.trim()) {
    throw new Error('Campo obrigatório client_email ausente na Service Account.');
  }

  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    throw new Error('Campo obrigatório private_key ausente na Service Account.');
  }

  // Normaliza quebras de linha escapadas (\n literal -> nova linha real)
  const privateKey = rawKey.replace(/\\n/g, '\n');

  return {
    projectId: projectId.trim(),
    clientEmail: clientEmail.trim(),
    privateKey,
  };
}

export function getAdminFirestore(): Firestore {
  if (firestoreInstance) return firestoreInstance;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firestoreInstance = getFirestore(existingApps[0]);
    return firestoreInstance;
  }

  const fallbackProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'heroi-da-cidade';

  // Opção 1: Chave de conta de serviço em JSON ou Base64
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const creds = parseServiceAccountCredentials(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    const app = initializeApp({
      credential: cert({
        projectId: creds.projectId,
        clientEmail: creds.clientEmail,
        privateKey: creds.privateKey,
      }),
      projectId: creds.projectId,
    });
    firestoreInstance = getFirestore(app);
    return firestoreInstance;
  }

  // Opção 2: Variáveis separadas (Email e Chave Privada)
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const app = initializeApp({
      credential: cert({
        projectId: fallbackProjectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
        privateKey,
      }),
      projectId: fallbackProjectId,
    });
    firestoreInstance = getFirestore(app);
    return firestoreInstance;
  }

  // Opção 3: Credenciais padrão do ambiente (Google ADC ou Emulador)
  const app = initializeApp({ projectId: fallbackProjectId });
  firestoreInstance = getFirestore(app);
  return firestoreInstance;
}

export async function handleManyChatWebhook(req: Request | any, res: Response | any) {
  // Normalização de resposta para compatibilidade universal (Vercel Serverless / Express)
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
      res.setHeader?.('Content-Type', 'application/json');
      res.end?.(JSON.stringify(payload));
      return normalizedRes;
    },
  };

  // Validação antecipada do método HTTP (não inicializa o banco em requisições GET)
  if (req.method !== 'POST') {
    normalizedRes.set('Cache-Control', 'no-store');
    return normalizedRes.status(405).json({
      ok: false,
      error: {
        code: 'method_not_allowed',
        message: 'Use POST.',
      },
      allowedMethods: ['POST'],
    });
  }

  const secret = process.env.MANYCHAT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[ManyChat Webhook] Segredo MANYCHAT_WEBHOOK_SECRET não configurado nas variáveis de ambiente.');
    return normalizedRes.status(500).json({
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
  } catch (err) {
    const errorName = err instanceof Error ? err.name : 'Error';
    const errorMessage = err instanceof Error ? err.message : String(err);
    const sanitizedMessage = errorMessage
      .replace(/-----BEGIN[^-]+-----/g, '[REDACTED_KEY_HEADER]')
      .replace(/-----END[^-]+-----/g, '[REDACTED_KEY_FOOTER]')
      .replace(/[A-Za-z0-9+/=]{40,}/g, '[REDACTED_TOKEN]');
    console.error(`[ManyChat Webhook] Falha ao inicializar Firebase Admin SDK (${errorName}): ${sanitizedMessage}`);
    return normalizedRes.status(500).json({
      ok: false,
      error: {
        code: 'database_unavailable',
        message: 'Não foi possível conectar ao banco de dados administrativo.',
      },
    });
  }

  // Normalização de request para compatibilidade universal
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

  return handleManyChatOrderRequest(normalizedReq, normalizedRes, {
    database: db,
    secret,
    logger: console,
  });
}

export default handleManyChatWebhook;
