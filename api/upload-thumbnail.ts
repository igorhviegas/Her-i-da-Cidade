import { put } from '@vercel/blob';
import { getVercelOidcToken } from '@vercel/oidc';
import crypto from 'crypto';
import multer from 'multer';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getSafeExtension(mimetype: string, originalname?: string): string {
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') return 'jpg';

  if (originalname) {
    const ext = originalname.split('.').pop()?.toLowerCase();
    if (ext === 'jpeg' || ext === 'jpg') return 'jpg';
    if (ext === 'png') return 'png';
    if (ext === 'webp') return 'webp';
  }

  return 'jpg';
}

// Multer em memória para compatibilidade com ambiente Express local (dev)
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Endpoint POST Web Standard para Vercel Serverless Functions.
 * Obtém explicitamente o token OIDC da Vercel via getVercelOidcToken() e envia ao Vercel Blob
 * direcionado ao repositório heroidacidade-thumb (BLOB_STORE_ID).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    let oidcToken: string;
    try {
      oidcToken = await getVercelOidcToken();
      if (!oidcToken) {
        throw new Error('Token OIDC indisponível no contexto atual.');
      }
    } catch (oidcErr: any) {
      console.error('[Vercel OIDC Error]: Falha ao obter token OIDC:', oidcErr?.message || oidcErr);
      return Response.json(
        { success: false, error: 'Falha ao autenticar com o serviço de armazenamento (OIDC).' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return Response.json(
        { success: false, error: 'Nenhum arquivo de imagem foi enviado.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const blobFile = file as Blob & { name?: string; size: number; type: string };

    if (!ALLOWED_MIME_TYPES.includes(blobFile.type)) {
      return Response.json(
        { success: false, error: 'Formato de arquivo não suportado. Formatos aceitos: JPG, JPEG, PNG e WEBP.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (blobFile.size > MAX_FILE_SIZE) {
      return Response.json(
        { success: false, error: 'O arquivo excede o limite máximo permitido de 4 MB.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const ext = getSafeExtension(blobFile.type, blobFile.name);
    const uniqueId = crypto.randomUUID();
    const pathname = `videos/thumbnails/${uniqueId}.${ext}`;

    const arrayBuffer = await blobFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const storeId = process.env.BLOB_STORE_ID || 'store_ZlySBsEZT51qmJ7I';

    // Upload via @vercel/blob com token OIDC explícito e storeId
    const blob = await put(pathname, buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: blobFile.type,
      oidcToken,
      storeId,
    });

    return Response.json(
      { success: true, url: blob.url },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[Upload Thumbnail POST Error]:', error?.message || error);
    return Response.json(
      { success: false, error: 'Falha ao processar upload da thumbnail.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * Preflight CORS para Web Standard.
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Handler padrão universal:
 * Suporta invocação como Vercel Function (Web Standard ou Node) e Express local.
 */
export default async function handler(req: any, res?: any) {
  // Caso 1: Web Standard Request (Vercel Serverless Function moderna)
  if (req instanceof Request || (req && typeof req.formData === 'function')) {
    if (req.method === 'OPTIONS') {
      return OPTIONS();
    }
    return POST(req as Request);
  }

  // Caso 2: Node.js / Express (ambiente de desenvolvimento local)
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    uploadMiddleware.any()(req, res, async (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: 'O arquivo excede o limite máximo permitido de 4 MB.' });
        }
        return res.status(400).json({ success: false, error: err.message || 'Erro ao processar envio do arquivo.' });
      }

      const files = req.files as Express.Multer.File[] | undefined;
      const file = files && files.length > 0 ? files[0] : (req.file as Express.Multer.File | undefined);

      if (!file || !file.buffer) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo de imagem foi enviado.' });
      }

      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ success: false, error: 'Formato de arquivo não suportado. Formatos aceitos: JPG, JPEG, PNG e WEBP.' });
      }

      if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ success: false, error: 'O arquivo excede o tamanho máximo de 4 MB.' });
      }

      let oidcToken: string;
      try {
        oidcToken = await getVercelOidcToken();
        if (!oidcToken) {
          throw new Error('Token OIDC indisponível no contexto atual.');
        }
      } catch (oidcErr: any) {
        console.error('[Vercel OIDC Error]: Falha ao obter token OIDC:', oidcErr?.message || oidcErr);
        return res.status(500).json({ success: false, error: 'Falha ao autenticar com o serviço de armazenamento (OIDC).' });
      }

      try {
        const ext = getSafeExtension(file.mimetype, file.originalname);
        const uniqueId = crypto.randomUUID();
        const pathname = `videos/thumbnails/${uniqueId}.${ext}`;
        const storeId = process.env.BLOB_STORE_ID || 'store_ZlySBsEZT51qmJ7I';

        const blob = await put(pathname, file.buffer, {
          access: 'public',
          addRandomSuffix: true,
          contentType: file.mimetype,
          oidcToken,
          storeId,
        });

        return res.status(200).json({ success: true, url: blob.url });
      } catch (uploadErr: any) {
        console.error('[Upload Thumbnail Express Error]:', uploadErr?.message || uploadErr);
        return res.status(500).json({ success: false, error: 'Falha ao processar upload da thumbnail.' });
      }
    });
    return;
  }

  return new Response(JSON.stringify({ success: false, error: 'Ambiente de execução não suportado.' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export const handleThumbnailUpload = handler;
