// Mamães em Collab (puro, sem Firebase/React): parceiras, cupons, comissões semanais, vagas de serviços e o formulário público.
// Datas da parceria são 'AAAA-MM-DD' no horário de Brasília (functions/missions-core.js).
//
// Cupom e comissão são coisas diferentes: o desconto (COLLAB_DISCOUNT) reduz o valor pago do pedido (totalPaid, então o faturamento é o
// que entrou no caixa); a comissão (COLLAB_COMMISSION) é custo, gravada no pedido (`collab.commission`) e contada na data de conclusão,
// como o custo de edição. Um pedido guarda uma única atribuição, então uma venda nunca gera duas comissões.

import { addDays, dateKey, parseDateKey, weekdayOf } from '../functions/missions-core.js';

export const PARTNERS = 'collabPartners';
export const PAYOUTS = 'collabPayouts';
/** Limites de vagas por serviço (editáveis no CRM). siteConfig: leitura e escrita só de administradores, exceto o documento 'public'. */
export const CONFIG_PATH = ['siteConfig', 'collab'];
export const FORM_PATH = '/mamaes-em-collab';

export const COLLAB_DISCOUNT = 5;
export const COLLAB_COMMISSION = 3;
export const COUPON_DAYS = 30;
export const PRODUCTION_DAYS = 15;
export const KEEP_DAYS = 30;
/** Aviso no painel de cupons quando faltam até estes dias. */
export const EXPIRING_DAYS = 7;

export const STATUSES = [
  ['prospect', 'Identificada'], ['contacted', 'Contatada'], ['form', 'Formulário recebido'], ['approved', 'Aprovada'],
  ['producing', 'Em produção'], ['review', 'Reel em aprovação'], ['published', 'Publicada'], ['closed', 'Encerrada'], ['cancelled', 'Cancelada'],
];
export const REEL_STATUSES = [['', 'Aguardando'], ['received', 'Recebido'], ['changes', 'Ajustes pedidos'], ['approved', 'Aprovado'], ['rejected', 'Rejeitado']];
export const CRITERIA = [
  ['followers', 'Mais de 1.000 seguidores'], ['maternity', 'Conteúdo de maternidade'], ['childAge', 'Filho(a) entre 2 e 8 anos'],
  ['follows', 'Segue o Herói da Cidade'], ['openProfile', 'Perfil aberto'],
];
/** Temas que não são um serviço concedido (a criadora recebe um benefício definido pela equipe). */
export const PROJECT_THEMES = ['Áudio gratuito', 'Vídeos do Instagram', 'Missão Digital', 'Plataforma de vídeos'];
/** Serviços com vagas no projeto (ids fixos do catálogo) e o limite inicial. */
export const GRANT_SERVICES = [
  { serviceId: '2', label: 'Vídeo Chamada', limit: 3 },
  { serviceId: '3', label: 'Vídeo Personalizado', limit: 4 },
  { serviceId: '4', label: 'Vídeo Convite', limit: 5 },
  { serviceId: '5', label: 'Vídeo Temático', limit: 10 },
  { serviceId: '1', label: 'Vídeo Especial de Aniversário', limit: 15 },
];

export const statusLabel = (id) => STATUSES.find(([value]) => value === id)?.[1] ?? 'Identificada';
const DAY_MS = 86_400_000;
const daysFrom = (from, to) => Math.round((Date.UTC(...ymd(to)) - Date.UTC(...ymd(from))) / DAY_MS);
const ymd = (key) => { const { year, month, day } = parseDateKey(key); return [year, month - 1, day]; };
const validKey = (key) => typeof key === 'string' && parseDateKey(key) !== null;
export const brDate = (key) => (validKey(key) ? key.split('-').reverse().slice(0, 2).join('/') : '');
export const money = (value) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

/** Código do cupom como é comparado: maiúsculas, sem acento, só letras e números (até 20). "mari 5" e "MARI5" são o mesmo cupom. */
export function normalizeCouponCode(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

/** @usuario do Instagram: minúsculas, sem @ nem link. */
export function normalizeInstagram(value) {
  const text = String(value ?? '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/^@/, '').split(/[/?#]/)[0];
  return /^[a-z0-9._]{1,30}$/.test(text) ? text : '';
}

// ---------- datas da parceria ----------

/** Prazos derivados das datas informadas (nada disso é gravado: mudar uma data recalcula tudo). */
export function partnerDeadlines(partner) {
  const conditions = validKey(partner?.conditionsAt) ? partner.conditionsAt : '';
  const reel = validKey(partner?.reelPublishedAt) ? partner.reelPublishedAt : '';
  return {
    productionDue: conditions ? addDays(conditions, PRODUCTION_DAYS) : '',
    couponUntil: reel ? addDays(reel, COUPON_DAYS) : '',
    keepUntil: reel ? addDays(reel, KEEP_DAYS) : '',
  };
}

/**
 * Situação do cupom em `today`: 'none' (sem código), 'waiting' (o Reel ainda não foi publicado), 'active' (até o 30º dia depois do Reel,
 * inclusive) ou 'expired'. daysLeft = dias até o fim (0 = vence hoje).
 */
export function couponState(partner, today) {
  if (!normalizeCouponCode(partner?.couponCode)) return { state: 'none', until: '', daysLeft: null };
  const { couponUntil } = partnerDeadlines(partner);
  if (!couponUntil || partner.reelPublishedAt > today) return { state: 'waiting', until: couponUntil, daysLeft: null };
  const daysLeft = daysFrom(today, couponUntil);
  return { state: daysLeft >= 0 ? 'active' : 'expired', until: couponUntil, daysLeft };
}

/** Painel de validade: cupons ativos primeiro (o que vence antes no topo), depois os aguardando o Reel e os vencidos. */
export function couponBoard(partners, today) {
  const order = { active: 0, waiting: 1, expired: 2 };
  return partners
    .map((partner) => ({ partner, ...couponState(partner, today) }))
    .filter((row) => row.state !== 'none')
    .sort((a, b) => order[a.state] - order[b.state] || (a.state === 'expired' ? b.daysLeft - a.daysLeft : (a.daysLeft ?? 0) - (b.daysLeft ?? 0)) || a.partner.name.localeCompare(b.partner.name, 'pt-BR'));
}

// ---------- atribuição da venda (webhook do ManyChat) ----------

/**
 * O que o pedido grava quando chega com cupom. `partner` = parceira dona do código (ou null), `pricing` = do serviço no webhook.
 * O desconto entra sempre que o serviço tem preço: a equipe já validou o cupom e cobrou o valor com desconto. Um cupom fora da validade
 * ou de parceira cancelada só gera aviso (o dono decide no painel se a comissão fica). Evento presencial não tem valor no pagamento:
 * fica só o registro, para o desconto ser abatido no valor do evento.
 */
export function couponAttribution(code, partner, today, pricing) {
  const base = { code, partnerId: partner?.id ?? null, discount: COLLAB_DISCOUNT, commission: partner ? COLLAB_COMMISSION : 0 };
  if (pricing === 'pending') return { ...base, discount: 0, commission: 0, warning: 'event' };
  if (!partner) return { ...base, warning: 'unknown' };
  if (partner.status === 'cancelled') return { ...base, warning: 'cancelled' };
  const { state } = couponState(partner, today);
  if (state === 'waiting') return { ...base, warning: 'not_started' };
  if (state === 'expired') return { ...base, warning: 'expired' };
  return base;
}

export const WARNING_LABELS = {
  unknown: 'Código não cadastrado: vincule a uma parceira ou deixe sem comissão.',
  expired: 'Cupom vencido (mais de 30 dias depois do Reel).',
  not_started: 'Cupom usado antes da publicação do Reel.',
  cancelled: 'Cupom de parceira cancelada.',
  event: 'Evento presencial: abata o desconto no valor do evento (sem comissão automática).',
};

/** Valor pago com o desconto do cupom (nunca negativo). */
export const discountedPrice = (price, discount) => Math.max(0, Math.round((price - discount) * 100) / 100);

// ---------- comissões ----------

/** Segunda-feira da semana de `key` (semana de segunda a domingo). */
export const weekStartOf = (key) => addDays(key, -((weekdayOf(key) + 6) % 7));
export const weekLabel = (weekKey) => `${brDate(weekKey)} a ${brDate(addDays(weekKey, 6))}`;
export const payoutId = (partnerId, weekKey) => `${partnerId}_${weekKey}`;

const toDate = (value) => (value instanceof Date ? value : typeof value?.toDate === 'function' ? value.toDate() : null);

/**
 * Vendas com comissão: pedidos concluídos com cupom de uma parceira e comissão > 0. A semana é a da conclusão (a mesma data do
 * faturamento); reabrir tira a venda da semana e concluir de novo a devolve, sem segunda comissão (o valor está no pedido).
 */
export function commissionSales(orders) {
  const sales = [];
  for (const order of orders) {
    const collab = order?.collab;
    if (order?.status !== 'completed' || !collab?.partnerId || !(collab.commission > 0)) continue;
    const completed = toDate(order.completedAt) ?? toDate(order.paidAt);
    if (!completed) continue;
    const day = dateKey(completed);
    sales.push({ orderId: order.id, partnerId: collab.partnerId, code: collab.code, serviceId: order.serviceId, day, weekKey: weekStartOf(day), commission: collab.commission });
  }
  return sales.sort((a, b) => a.day.localeCompare(b.day) || a.orderId.localeCompare(b.orderId));
}

/**
 * Comissões de uma semana por parceira. Venda já paga em qualquer semana (payout.orderIds) não volta como pendente, mesmo que a
 * conclusão tenha mudado de semana: assim a mesma venda nunca é paga duas vezes.
 */
export function weeklyCommissions(sales, payouts, weekKey) {
  const paidIn = new Map();
  for (const payout of payouts) for (const orderId of payout.orderIds ?? []) paidIn.set(orderId, payout);
  const groups = new Map();
  const group = (partnerId) => groups.get(partnerId) ?? groups.set(partnerId, { partnerId, pending: [], paid: [], pendingTotal: 0, paidTotal: 0 }).get(partnerId);
  for (const sale of sales) {
    const payout = paidIn.get(sale.orderId);
    if (payout ? payout.weekKey !== weekKey : sale.weekKey !== weekKey) continue;
    const g = group(sale.partnerId);
    if (payout) { g.paid.push(sale); g.paidTotal += sale.commission; } else { g.pending.push(sale); g.pendingTotal += sale.commission; }
  }
  return [...groups.values()];
}

/** Mensagem do relatório semanal para a criadora: só data, serviço e comissão (nenhum dado do cliente). */
export function weeklyReportMessage({ name, code, weekKey, sales, serviceName }) {
  const first = String(name ?? '').trim().split(/\s+/)[0] || 'tudo bem';
  const total = sales.reduce((sum, sale) => sum + sale.commission, 0);
  return [
    `Oi, ${first}! Aqui é do Herói da Cidade.`,
    `Resumo da nossa Collab na semana de ${weekLabel(weekKey)}:`,
    `${sales.length} venda(s) com o seu cupom ${code}:`,
    ...sales.map((sale) => `• ${brDate(sale.day)} · ${serviceName(sale.serviceId)}`),
    `Comissão da semana: ${money(total)} (${money(COLLAB_COMMISSION)} por venda).`,
    'Obrigado pela parceria!',
  ].join('\n');
}

/** Link do WhatsApp da criadora com a mensagem pronta; null sem número. */
export function whatsappLink(whatsappNormalized, message) {
  const digits = String(whatsappNormalized ?? '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

// ---------- vagas de serviços ----------

/** Limite de cada serviço: o salvo no CRM ou o inicial. */
export function quotaLimits(saved) {
  return Object.fromEntries(GRANT_SERVICES.map(({ serviceId, limit }) => {
    const value = saved?.limits?.[serviceId];
    return [serviceId, Number.isInteger(value) && value >= 0 ? value : limit];
  }));
}

/** Por serviço: limite, concedidas (grants das parceiras, uma linha por unidade) e restantes. Uma criadora pode usar mais de uma. */
export function quotaUsage(partners, limits) {
  return GRANT_SERVICES.map(({ serviceId, label }) => {
    const holders = partners.flatMap((partner) => (partner.grants ?? []).filter((grant) => grant.serviceId === serviceId).map((grant) => ({ partner, grant })));
    const limit = limits[serviceId];
    return { serviceId, label, limit, granted: holders.length, remaining: limit - holders.length, holders };
  });
}

// ---------- formulário público (/mamaes-em-collab) ----------

export const MAX_CHILDREN = 6;
export const TERMS_VERSION = 'minuta-2026-10';
/** MINUTA: precisa da revisão do jurídico antes do uso definitivo. Trocar o texto = trocar TERMS_VERSION. */
export const TERMS_SECTIONS = [
  { title: 'Participação', items: [
    'A participação é voluntária e acontece depois da aprovação da equipe do Herói da Cidade, que define o serviço ou projeto da Collab e o benefício.',
    'A parceria inclui 1 Reel em Collab com o perfil do Herói da Cidade e 1 publicação de Stories (até 5), com marcação do perfil e o nome Herói da Cidade escrito corretamente.',
    'O Reel é enviado em arquivo pelo WhatsApp antes da publicação; a equipe pode aprovar, pedir ajustes ou recusar o conteúdo incompatível com o briefing ou com estas regras.',
    'A criança não é obrigada a aparecer. O conteúdo não deve associar o Herói da Cidade a Disney, Marvel, Sony, outros personagens ou marcas, concorrentes ou temas incompatíveis com o público infantil e familiar.',
  ] },
  { title: 'Uso de imagem, voz e conteúdo', items: [
    'Autorizo, sem custo, a publicação do conteúdo da Collab e a republicação orgânica nos canais próprios do Herói da Cidade (Instagram, site e plataforma de vídeos), com a finalidade de apresentar a experiência e os serviços.',
    'Anúncios pagos não estão incluídos nesta autorização e, se houver interesse, serão combinados à parte.',
    'O conteúdo fica publicado por pelo menos 30 dias. Depois, pode continuar publicado enquanto nenhuma das partes pedir a retirada; a retirada pode ser pedida por motivo relevante (reputação, segurança, direitos de imagem, informação incorreta ou descumprimento das regras).',
  ] },
  { title: 'Cancelamento', items: [
    'A criadora pode desistir quando não puder cumprir o combinado. O Herói da Cidade pode encerrar a parceria por descumprimento das regras, publicação sem aprovação, conteúdo incompatível com a marca, informação incorreta ou situação que comprometa a reputação ou a segurança.',
    'Se o benefício ainda não foi entregue, a parceria pode ser encerrada sem a execução do serviço; se já foi entregue, o caso é avaliado individualmente.',
  ] },
  { title: 'Dados pessoais', items: [
    'Os dados deste formulário são usados só para a seleção, o contato pelo WhatsApp e a execução da parceria, com acesso restrito à equipe. Dos filhos, pedimos apenas o primeiro nome e a idade.',
  ] },
];

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/**
 * Valida o envio do formulário. Retorna { errors, fields, form }: errors/fields na ordem das telas (null quando válido) e o formulário
 * limpo. O WhatsApp é conferido no servidor (normalizePhone); aqui só a presença.
 */
export function validateCollabForm(input) {
  const errors = [];
  const fields = [];
  const fail = (field, message) => { errors.push(message); fields.push(field); };
  const value = input ?? {};
  const form = {
    name: text(value.name, 120),
    instagram: normalizeInstagram(value.instagram),
    whatsapp: text(value.whatsapp, 30),
    ddi: String(value.ddi ?? '55').replace(/\D/g, '').slice(0, 4) || '55',
    city: text(value.city, 80),
    children: (Array.isArray(value.children) ? value.children : []).slice(0, MAX_CHILDREN).map((child) => ({ name: text(child?.name, 40), age: text(child?.age, 20) })),
    contentType: text(value.contentType, 500),
    acceptTerms: value.acceptTerms === true,
    childImage: value.childImage === 'yes' ? true : value.childImage === 'no' ? false : null,
  };
  if (!form.name) fail('name', 'Informe o seu nome.');
  if (!form.instagram) fail('instagram', 'Informe o seu @ do Instagram (só letras, números, ponto e sublinhado).');
  if (!form.whatsapp) fail('whatsapp', 'Informe o seu WhatsApp.');
  if (!form.city) fail('city', 'Informe a sua cidade.');
  if (!form.children.length) fail('children', 'Conte sobre pelo menos um filho ou filha.');
  else if (form.children.some((child) => !child.name || !child.age)) fail('children', 'Preencha o primeiro nome e a idade de cada filho.');
  if (!form.contentType) fail('contentType', 'Conte que tipo de conteúdo você produz.');
  if (!form.acceptTerms) fail('acceptTerms', 'Para participar, é preciso aceitar o termo.');
  if (form.childImage === null) fail('childImage', 'Responda se a(s) criança(s) pode(m) aparecer no conteúdo.');
  return errors.length ? { errors, fields, form } : { errors: null, fields: [], form };
}
