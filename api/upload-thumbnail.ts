import { put } from '@vercel/blob';
import { getVercelOidcToken } from '@vercel/oidc';
import crypto from 'crypto';
import multer from 'multer';
import type { Request, Response } from 'express';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const BLOB_STORE_ID = process.env.BLOB_STORE_ID || 'store_ZlySBsEZT51qmJ7I';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID || '(default)';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

function detectImageMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function extensionFor(mimetype: string): string {
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  return 'jpg';
}

async function verifyFirebaseIdToken(idToken: string): Promise<string | null> {
  if (!FIREBASE_API_KEY) throw new Error('Firebase API key não configurada.');

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );

  if (response.status === 400 || response.status === 401) return null;
  if (!response.ok) throw new Error('Firebase Authentication indisponível.');

  const result = await response.json() as { users?: Array<{ localId?: string }> };
  return result.users?.[0]?.localId || null;
}

async function isAdminInFirestore(idToken: string, uid: string): Promise<boolean> {
  if (!FIREBASE_PROJECT_ID) throw new Error('Firebase project ID não configurado.');

  const documentUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}` +
    `/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/admins/${encodeURIComponent(uid)}`;
  const response = await fetch(documentUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (response.status === 403 || response.status === 404) return false;
  if (!response.ok) throw new Error('Firestore indisponível.');
  return true;
}

async function authorizeAdminRequest(req: Request): Promise<'unauthenticated' | 'forbidden' | 'authorized'> {
  const authorization = req.headers.authorization;
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return 'unauthenticated';

  const idToken = match[1];
  const uid = await verifyFirebaseIdToken(idToken);
  if (!uid) return 'unauthenticated';

  return await isAdminInFirestore(idToken, uid) ? 'authorized' : 'forbidden';
}

function jsonError(res: Response, status: number, error: string): void {
  res.status(status).json({ success: false, error });
}

async function getUploadOptions(mimetype: string) {
  // O token é obtido somente no runtime da Vercel. Não aceite tokens enviados
  // pelo navegador e não exponha credenciais no bundle do frontend.
  let oidcToken: string | undefined;
  try {
    oidcToken = await getVercelOidcToken();
  } catch {
    // Em desenvolvimento local o SDK usa BLOB_READ_WRITE_TOKEN, quando existir.
    // Em produção a integração do Blob fornece o token OIDC automaticamente.
  }

  return {
    access: 'public' as const,
    contentType: mimetype,
    storeId: BLOB_STORE_ID,
    ...(oidcToken ? { oidcToken } : {}),
  };
}

/**
 * Endpoint Node da Vercel/Express. O runtime de Functions entrega req/res
 * Node; portanto o multipart precisa ser consumido por multer antes do put.
 */
export function handleThumbnailUpload(req: Request, res: Response): void {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    jsonError(res, 405, 'Método não permitido.');
    return;
  }

  void (async () => {
    let authorization: 'unauthenticated' | 'forbidden' | 'authorized';
    try {
      authorization = await authorizeAdminRequest(req);
    } catch {
      jsonError(res, 500, 'Não foi possível validar a autorização do upload.');
      return;
    }

    if (authorization === 'unauthenticated') {
      jsonError(res, 401, 'Autenticação necessária.');
      return;
    }
    if (authorization === 'forbidden') {
      jsonError(res, 403, 'Somente administradores podem enviar imagens.');
      return;
    }

    upload.single('file')(req, res, async (parseError) => {
    if (parseError) {
      const message = parseError instanceof multer.MulterError && parseError.code === 'LIMIT_FILE_SIZE'
        ? 'O arquivo excede o limite máximo permitido de 4 MB.'
        : 'Não foi possível processar o arquivo enviado.';
      jsonError(res, 400, message);
      return;
    }

    const file = req.file;
    if (!file?.buffer) {
      jsonError(res, 400, 'Nenhum arquivo de imagem foi enviado.');
      return;
    }
    const detectedMimeType = detectImageMimeType(file.buffer);
    if (!detectedMimeType || !ALLOWED_MIME_TYPES.has(detectedMimeType) || file.mimetype !== detectedMimeType) {
      jsonError(res, 400, 'Formato de arquivo não suportado. Formatos aceitos: JPG, JPEG, PNG e WEBP.');
      return;
    }

    const purpose = req.body?.purpose;
    if (purpose !== undefined && purpose !== 'services' && purpose !== 'service-image') {
      jsonError(res, 400, 'Tipo de imagem não suportado.');
      return;
    }
    const blobFolder = purpose === 'services' || purpose === 'service-image' ? 'services/images' : 'videos/thumbnails';

    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        jsonError(res, 500, 'Não foi possível concluir o upload da imagem. Tente novamente.');
      }
    }, 25_000);

    try {
      const pathname = `${blobFolder}/${crypto.randomUUID()}.${extensionFor(file.mimetype)}`;
      const blob = await put(pathname, file.buffer, await getUploadOptions(file.mimetype));
      if (!res.headersSent) res.status(201).json({ success: true, url: blob.url });
    } catch (error) {
      console.error('[upload-thumbnail] Falha no Vercel Blob:', error);
      if (!res.headersSent) {
        jsonError(res, 500, 'Não foi possível enviar a imagem. Tente novamente.');
      }
    } finally {
      clearTimeout(timeout);
    }
    });
  })();
}

export default handleThumbnailUpload;
