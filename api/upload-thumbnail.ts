import { put } from '@vercel/blob';
import { getVercelOidcToken } from '@vercel/oidc';
import crypto from 'crypto';
import multer from 'multer';
import type { Request, Response } from 'express';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const BLOB_STORE_ID = process.env.BLOB_STORE_ID || 'store_ZlySBsEZT51qmJ7I';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

function extensionFor(mimetype: string): string {
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  return 'jpg';
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
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      jsonError(res, 400, 'Formato de arquivo não suportado. Formatos aceitos: JPG, JPEG, PNG e WEBP.');
      return;
    }

    const purpose = req.body?.purpose;
    if (purpose !== undefined && purpose !== 'service-image') {
      jsonError(res, 400, 'Tipo de imagem não suportado.');
      return;
    }
    const blobFolder = purpose === 'service-image' ? 'services/images' : 'videos/thumbnails';

    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        jsonError(res, 504, 'Tempo limite esgotado ao enviar a imagem ao Vercel Blob. Tente novamente.');
      }
    }, 25_000);

    try {
      const pathname = `${blobFolder}/${crypto.randomUUID()}.${extensionFor(file.mimetype)}`;
      const blob = await put(pathname, file.buffer, await getUploadOptions(file.mimetype));
      if (!res.headersSent) res.status(201).json({ success: true, url: blob.url });
    } catch (error) {
      console.error('[upload-thumbnail] Falha no Vercel Blob:', error);
      if (!res.headersSent) {
        jsonError(res, 502, 'Não foi possível enviar a imagem ao Vercel Blob. Verifique a configuração do Blob Store e tente novamente.');
      }
    } finally {
      clearTimeout(timeout);
    }
  });
}

export default handleThumbnailUpload;
