// Extração de texto de PDF: texto nativo quando existe; OCR (página a página) quando a página é imagem.
// Sem I/O próprio: pdfjs e o OCR são injetados (navegador: services/pdfImportBrowser.ts; testes: pdfjs legacy + OCR falso).

export class PdfImportError extends Error {
  constructor(code, message) { super(message); this.name = 'PdfImportError'; this.code = code; }
}

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_PAGES = 10;
const MIN_CHARS_PER_PAGE = 20;
const countChars = (s) => (s.match(/[\p{L}\p{N}]/gu) ?? []).length;

/** Junta os itens de texto de uma página em linhas (agrupa pelo eixo Y, ordena pelo eixo X). */
export function linesFromTextItems(items) {
  const rows = [];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const y = item.transform[5]; const x = item.transform[4];
    const tolerance = Math.max(2, (item.height || 10) * 0.4);
    const row = rows.find((r) => Math.abs(r.y - y) <= tolerance);
    if (row) row.parts.push({ x, str: item.str }); else rows.push({ y, parts: [{ x, str: item.str }] });
  }
  return rows.sort((a, b) => b.y - a.y).map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(' ').replace(/\s+/g, ' ').trim()).join('\n');
}

/**
 * data: Uint8Array do PDF. recognizePage(pdfDoc, pageNumber, onProgress) → texto (OCR) — opcional.
 * Retorna { text, method: 'text' | 'ocr' | 'mixed', pages, ocrPages }.
 */
export async function extractPdfText(data, { pdfjs, recognizePage, onProgress = () => {} } = {}) {
  if (!data || data.byteLength === 0) throw new PdfImportError('empty', 'O arquivo está vazio.');
  if (data.byteLength > MAX_PDF_BYTES) throw new PdfImportError('too_large', 'O PDF é muito grande (máximo de 15 MB).');
  if (!pdfjs) throw new PdfImportError('invalid_pdf', 'Leitor de PDF indisponível.');
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: data.slice(), useSystemFonts: true }).promise;
  } catch (error) {
    if (error?.name === 'PasswordException') throw new PdfImportError('password', 'O PDF está protegido por senha. Remova a proteção e tente de novo.');
    throw new PdfImportError('invalid_pdf', 'Não foi possível ler o arquivo: ele não parece ser um PDF válido.');
  }
  const pages = Math.min(pdf.numPages, MAX_PAGES);
  if (pages === 0) throw new PdfImportError('empty', 'O PDF não tem páginas.');

  const texts = [];
  let ocrPages = 0;
  for (let n = 1; n <= pages; n += 1) {
    onProgress({ stage: 'text', page: n, pages, progress: (n - 1) / pages });
    let pageText = '';
    try { pageText = linesFromTextItems((await (await pdf.getPage(n)).getTextContent()).items); }
    catch { throw new PdfImportError('invalid_pdf', 'Falha ao ler uma das páginas do PDF.'); }
    if (countChars(pageText) < MIN_CHARS_PER_PAGE) {
      if (!recognizePage) { texts.push(pageText); continue; }
      onProgress({ stage: 'ocr', page: n, pages, progress: 0 });
      try { pageText = await recognizePage(pdf, n, (progress) => onProgress({ stage: 'ocr', page: n, pages, progress })); }
      catch (error) { throw new PdfImportError('ocr_failed', `Falha no OCR da página ${n}: ${error?.message || 'erro desconhecido'}. Preencha manualmente ou tente outro arquivo.`); }
      ocrPages += 1;
    }
    texts.push(pageText);
  }
  const text = texts.join('\n').trim();
  if (countChars(text) < 5) throw new PdfImportError('empty', 'Não foi encontrado texto no PDF, nem por OCR. O documento pode estar em branco ou ilegível.');
  return { text, method: ocrPages === 0 ? 'text' : ocrPages === pages ? 'ocr' : 'mixed', pages, ocrPages };
}
