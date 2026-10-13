// Privacidade (LGPD): rota da política, identificação do responsável e os avisos curtos dos formulários públicos. Sem I/O.
// A política completa fica em components/PrivacyPage.tsx; os formulários só trazem uma linha e o link para ela.

export const PRIVACY_PATH = '/privacidade';
export const PRIVACY_UPDATED = '13/10/2026';

/**
 * Identificação do responsável pelo tratamento. SÓ o que já é público e verificado vem preenchido.
 * O responsável pelo negócio precisa informar (campo vazio = a linha não aparece na página):
 * razão social / nome empresarial, CNPJ do MEI e um e-mail para pedidos dos titulares.
 */
export const PRIVACY_CONTROLLER = { tradeName: 'O Herói da Cidade', legalName: '', cnpj: '', email: '' };

/** Aviso do formulário de agendamento da vídeo chamada (home e /agendar-chamada). */
export const BOOKING_PRIVACY_NOTE = 'Usamos estes dados só para reservar a chamada, falar com você pelo WhatsApp e confirmar o pagamento. Você os informa como responsável pela criança.';

/** Aviso do pedido de áudio (/clientes): o site não guarda nada, só abre o WhatsApp com a mensagem pronta. */
export const AUDIO_PRIVACY_NOTE = 'O site não guarda este pedido: ele só abre o seu WhatsApp com a mensagem pronta. O nome da criança e a mensagem são usados apenas para gravar o áudio.';

/** Dica do campo livre "detalhes" da vídeo chamada: não proíbe (a família pode querer adaptar a chamada), só pede o necessário. */
export const BOOKING_DETAILS_HINT = 'Se contar algo sobre a saúde ou as necessidades da criança, informe só o que ajuda a adaptar a chamada.';
