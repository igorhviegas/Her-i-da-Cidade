import type { EventPackage } from './eventQuote.js';

export const FORM_CONFIG_PATH: [string, string];
export type { AddonPriceTable as AddonPrices } from './eventSiteForm.js';
import type { AddonPriceTable as AddonPrices } from './eventSiteForm.js';
export interface AddonVideos { extraWeb: string; birthdayVideo: string; inviteVideo: string }
export interface FormConfig { packages: EventPackage[]; addonPrices: AddonPrices; addonVideos: AddonVideos; depositDays: number; termsVersion: string; termsText: string; terms: Record<string, string> }
export type PublicFormConfig = Omit<FormConfig, 'terms'>;
export function normalizeFormConfig(saved: unknown): FormConfig;
export function publicFormConfig(config: FormConfig): PublicFormConfig;
export function buildFormConfigDoc(current: FormConfig, edits: { packages: Pick<EventPackage, 'id' | 'title' | 'duration' | 'items'>[]; addonPrices: AddonPrices; addonVideos?: AddonVideos; depositDays: number; termsText: string }):
  { error: string; doc?: undefined; newVersion?: undefined } | { doc: Record<string, unknown>; newVersion: string | null; error?: undefined };
