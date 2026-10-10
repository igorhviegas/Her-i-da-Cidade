import { logger } from '../lib/logger.js';
import { put } from '@vercel/blob';
import { getVercelOidcToken } from '@vercel/oidc';
import crypto from 'crypto';
import multer from 'multer';
import type { Request, Response } from 'express';
import { authorizeAdminRequest } from '../functions/admin-auth.js';
import { handleKartPdfUpload } from '../functions/kart-pdf-upload.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// A Vercel limita o corpo da requisição a 4,5 MB; 4 MB deixa folga para o multipart.
// ponytail: arquivos maiores exigiriam upload direto do navegador (handleUpload), que não aceita o OIDC usado aqui.
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const BLOB_STORE_ID = process.env.BLOB_STORE_ID || 'store_ZlySBsEZT51qmJ7I';

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

// Só formatos que o Safari do iPhone toca: MP3, M4A/MP4 (AAC) e WAV.
function detectAudio(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') return { mime: 'audio/mpeg', ext: 'mp3' };
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return { mime: 'audio/mpeg', ext: 'mp3' };
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return { mime: 'audio/mp4', ext: 'm4a' };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return { mime: 'audio/wav', ext: 'wav' };
  return null;
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
 * Upload para o Vercel Blob (somente administradores). Padrão: imagem (thumbnail de vídeo ou imagem de serviço);
 * `?kind=audio`: áudio do /agente-hdc; `?kind=kart-pdf`: PDF das corridas do /kart (rewrite /api/upload-kart-pdf em vercel.json). Fica em uma só função porque a Vercel limita o número de funções em api/.
 * Endpoint Node da Vercel/Express: o multipart precisa ser consumido por multer antes do put.
 */
export function handleThumbnailUpload(req: Request, res: Response): void {
  if (req.query?.kind === 'kart-pdf') { handleKartPdfUpload(req, res); return; }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    jsonError(res, 405, 'Método não permitido.');
    return;
  }

  const isAudio = req.query?.kind === 'audio';

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
      jsonError(res, 403, `Somente administradores podem enviar ${isAudio ? 'áudios' : 'imagens'}.`);
      return;
    }

    upload.single('file')(req, res, async (parseError) => {
      if (parseError) {
        const tooBig = parseError instanceof multer.MulterError && parseError.code === 'LIMIT_FILE_SIZE';
        jsonError(res, 400, !tooBig
          ? 'Não foi possível processar o arquivo enviado.'
          : isAudio
            ? 'O arquivo excede o limite de 4 MB. Comprima o áudio (MP3 128 kbps) ou use o campo de link.'
            : 'O arquivo excede o limite máximo permitido de 4 MB.');
        return;
      }

      const file = req.file;
      if (!file?.buffer) {
        jsonError(res, 400, isAudio ? 'Nenhum arquivo de áudio foi enviado.' : 'Nenhum arquivo de imagem foi enviado.');
        return;
      }

      if (isAudio) {
        const audio = detectAudio(file.buffer);
        if (!audio) { jsonError(res, 400, 'Formato não suportado. Formatos aceitos: MP3, M4A e WAV.'); return; }
        try {
          const blob = await put(`agente/audio/${crypto.randomUUID()}.${audio.ext}`, file.buffer, await getUploadOptions(audio.mime));
          if (!res.headersSent) res.status(201).json({ success: true, url: blob.url });
        } catch (error) {
          logger.error('[upload-audio] Falha no Vercel Blob:', error);
          if (!res.headersSent) jsonError(res, 500, 'Não foi possível enviar o áudio. Tente novamente.');
        }
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
        logger.error('[upload-thumbnail] Falha no Vercel Blob:', error);
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
