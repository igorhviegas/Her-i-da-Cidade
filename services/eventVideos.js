// Vídeos (Especial de Aniversário e Convite) contratados junto de um evento presencial. Sem Firebase/React; testado em Node.
// O valor deles já está no orçamento do evento, então os pedidos nascem com R$ 0,00 para não contar duas vezes no Financeiro.

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const VIDEO_KINDS = {
  birthday: { title: 'Vídeo Especial de Aniversário', label: 'Vídeo Especial de Aniversário (+R$ 20,00 no orçamento)' },
  invite: { title: 'Vídeo Convite', label: 'Vídeo Convite (+R$ 45,00 no orçamento)' },
};

/** Serviço do catálogo pelo título (sem diferenciar acento/caixa). */
export const findVideoService = (services, kind) => services.find((s) => norm(s.title) === norm(VIDEO_KINDS[kind].title));

const brDate = (iso) => iso.split('-').reverse().join('/');
const INCLUDED = 'Valor incluso no orçamento do evento presencial (este pedido não é cobrado à parte).';

/**
 * Valida os adicionais marcados e devolve { error } ou { value: { birthday?, invite? } } com o `content` de cada pedido.
 * addons: { birthday, birthdayName, invite, inviteName, inviteAge, inviteTime, inviteDetails }; event: valores validados do evento.
 */
export function buildVideoContents(addons, event) {
  const text = (v) => String(v ?? '').trim();
  const value = {};
  if (addons.birthday) {
    if (!text(addons.birthdayName)) return { error: 'Informe o primeiro nome da criança para o Vídeo Especial de Aniversário.' };
    value.birthday = ['Vídeo Especial de Aniversário', `Nome do aniversariante: ${text(addons.birthdayName)}`, INCLUDED].join('\n');
  }
  if (addons.invite) {
    if (!text(addons.inviteName)) return { error: 'Informe o nome do aniversariante para o Vídeo Convite.' };
    const time = text(addons.inviteTime) || event.eventTime;
    value.invite = [
      'Vídeo Convite',
      `Nome do aniversariante: ${text(addons.inviteName)}`,
      ...(text(addons.inviteAge) ? [`Idade: ${text(addons.inviteAge)} anos`] : []),
      `Data: ${brDate(event.eventDate)}`,
      `Horário: ${time}`,
      `Local: ${event.location}`,
      ...(text(addons.inviteDetails) ? [`Detalhes para o vídeo: ${text(addons.inviteDetails)}`] : []),
      INCLUDED,
    ].join('\n');
  }
  return { value };
}
