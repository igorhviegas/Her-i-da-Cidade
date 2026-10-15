// Imagens do site que ficavam em endereços temporários de hospedagem (*.edgeone.app) e agora são servidas pelo próprio domínio
// (public/images/site, WebP). Documentos antigos do Firestore (serviços e seções da home) ainda guardam a URL antiga:
// localImageUrl() troca pelo arquivo local usando o NOME do arquivo, então funciona mesmo se o subdomínio for outro.

const BY_FILE = {
  'Aniversário.jpeg': '/images/site/servico-aniversario.webp',
  'Chamada.jpeg': '/images/site/servico-chamada.webp',
  'Personalizado.jpeg': '/images/site/servico-personalizado.webp',
  'Convite.jpeg': '/images/site/servico-convite.webp',
  'Temático.jpeg': '/images/site/servico-tematico.webp',
  'Presencial.jpeg': '/images/site/servico-presencial.webp',
  'WhatsApp Image 2026-01-08 at 15.00.34.jpeg': '/images/site/hero.webp',
  'profissional 1.jpeg': '/images/site/sobre.webp',
};

/** URL do edgeone conhecida → caminho local; qualquer outra URL (ou valor não textual) volta igual. */
export function localImageUrl(url) {
  if (typeof url !== 'string') return url;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('.edgeone.app')) return url;
    const file = decodeURIComponent(parsed.pathname.split('/').pop() ?? '').normalize('NFC');
    return BY_FILE[file] ?? url;
  } catch {
    return url;
  }
}
