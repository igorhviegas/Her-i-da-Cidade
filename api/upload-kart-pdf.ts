import { logger } from '../lib/logger.js';
import { put } from '@vercel/blob';
import { getVercelOidcToken } from '@vercel/oidc';
import crypto from 'crypto';
import multer from 'multer';
import type { Request, Response } from 'express';
import { authorizeAdminRequest } from '../functions/admin-auth.js';

// Arquivos de api/ não podem importar outros de api/ (a função falha ao carregar na Vercel): helpers locais.
const BLOB_STORE_ID = process.env.BLOB_STORE_ID || 'store_ZlySBsEZT51qmJ7I';

function jsonError(res: Response, status: number, error: string): void {
  res.status(status).json({ success: false, error });
}

async function getUploadOptions() {
  // Token OIDC só no runtime da Vercel; em dev local o SDK usa BLOB_READ_WRITE_TOKEN, se existir.
  let oidcToken: string | undefined;
  try { oidcToken = await getVercelOidcToken(); } catch { /* sem OIDC fora da Vercel */ }
  return { access: 'public' as const, contentType: 'application/pdf', storeId: BLOB_STORE_ID, ...(oidcToken ? { oidcToken } : {}) };
}

// A Vercel limita o corpo da requisição a 4,5 MB; 4 MB deixa folga para o multipart (os relatórios do kartódromo têm ~150 KB).
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE, files: 1 } });

/** Todo PDF começa com "%PDF-". */
export const isPdf = (buffer: Buffer): boolean => buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-';

/** Upload do relatório original (PDF) de uma corrida do /kart, somente administradores: envia ao Vercel Blob e devolve a URL pública. */
export function handleKartPdfUpload(req: Request, res: Response): void {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { jsonError(res, 405, 'Método não permitido.'); return; }

  void (async () => {
    let authorization: 'unauthenticated' | 'forbidden' | 'authorized';
    try {
      authorization = await authorizeAdminRequest(req);
    } catch {
      jsonError(res, 500, 'Não foi possível validar a autorização do upload.');
      return;
    }
    if (authorization === 'unauthenticated') { jsonError(res, 401, 'Autenticação necessária.'); return; }
    if (authorization === 'forbidden') { jsonError(res, 403, 'Somente administradores podem enviar PDFs.'); return; }

    upload.single('file')(req, res, async (parseError) => {
      if (parseError) {
        jsonError(res, 400, parseError instanceof multer.MulterError && parseError.code === 'LIMIT_FILE_SIZE'
          ? 'O PDF excede o limite de 4 MB.'
          : 'Não foi possível processar o arquivo enviado.');
        return;
      }
      const file = req.file;
      if (!file?.buffer) { jsonError(res, 400, 'Nenhum arquivo foi enviado.'); return; }
      if (!isPdf(file.buffer)) { jsonError(res, 400, 'O arquivo não é um PDF.'); return; }

      try {
        const blob = await put(`kart/resultados/${crypto.randomUUID()}.pdf`, file.buffer, await getUploadOptions());
        if (!res.headersSent) res.status(201).json({ success: true, url: blob.url });
      } catch (error) {
        logger.error('[upload-kart-pdf] Falha no Vercel Blob:', error);
        if (!res.headersSent) jsonError(res, 500, 'Não foi possível enviar o PDF. Tente novamente.');
      }
    });
  })();
}

export default handleKartPdfUpload;
