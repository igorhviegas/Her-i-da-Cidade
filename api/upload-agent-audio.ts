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

async function getUploadOptions(mimetype: string) {
  // Token OIDC só no runtime da Vercel; em dev local o SDK usa BLOB_READ_WRITE_TOKEN, se existir.
  let oidcToken: string | undefined;
  try { oidcToken = await getVercelOidcToken(); } catch { /* sem OIDC fora da Vercel */ }
  return { access: 'public' as const, contentType: mimetype, storeId: BLOB_STORE_ID, ...(oidcToken ? { oidcToken } : {}) };
}

// A Vercel limita o corpo da requisição a 4,5 MB; 4 MB deixa folga para o multipart.
// ponytail: arquivos maiores exigiriam upload direto do navegador (handleUpload), que não aceita o OIDC usado aqui.
const MAX_FILE_SIZE = 4 * 1024 * 1024;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE, files: 1 } });

// Só formatos que o Safari do iPhone toca: MP3, M4A/MP4 (AAC) e WAV.
function detectAudio(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') return { mime: 'audio/mpeg', ext: 'mp3' };
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return { mime: 'audio/mpeg', ext: 'mp3' };
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return { mime: 'audio/mp4', ext: 'm4a' };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return { mime: 'audio/wav', ext: 'wav' };
  return null;
}

/** Upload de áudio do /agente-hdc (somente administradores): envia ao Vercel Blob e devolve a URL pública. */
export function handleAgentAudioUpload(req: Request, res: Response): void {
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
    if (authorization === 'forbidden') { jsonError(res, 403, 'Somente administradores podem enviar áudios.'); return; }

    upload.single('file')(req, res, async (parseError) => {
      if (parseError) {
        jsonError(res, 400, parseError instanceof multer.MulterError && parseError.code === 'LIMIT_FILE_SIZE'
          ? 'O arquivo excede o limite de 4 MB. Comprima o áudio (MP3 128 kbps) ou use o campo de link.'
          : 'Não foi possível processar o arquivo enviado.');
        return;
      }
      const file = req.file;
      if (!file?.buffer) { jsonError(res, 400, 'Nenhum arquivo de áudio foi enviado.'); return; }
      const audio = detectAudio(file.buffer);
      if (!audio) { jsonError(res, 400, 'Formato não suportado. Formatos aceitos: MP3, M4A e WAV.'); return; }

      try {
        const blob = await put(`agente/audio/${crypto.randomUUID()}.${audio.ext}`, file.buffer, await getUploadOptions(audio.mime));
        if (!res.headersSent) res.status(201).json({ success: true, url: blob.url });
      } catch (error) {
        console.error('[upload-agent-audio] Falha no Vercel Blob:', error);
        if (!res.headersSent) jsonError(res, 500, 'Não foi possível enviar o áudio. Tente novamente.');
      }
    });
  })();
}

export default handleAgentAudioUpload;
