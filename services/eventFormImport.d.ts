export interface ParsedEventForm {
  childName: string;
  /** 'YYYY-MM-DD' ou '' */
  birthDate: string;
  eventDate: string;
  eventTime: string;
  location: string;
  responsible: string;
  birthdayVideo: { firstName: string } | null;
  inviteVideo: { name: string; age: string; time: string; details: string } | null;
}
export function toIsoDate(text: string): string;
export function toTime(text: string): string;
export function ageOn(birthDate: string, on: string): string;
/** null = o texto não é o "Formulário da Missão". */
export function parseGoogleEventForm(text: string): ParsedEventForm | null;
