import type { PackageId } from './eventQuote.js';

export const FORM_PATH: string;
export interface AddonPriceTable { extraWeb: number; birthdayVideo: number; inviteVideo: number; extraChild: number }
export const ADDON_PRICES: AddonPriceTable;
export const MAX_EXTRA_CHILDREN: number;
export const FORM_PREFIX: string;
export interface SiteFormValues {
  packageId: PackageId; childName: string; childAge: string; extraChildren: { name: string; age: string }[]; pcd: boolean | null; pcdDetails: string; eventDate: string; eventTime: string;
  location: string; reference: string; responsibleName: string; cpf: string; email: string; ddi: string; whatsapp: string;
  extraWeb: number; birthdayVideo: boolean; birthdayName: string; inviteVideo: boolean; inviteParents: string; inviteGuestTime: string; inviteDetails: string; observations: string;
  imageAuthorization: boolean | null; acceptTerms: boolean; quoteId: string;
}
export function isValidDate(value: string): boolean;
export function isValidCpf(value: string): boolean;
export function formatCpf(value: string): string;
export function formNumberLabel(number: number): string;
export function validateSiteForm(input: unknown, options: { today: string }): { form: SiteFormValues; errors?: undefined; fields?: undefined } | { errors: string[]; fields: (keyof SiteFormValues)[]; form?: undefined };
export function childrenNames(form: Pick<SiteFormValues, 'childName' | 'extraChildren'>): string;
export function addonsTotal(form: Pick<SiteFormValues, 'extraWeb' | 'birthdayVideo' | 'inviteVideo'> & { extraChildren?: unknown[] }, prices?: AddonPriceTable): number;
export function fullLocation(form: Pick<SiteFormValues, 'location' | 'reference'>): string;
export function observationLines(form: SiteFormValues, prices?: AddonPriceTable): string[];
export function whatsappDoneMessage(input: { number: number; packageId: string; packageTitle?: string; eventDate: string; eventTime: string; childName: string }): string;
