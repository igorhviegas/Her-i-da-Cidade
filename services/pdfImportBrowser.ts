import { PdfImportError, extractPdfText } from "./pdfExtract.js";

export { PdfImportError } from "./pdfExtract.js";

/**
 * Lê o texto de um PDF no próprio navegador (nada é enviado ao servidor). O pdf.js é carregado sob demanda,
 * só quando o usuário escolhe um arquivo. Sem OCR: PDF escaneado/imagem é recusado com mensagem.
 */
export async function readPdfText(file: File): Promise<string> {
  if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    throw new PdfImportError("invalid_pdf", "Selecione um arquivo PDF.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return (await extractPdfText(bytes, { pdfjs })).text;
}
