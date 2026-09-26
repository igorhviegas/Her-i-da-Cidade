import { auth } from '../lib/firebase';

/**
 * Envia o arquivo de imagem selecionado no frontend para a rota da API (/api/upload-thumbnail),
 * a qual processa o envio seguro para o Vercel Blob e retorna a URL pública.
 * Possui timeout de 25 segundos com AbortController para nunca travar a interface.
 */
async function uploadImageToVercelBlob(file: File, purpose?: 'services'): Promise<string> {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error('Faça login como administrador para enviar imagens.');
  }

  const idToken = await user.getIdToken();
  const formData = new FormData();
  formData.append('file', file);
  if (purpose) formData.append('purpose', purpose);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let response: Response;
  try {
    response = await fetch('/api/upload-thumbnail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
      signal: controller.signal,
    });
  } catch (netError: any) {
    clearTimeout(timeoutId);
    if (netError?.name === 'AbortError') {
      throw new Error('Tempo limite esgotado ao enviar a imagem (25s). Verifique sua conexão e tente novamente.');
    }
    throw new Error(`Não foi possível conectar ao endpoint de upload (/api/upload-thumbnail): ${netError?.message || 'Falha de conexão'}.`);
  } finally {
    clearTimeout(timeoutId);
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch (_e) {
    throw new Error(`Falha no servidor ao processar upload (Código HTTP ${response.status}).`);
  }

  if (!response.ok || !data?.success || !data?.url) {
    const assetLabel = purpose === 'services' ? 'imagem do serviço' : 'thumbnail';
    const errorMessage = data?.error || `Falha no upload da ${assetLabel} (HTTP ${response.status}).`;
    throw new Error(errorMessage);
  }

  return data.url;
}

export function uploadThumbnailToVercelBlob(file: File): Promise<string> {
  return uploadImageToVercelBlob(file);
}

export function uploadServiceImageToVercelBlob(file: File): Promise<string> {
  return uploadImageToVercelBlob(file, 'services');
}
