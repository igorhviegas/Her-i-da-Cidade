// Regras puras (sem Firebase/React) do formulário manual de pedidos de evento. Testado em Node.

export const EXTRA_WEB_OPTIONS = [0, 1, 2];

export const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** Entrada sugerida: metade do valor total (arredondada em centavos). */
export const defaultEntry = (total) => (Number.isFinite(total) && total >= 0 ? roundMoney(total / 2) : 0);

export const money = (text) => {
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? roundMoney(text) : null;
  const clean = String(text ?? '').trim();
  if (!clean) return null;
  const value = Number(clean.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? roundMoney(value) : null;
};

/** 'YYYY-MM-DD' existente no calendário (rejeita 2026-02-31). */
export function isValidDateInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const isValidTimeInput = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '');

/**
 * Valida os campos do formulário (strings dos inputs). Retorna { error } ou { value }.
 * Cliente e WhatsApp são validados à parte (clientsService.normalizeWhatsApp), como nos demais pedidos.
 */
export function validateEventForm(form) {
  const text = (v) => String(v ?? '').trim();
  if (!text(form.childName)) return { error: 'Informe o nome da criança.' };
  if (!isValidDateInput(form.eventDate)) return { error: 'Informe uma data do evento válida.' };
  if (!isValidTimeInput(form.eventTime)) return { error: 'Informe um horário de início válido (HH:MM).' };
  if (!text(form.location)) return { error: 'Informe o local do evento.' };
  if (form.imageAuthorization !== 'yes' && form.imageAuthorization !== 'no') return { error: 'Informe se há autorização de uso de imagem (Sim ou Não).' };
  const extraWeb = Number(form.extraWeb);
  if (!EXTRA_WEB_OPTIONS.includes(extraWeb)) return { error: 'Teia extra deve ser Não, 1 ou 2.' };
  const totalValue = money(form.totalValue);
  if (totalValue === null) return { error: 'Informe um valor total válido.' };
  const entryValue = money(form.entryValue);
  if (entryValue === null) return { error: 'Informe um valor de entrada válido.' };
  if (entryValue > totalValue) return { error: 'O valor de entrada não pode ser maior que o valor total.' };
  // Custo é opcional ao criar/editar; é exigido só na conclusão (services/eventFinance.js).
  const cost = String(form.cost ?? '').trim() === '' ? null : money(form.cost);
  if (cost === undefined || (cost === null && String(form.cost ?? '').trim() !== '')) return { error: 'Informe um custo válido.' };
  if (!text(form.formType)) return { error: 'Informe o #formulário (tipo do evento).' };
  // Campos opcionais do formulário do cliente.
  const birthDate = text(form.birthDate);
  if (birthDate && !isValidDateInput(birthDate)) return { error: 'Informe uma data de nascimento válida ou deixe em branco.' };
  return {
    value: {
      childName: text(form.childName),
      eventDate: form.eventDate,
      eventTime: form.eventTime,
      location: text(form.location),
      imageAuthorization: form.imageAuthorization === 'yes',
      extraWeb,
      totalValue,
      entryValue,
      cost,
      observations: text(form.observations),
      formType: text(form.formType),
      birthDate,
      pcd: form.pcd === 'yes' ? true : form.pcd === 'no' ? false : null,
    },
  };
}

/** Texto do campo `content` do pedido (obrigatório no modelo): resumo legível; "Nome do aniversariante" alimenta a busca existente. */
export function eventContentSummary(event) {
  return [
    `Formulário: ${event.formType}`,
    `Nome do aniversariante: ${event.childName}`,
    `Horário de início: ${event.eventTime}`,
    `Local: ${event.location}`,
    ...(event.observations ? [`Observações: ${event.observations}`] : []),
  ].join('\n');
}
