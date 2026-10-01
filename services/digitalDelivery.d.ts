export function isDigitalDeliveryService(service?: { id?: string; title?: string; name?: string } | null): boolean;
export function initialStatusFor<T>(service: { id?: string; title?: string; name?: string } | null | undefined, configuredStatus: T): T | 'delivery';
export function buildDeliveryWhatsAppUrl(whatsapp?: string | null, order?: { content?: string; childName?: string } | null): string | null;
