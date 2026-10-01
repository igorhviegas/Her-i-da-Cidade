export function isDigitalDeliveryService(service?: { id?: string; title?: string; name?: string } | null): boolean;
export function initialStatusFor<T>(service: { id?: string; title?: string; name?: string } | null | undefined, configuredStatus: T): T | 'delivery';
export function extractBirthdayPerson(content?: string | null): string | null;
export function buildDeliveryWhatsAppUrl(whatsapp?: string | null, content?: string | null): string | null;
