export const AUDIO_WHATSAPP_NUMBER: string;
export const AUDIO_MESSAGE_MAX: number;
export const AUDIO_MESSAGE_MIN: number;
export const AUDIO_NAME_MAX: number;
export const AUDIO_NOTICE: string;

export interface AudioRequestFields {
  eventDate: string;
  childName: string;
  message: string;
}

export type AudioRequestErrors = Partial<Record<'eventDate' | 'childName' | 'message' | 'accepted', string>>;

export function isRealDate(value: unknown): boolean;
export function cleanMessage(value: unknown): string;
// `errors`/`value` opcionais nos dois lados: sem strictNullChecks o TypeScript não estreita pelo literal de `ok`.
export type AudioRequestCheck =
  | { ok: true; value: AudioRequestFields; errors?: undefined }
  | { ok: false; errors: AudioRequestErrors; value?: undefined };
export function validateAudioRequest(input: unknown, todayKey: string): AudioRequestCheck;
export function formatDateBr(dateKey: string): string;
export function buildWhatsAppMessage(fields: AudioRequestFields): string;
export function buildWhatsAppUrl(fields: AudioRequestFields): string;
