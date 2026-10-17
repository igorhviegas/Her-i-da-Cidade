import type { FormConfig } from './eventFormConfig.js';
import type { PdfInput } from './eventFormPdf';

export function orderPdfInput(order: Record<string, any>, client: { name?: string; whatsapp?: string } | null | undefined, config: FormConfig): PdfInput | null;
