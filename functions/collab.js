// Formulário público das Mamães em Collab (/mamaes-em-collab). Só servidor (Admin SDK), como event-form.js.
// O envio cria a ficha da criadora em collabPartners (status "Formulário recebido") ou atualiza a ficha que a equipe já tinha aberto
// para o mesmo WhatsApp ou @ do Instagram: os dados do formulário são trocados, o andamento da parceria (status, cupom, notas, datas)
// fica como está.

import { FieldValue } from 'firebase-admin/firestore';
import { normalizePhone } from './video-call.js';
import { PARTNERS, TERMS_VERSION, validateCollabForm } from '../services/collab.js';

export class CollabFormError extends Error {
  constructor(code, message) { super(message); this.name = 'CollabFormError'; this.code = code; }
}

const EARLY = new Set(['prospect', 'contacted']);

async function findPartner(transaction, database, field, value) {
  const result = await transaction.get(database.collection(PARTNERS).where(field, '==', value).limit(1));
  return result.docs[0] ?? null;
}

/** Grava o envio. Retorna { firstName } para a tela final. */
export async function submitCollabForm({ database, input, nowMs = Date.now() }) {
  const { errors, form } = validateCollabForm(input);
  if (errors) throw new CollabFormError('validation_error', errors[0]);
  if (input?.termsVersion !== TERMS_VERSION) throw new CollabFormError('terms_changed', 'O termo foi atualizado. Atualize a página e confira de novo.');
  const phone = normalizePhone(form.ddi, form.whatsapp);
  if (!phone) throw new CollabFormError('validation_error', 'Confira o número do WhatsApp (com DDD).');

  const data = {
    name: form.name, instagram: form.instagram, whatsapp: `+${phone.ddi} ${phone.phone}`, whatsappNormalized: phone.e164, city: form.city,
    children: form.children, contentType: form.contentType, terms: { version: TERMS_VERSION, acceptedAtMs: nowMs, childImage: form.childImage },
    formAtMs: nowMs, updatedAt: FieldValue.serverTimestamp(),
  };
  await database.runTransaction(async (transaction) => {
    const existing = (await findPartner(transaction, database, 'whatsappNormalized', phone.e164)) ?? (await findPartner(transaction, database, 'instagram', form.instagram));
    if (existing) {
      transaction.update(existing.ref, { ...data, ...(EARLY.has(existing.get('status')) ? { status: 'form' } : {}) });
      return;
    }
    transaction.set(database.collection(PARTNERS).doc(), {
      ...data, status: 'form', source: 'form', criteria: {}, publicationModel: '', theme: '', briefingUrl: '', conditionsAt: '', reelStatus: '',
      reelUrl: '', reelPublishedAt: '', storiesAt: '', couponCode: '', grants: [], notes: '', createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { firstName: form.name.split(/\s+/)[0] };
}
