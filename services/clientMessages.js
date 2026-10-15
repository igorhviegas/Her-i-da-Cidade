// Mensagens prontas de WhatsApp para o cliente (reativação e pedido de avaliação). Só monta o link wa.me: nunca envia sozinho,
// quem decide e aperta "enviar" é o administrador (mesmo padrão da entrega em services/digitalDelivery.js).
import { whatsappPhone } from './digitalDelivery.js';

/** Página de avaliação do Google do negócio (Place ID calculado do link do Maps; confirmado pela API de avaliações em produção). */
export const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJy3FDqKRFEAgRrjxdWLGX1Gk';

/** Primeiro nome com a inicial maiúscula; vazio se não houver nome. "maria clara silva" → "Maria". */
export function firstName(name) {
  const first = String(name ?? '').trim().split(/\s+/)[0] ?? '';
  return first ? first.charAt(0).toLocaleUpperCase('pt-BR') + first.slice(1).toLocaleLowerCase('pt-BR') : '';
}

const greeting = (name) => { const first = firstName(name); return first ? `Oi, ${first}!` : 'Oi!'; };

/** Cliente cuja última compra foi há 10 a 14 meses (perto do próximo aniversário). */
export function reactivationMessage(name) {
  return [
    `${greeting(name)} Tudo bem? 🕷️`,
    'Aqui é o Homem-Aranha, do Herói da Cidade.',
    'Faz um tempinho desde a nossa última festa e fiquei pensando: já vem aniversário por aí? 🥳',
    'Se quiser, preparo uma surpresa especial para o seu pequeno herói!',
  ].join('\n');
}

/** Depois da entrega: pedido de avaliação com o link do Google. `childName` é opcional. */
export function reviewRequestMessage(name, childName) {
  const child = String(childName ?? '').trim();
  return [
    `${greeting(name)} 🕷️`,
    `Aqui é o Homem-Aranha! Espero que ${child ? `o ${child}` : 'o seu pequeno herói'} tenha gostado da surpresa 🥰`,
    'Se puder, deixe uma avaliação para a gente no Google? Leva 1 minutinho e ajuda muito:',
    GOOGLE_REVIEW_URL,
    'Obrigado! 🤟🏻',
  ].join('\n');
}

/** Link wa.me com a mensagem, ou null se o telefone for inválido. */
export function buildClientWhatsAppUrl(whatsapp, message) {
  const phone = whatsappPhone(whatsapp);
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;
}
