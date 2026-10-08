import type { ContentScript, Order, Service } from '../types';
export function getTeleprompterText(input: { order?: Order; service?: Service | null; script?: ContentScript | null }): string | null;
export function setTeleprompterText(input: { order?: Order }, text: string): string;
