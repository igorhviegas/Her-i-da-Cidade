import { isValidWhatsAppUrl } from "./serviceWhatsApp.js";

export * from "./serviceCatalog/firestoreErrors";
export * from "./serviceCatalog/serviceDocument";
export * from "./serviceCatalog/serviceInputs";
export * from "./serviceCatalog/serviceQueries";
export * from "./serviceCatalog/useServices";
export * from "./serviceCatalog/serviceWrites";
export * from "./serviceCatalog/internalContentService";
export * from "./serviceCatalog/serviceMaintenance";

/**
 * Validação de link de WhatsApp individual do serviço.
 * Aceita wa.me, api.whatsapp.com e rejeita esquemas inseguros ou vazios.
 */
export const isValidServiceWhatsAppUrl = isValidWhatsAppUrl;
