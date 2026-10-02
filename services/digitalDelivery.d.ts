type DeliveryOrder = { content?: string; childName?: string } | null;
type DeliveryService = { id?: string; title?: string; name?: string } | null;
export function isInviteVideoService(service?: DeliveryService): boolean;
export function buildDeliveryMessage(order?: DeliveryOrder, service?: DeliveryService): string;
export function buildDeliveryWhatsAppUrl(whatsapp?: string | null, order?: DeliveryOrder, service?: DeliveryService): string | null;
