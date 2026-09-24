/**
 * Envia o arquivo de imagem selecionado no frontend para a rota da API (/api/upload-thumbnail),
 * a qual processa o envio seguro para o Vercel Blob e retorna a URL pública.
 */
export async function uploadThumbnailToVercelBlob(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch('/api/upload-thumbnail', {
      method: 'POST',
      body: formData,
    });
  } catch (netError: any) {
    throw new Error(`Não foi possível conectar ao endpoint de upload (/api/upload-thumbnail): ${netError?.message || 'Falha de conexão'}.`);
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch (_e) {
    throw new Error(`Falha no servidor ao processar upload (Código HTTP ${response.status}).`);
  }

  if (!response.ok || !data?.success || !data?.url) {
    const errorMessage = data?.error || `Falha no upload da thumbnail (HTTP ${response.status}).`;
    throw new Error(errorMessage);
  }

  return data.url;
}
