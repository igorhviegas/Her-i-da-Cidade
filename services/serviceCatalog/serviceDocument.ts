import { Service } from "../../types";
import { normalizeFaq } from "../serviceFaq.js";

export const SERVICES_COLLECTION = "services";
export const INTERNAL_CONTENT_SERVICE_ID = 'internal-content-production';

/**
 * Converte dados brutos do Firestore para o tipo Service da aplicação com fallback seguro.
 */
export function mapDocToService(docId: string, data: any): Service {
  // Se não houver whatsappUrl no documento, constrói a URL oficial inicial baseada no título
  const defaultWhatsapp = `https://wa.me/5531999044206?text=${encodeURIComponent(
    'Olá, gostaria de saber mais sobre os serviços do Heroi da Cidade! Tenho interesse no serviço: ' + (data.title || '')
  )}`;

  return {
    id: docId,
    title: data.title || "",
    price: data.price || "",
    description: data.description || "",
    imageUrl: data.imageUrl || "",
    category: data.category || "Geral",
    whatsappUrl: data.internalOnly ? data.whatsappUrl || '' : data.whatsappUrl || defaultWhatsapp,
    active: data.active !== false,
    order: typeof data.order === "number" ? data.order : 0,
    badgeText: data.badgeText || undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...(data.generateOrder !== undefined ? { generateOrder: data.generateOrder } : {}),
    ...(data.productionType !== undefined ? { productionType: data.productionType } : {}),
    ...(data.initialStatus !== undefined ? { initialStatus: data.initialStatus } : {}),
    ...(data.autoComplete !== undefined ? { autoComplete: data.autoComplete } : {}),
    ...(data.defaultDeliveryDays !== undefined ? { defaultDeliveryDays: data.defaultDeliveryDays } : {}),
    ...(typeof data.deliveryMessage === 'string' && data.deliveryMessage.trim() ? { deliveryMessage: data.deliveryMessage } : {}),
    ...(data.internalOnly === true ? { internalOnly: true } : {}),
    ...(normalizeFaq(data.faq).length ? { faq: normalizeFaq(data.faq) } : {}),
  };
}
