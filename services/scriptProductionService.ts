import { createCategory, getCategories, normalizeCategoryName } from './categoriesService';
import { ensureInternalContentClient } from './clientsService';
import { getContentScriptById } from './contentScriptsService';
import { createRecordingOrderFromScript } from './ordersService';
import { ensureInternalContentService } from './servicesService';

/** Prepara os cadastros internos e cria o pedido de gravação vinculado ao roteiro. */
export async function sendScriptToRecording(scriptId: string) {
  const script = await getContentScriptById(scriptId);
  if (!script) throw new Error('Roteiro não encontrado.');
  if (script.productionStatus !== 'ready') throw new Error('O roteiro precisa estar Pronto para gravar.');
  if (script.orderId) throw new Error('Este roteiro já possui uma produção vinculada.');

  const categories = await getCategories();
  if (!categories.some((category) => normalizeCategoryName(category.name) === 'conteúdo')) {
    await createCategory('Conteúdo');
  }
  const [client, service] = await Promise.all([
    ensureInternalContentClient(),
    ensureInternalContentService(),
  ]);
  return createRecordingOrderFromScript({ scriptId, clientId: client.id, serviceId: service.id });
}
