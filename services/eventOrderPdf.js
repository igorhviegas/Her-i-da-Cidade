// PDF do formulário a partir de um pedido do CRM (Detalhes do pedido → Baixar formulário). Puro: monta a entrada de
// services/eventFormPdf.ts.
// - Pedido do formulário do site com o envio guardado (eventFormSite.form): o MESMO PDF que o cliente baixou (mesmos dados,
//   preços da época e a versão dos termos aceita).
// - Demais pedidos de evento (importados do Google Forms ou criados à mão): PDF com os dados do CRM e os termos do Google
//   Forms (versão 1). CPF e e-mail não existem nesses pedidos e saem como "—".

import { dateKey } from '../functions/missions-core.js';
import { ADDON_PRICES } from './eventSiteForm.js';
import { LEGACY_TERMS_VERSION } from './eventTerms.js';
import { normalizeCity } from './eventQuote.js';

const toDate = (value) => (value instanceof Date ? value : typeof value?.toDate === 'function' ? value.toDate() : value ? new Date(value) : null);

/** Pacote do pedido manual pelo texto do #formulário ("Aniversário", "A213 · Visita Espetacular"…); sem correspondência, o próprio texto. */
function packageFromFormType(formType, packages) {
  const text = normalizeCity(formType);
  const pack = packages.find((p) => text.includes(normalizeCity(p.title)) || text.includes(normalizeCity(p.title.split(' ')[0])));
  return pack?.id ?? String(formType || 'Evento');
}

/** Número do formulário: A### do site, ou o "A###" escrito no #formulário; senão, o próprio #formulário. */
function labelOf(order) {
  if (order.eventFormSite?.number) return `A${order.eventFormSite.number}`;
  const match = /\bA\s?(\d{2,5})\b/i.exec(order.eventForm?.formType ?? '');
  return match ? `A${match[1]}` : (order.eventForm?.formType || 'evento');
}

/** Entrada do PDF para o pedido; null se não for pedido de evento com formulário. `config` = configuração completa (com o histórico dos termos). */
export function orderPdfInput(order, client, config) {
  const event = order?.eventForm;
  if (!event) return null;
  const site = order.eventFormSite;
  const termsOf = (version) => config.terms[version] ?? config.termsText;
  if (site?.form) {
    return {
      form: { ...site.form, acceptTerms: true, quoteId: '' },
      config: { ...config, addonPrices: { ...ADDON_PRICES, ...site.prices }, termsText: termsOf(site.termsVersion), termsVersion: site.termsVersion },
      label: labelOf(order), acceptedAtMs: site.submittedAtMs, termsVersion: site.termsVersion, total: event.totalValue,
      whatsappLabel: site.whatsapp ? `+${site.whatsapp}` : client?.whatsapp ?? '', legacy: false,
    };
  }
  const eventDate = toDate(order.eventDate);
  const created = toDate(order.createdAt) ?? eventDate ?? new Date();
  return {
    form: {
      packageId: packageFromFormType(event.formType, config.packages), childName: order.childName ?? '', childAge: '', extraChildren: [],
      pcd: event.pcd ?? null, pcdDetails: '', eventDate: eventDate ? dateKey(eventDate) : '', eventTime: event.eventTime, location: event.location, reference: '',
      responsibleName: client?.name ?? '', cpf: '', email: '', ddi: '55', whatsapp: client?.whatsapp ?? '',
      extraWeb: event.extraWeb ?? 0, birthdayVideo: false, birthdayName: '', inviteVideo: false, inviteParents: '', inviteGuestTime: '', inviteDetails: '',
      observations: event.observations ?? '', imageAuthorization: event.imageAuthorization === true, acceptTerms: true, quoteId: '',
    },
    config: { ...config, addonPrices: { ...ADDON_PRICES }, termsText: termsOf(LEGACY_TERMS_VERSION), termsVersion: LEGACY_TERMS_VERSION },
    label: labelOf(order), acceptedAtMs: created.getTime(), termsVersion: LEGACY_TERMS_VERSION, total: event.totalValue,
    whatsappLabel: client?.whatsapp ?? '', legacy: true,
  };
}
