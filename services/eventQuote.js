// Orçamento de evento presencial (regras puras, sem Firebase/Google). Usado no Calendário → Orçamentos e testado em Node.
//
// Total = cachê da empresa + cachê do agente + km (só ida, casa → evento) × multiplicador (×4 cobre a volta e a gasolina).
// Cachê da empresa = valor fixo do pacote + extra da data + faixa de distância (até 15 km = 0, cada 15 km a mais = +R$ 50).
// O total é arredondado para terminar em 47 ou 97 e nunca fica abaixo do mínimo da cidade (quando o pacote tem mínimo).

export const PACKAGES = [
  {
    id: 'aniversario', title: 'Aniversário Espetacular', duration: '1 hora de participação', durationMinutes: 60,
    items: ['1h de participação do Homem-Aranha', 'Deslocamento', 'Caixa de som e microfone para as brincadeiras', 'Monitor para auxiliar o Aranha no evento', 'Certificado personalizado', 'Brinde exclusivo para todas as crianças', 'Atuação do próprio Herói da Cidade (+7 anos de experiência)'],
  },
  {
    id: 'visita', title: 'Visita Espetacular', duration: '30 minutos de participação', durationMinutes: 30,
    items: ['30min de participação do Homem-Aranha', 'Deslocamento', 'Monitor para auxiliar o Aranha no evento (depende do evento)', 'Certificado personalizado', 'Brinde exclusivo para todas as crianças', 'Atuação do próprio Herói da Cidade (+7 anos de experiência)'],
  },
  {
    id: 'vip', title: 'Presença VIP', duration: 'até 2 horas de participação (tempo combinado no orçamento)', durationMinutes: 120,
    items: ['Até 2h de participação do Homem-Aranha', 'Deslocamento', 'Caixa de som e microfone para as brincadeiras', 'Monitor para auxiliar o Aranha no evento', 'Certificado personalizado', 'Vídeo Convite sobre a presença', 'Atuação do próprio Herói da Cidade (+7 anos de experiência)'],
  },
];

export const packageById = (id) => PACKAGES.find((item) => item.id === id) ?? null;

/** Padrão das regras (editável em Calendário → Orçamentos → Regras; salvo em siteConfig/eventQuote). */
export const DEFAULT_QUOTE_CONFIG = {
  bases: { aniversario: 450, visita: 300 }, // Presença VIP: cachê informado em cada orçamento (depende do tempo)
  agentFee: 115,
  kmMultiplier: 4,
  tierKm: 15,
  tierFee: 50,
  // Mínimo do valor final por cidade, por pacote. Cidade comparada sem acento/caixa.
  minimums: { aniversario: { 'Belo Horizonte': 847, Contagem: 747, Betim: 597 } },
  dateExtras: {}, // { 'AAAA-MM-DD': valor extra no cachê da empresa }
};

const num = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) >= 0 && value !== '' && value !== null ? Number(value) : fallback);
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const normalizeCity = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Configuração salva completada com o padrão (valor ausente ou inválido cai no padrão). */
export function normalizeQuoteConfig(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const d = DEFAULT_QUOTE_CONFIG;
  const table = (value) => Object.fromEntries(Object.entries(value && typeof value === 'object' ? value : {})
    .filter(([key, amount]) => key.trim() && Number.isFinite(Number(amount)) && Number(amount) > 0).map(([key, amount]) => [key.trim(), Number(amount)]));
  return {
    bases: { aniversario: num(s.bases?.aniversario, d.bases.aniversario), visita: num(s.bases?.visita, d.bases.visita) },
    agentFee: num(s.agentFee, d.agentFee),
    kmMultiplier: num(s.kmMultiplier, d.kmMultiplier),
    tierKm: num(s.tierKm, d.tierKm) || d.tierKm,
    tierFee: num(s.tierFee, d.tierFee),
    minimums: Object.fromEntries(PACKAGES.map(({ id }) => [id, table(s.minimums ? s.minimums[id] : d.minimums[id])])),
    dateExtras: Object.fromEntries(Object.entries(table(s.dateExtras)).filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key))),
  };
}

/** Faixa de distância no cachê da empresa: até `tierKm` = 0; cada faixa de `tierKm` iniciada depois disso soma `tierFee`. */
export function distanceFee(km, { tierKm, tierFee }) {
  if (!(km > tierKm)) return 0;
  return (Math.ceil(km / tierKm - 1e-9) - 1) * tierFee;
}

/** Arredondamento da casa: sobe para o próximo valor terminado em 47 ou 97 (650 → 647, 650,01 → 697, 700 → 697, 701 → 747). */
export const roundPrice = (value) => Math.max(47, Math.ceil(value / 50 - 1e-9) * 50 - 3);

/**
 * Calcula o orçamento. `km` = distância de ida (casa → evento) em km. `companyBase` só é usado na Presença VIP.
 * Retorna { error } ou o detalhamento: cada parcela, subtotal, arredondado, mínimo da cidade e total.
 */
export function computeQuote({ packageId, km, date, city, companyBase }, config = DEFAULT_QUOTE_CONFIG) {
  const pack = packageById(packageId);
  if (!pack) return { error: 'Escolha o pacote.' };
  if (!Number.isFinite(km) || km < 0) return { error: 'Distância inválida.' };
  const base = pack.id === 'vip' ? num(companyBase, null) : config.bases[pack.id];
  if (base === null || base === undefined) return { error: 'Informe o cachê da empresa para a Presença VIP (depende do tempo).' };
  const roundedKm = Math.round(km * 10) / 10;
  const dateExtra = config.dateExtras[date] ?? 0;
  const tier = distanceFee(roundedKm, config);
  const companyFee = base + dateExtra + tier;
  const travel = money(roundedKm * config.kmMultiplier);
  const subtotal = money(companyFee + config.agentFee + travel);
  const rounded = roundPrice(subtotal);
  const wanted = normalizeCity(city);
  const minimumEntry = Object.entries(config.minimums[pack.id] ?? {}).find(([name]) => wanted && normalizeCity(name) === wanted);
  const minimum = minimumEntry ? minimumEntry[1] : 0;
  const total = Math.max(rounded, minimum);
  return {
    packageId: pack.id, km: roundedKm, base, dateExtra, tier, companyFee, agentFee: config.agentFee, travel, subtotal, rounded,
    minimum, minimumCity: minimumEntry ? minimumEntry[0] : '', total, entry: money(total / 2),
  };
}

const brl = (value) => `R$ ${Number(value).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
export const formatBrl = brl;
const brDate = (key) => key.split('-').reverse().join('/');

/** Texto do orçamento para o WhatsApp (o link leva ao formulário já preenchido com pacote, data, endereço e valor). */
export function quoteMessage({ packageId, date, total, link, pack: edited }) {
  const pack = edited ?? packageById(packageId); // edited = pacote com textos do CRM (Formulário)
  return [
    `*${pack.title}*${date ? ` · ${brDate(date)}` : ''}`,
    '',
    ...pack.items.map((item) => `• ${item}`),
    '',
    `*Valor total: ${brl(total)}*`,
    `Reserva da data com 50% de sinal (${brl(money(total / 2))}); o restante até o início do evento.`,
    ...(link ? ['', 'Para reservar, preencha o formulário da missão:', link] : []),
  ].join('\n');
}
