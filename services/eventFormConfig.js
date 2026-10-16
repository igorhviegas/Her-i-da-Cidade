// Configuração do formulário do evento editável no CRM (Calendário → Formulário), salva em siteConfig/eventForm.
// Lida pela página pública (via GET /api/event-form) e pelo servidor, que valida preços e versão dos termos com o que está salvo.
// Termos: `terms` guarda TODAS as versões ({ '2': texto, '3': texto }); salvar um texto diferente cria a próxima versão, e a
// anterior nunca é alterada (pedidos e PDFs antigos continuam apontando para a versão que o cliente aceitou).

import { PACKAGES } from './eventQuote.js';
import { ADDON_PRICES } from './eventSiteForm.js';
import { BUILTIN_TERMS, DEPOSIT_DAYS, TERMS_VERSION, parseTerms } from './eventTerms.js';

export const FORM_CONFIG_PATH = ['siteConfig', 'eventForm'];

const text = (value, max, fallback) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback);
const price = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) >= 0 && value !== '' && value !== null ? Math.round(Number(value) * 100) / 100 : fallback);

/** Configuração salva completada com o padrão. Devolve também `termsText` (texto da versão atual). */
export function normalizeFormConfig(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const packages = PACKAGES.map((base) => {
    const edit = s.packages && typeof s.packages === 'object' ? s.packages[base.id] ?? {} : {};
    const items = Array.isArray(edit.items) ? edit.items.map((item) => text(item, 200, '')).filter(Boolean).slice(0, 15) : [];
    return { ...base, title: text(edit.title, 60, base.title), duration: text(edit.duration, 120, base.duration), items: items.length ? items : base.items };
  });
  const addonPrices = Object.fromEntries(Object.entries(ADDON_PRICES).map(([key, value]) => [key, price(s.addonPrices?.[key], value)]));
  const depositDays = Number.isInteger(Number(s.depositDays)) && Number(s.depositDays) >= 1 && Number(s.depositDays) <= 30 ? Number(s.depositDays) : DEPOSIT_DAYS;
  // Versões do código primeiro; as salvas no CRM nunca sobrescrevem uma embutida (texto aceito não muda).
  const terms = { ...BUILTIN_TERMS };
  for (const [version, body] of Object.entries(s.terms && typeof s.terms === 'object' ? s.terms : {})) {
    if (/^\d+$/.test(version) && !(version in BUILTIN_TERMS) && typeof body === 'string' && parseTerms(body).length) terms[version] = body;
  }
  const termsVersion = typeof s.termsVersion === 'string' && terms[s.termsVersion] ? s.termsVersion : TERMS_VERSION;
  return { packages, addonPrices, depositDays, termsVersion, termsText: terms[termsVersion], terms };
}

/** O que vai ao navegador: sem o histórico de versões. */
export const publicFormConfig = ({ terms: _history, ...config }) => config;

/**
 * Documento a salvar a partir do que foi editado. Texto dos termos igual ao atual mantém a versão; diferente cria a próxima
 * (as anteriores ficam como estão). Retorna { error } se o texto não tiver nenhuma seção válida.
 */
export function buildFormConfigDoc(current, edits) {
  const termsText = String(edits.termsText ?? '').replace(/\r\n/g, '\n').trim();
  if (!parseTerms(termsText).length) return { error: 'Os termos precisam ter ao menos uma seção ("## Título" e itens abaixo).' };
  const changed = termsText !== current.termsText.trim();
  const termsVersion = changed ? String(Math.max(...Object.keys(current.terms).map(Number)) + 1) : current.termsVersion;
  const terms = changed ? { ...current.terms, [termsVersion]: termsText } : current.terms;
  return {
    doc: {
      packages: Object.fromEntries(edits.packages.map((p) => [p.id, { title: p.title, duration: p.duration, items: p.items }])),
      addonPrices: edits.addonPrices, depositDays: edits.depositDays, termsVersion, terms,
    },
    newVersion: changed ? termsVersion : null,
  };
}
