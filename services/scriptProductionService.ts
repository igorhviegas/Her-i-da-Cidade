import { logger } from '../lib/logger.js';
import { createCategory, getCategories, normalizeCategoryName } from './categoriesService';
import { ensureInternalContentClient } from './clientsService';
import { getContentScriptById } from './contentScriptsService';
import { createRecordingOrderFromScript } from './ordersService';
import { ensureInternalContentService } from './servicesService';

async function runLogged<T>(operation: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    logger.error(`[scriptProductionService] Falha na operação: ${operation}`, {
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/** Prepara os cadastros internos e cria o pedido de gravação vinculado ao roteiro. */
export async function sendScriptToRecording(scriptId: string) {
  const script = await runLogged(`buscar roteiro ${scriptId}`, () => getContentScriptById(scriptId));
  if (!script) throw new Error('Roteiro não encontrado.');
  if (script.productionStatus !== 'ready') throw new Error('O roteiro precisa estar Pronto para gravar.');
  if (script.orderId) throw new Error('Este roteiro já possui uma produção vinculada.');

  const categories = await runLogged('listar categorias', getCategories);
  if (!categories.some((category) => normalizeCategoryName(category.name) === 'conteúdo')) {
    await runLogged('criar categoria Conteúdo', () => createCategory('Conteúdo'));
  }
  const [client, service] = await Promise.all([
    runLogged('obter ou criar cliente interno de Conteúdo', ensureInternalContentClient),
    runLogged('obter ou criar serviço interno de Conteúdo', ensureInternalContentService),
  ]);
  return runLogged('criar pedido e vincular ao roteiro', () => createRecordingOrderFromScript({ scriptId, clientId: client.id, serviceId: service.id }));
}
