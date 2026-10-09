export class PdfImportError extends Error { code: 'empty' | 'too_large' | 'invalid_pdf' | 'password' | 'ocr_failed'; constructor(code: PdfImportError['code'], message: string) }
export const MAX_PDF_BYTES: number;
export const MAX_PAGES: number;
export function linesFromTextItems(items: { str: string; transform: number[]; height?: number }[]): string;
export function extractPdfText(data: Uint8Array, options?: {
  pdfjs?: any;
  recognizePage?: (pdf: any, pageNumber: number, onProgress: (progress: number) => void) => Promise<string>;
  onProgress?: (p: { stage: 'text' | 'ocr'; page: number; pages: number; progress: number }) => void;
}): Promise<{ text: string; method: 'text' | 'ocr' | 'mixed'; pages: number; ocrPages: number }>;
