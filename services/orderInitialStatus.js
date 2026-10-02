const STATUSES = ['scheduled', 'recording', 'editing', 'delivery', 'completed'];

/**
 * Status inicial de um novo pedido: o configurado em Admin → Serviços.
 * "Concluir automaticamente" só serve de alternativa quando nenhum status inicial foi configurado.
 * Espelhado em functions/manychat-handler.js (a Function é publicada sem acesso a esta pasta).
 */
export function resolveInitialStatus(service) {
  if (STATUSES.includes(service?.initialStatus)) return service.initialStatus;
  return service?.autoComplete === true ? 'completed' : null;
}

/** Sugestão de status inicial ao escolher o tipo de produção no cadastro do serviço. */
export function defaultInitialStatus(productionType) {
  return productionType === 'immediate' ? 'delivery' : '';
}
