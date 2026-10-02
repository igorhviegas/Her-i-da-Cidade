import { PdfImportError, extractPdfText } from "./pdfExtract.js";

export { PdfImportError } from "./pdfExtract.js";
export interface PdfProgress { stage: "text" | "ocr"; page: number; pages: number; progress: number }
export interface PdfTextResult { text: string; method: "text" | "ocr" | "mixed"; pages: number; ocrPages: number }

/**
 * Lê um PDF no próprio navegador (nada é enviado ao servidor). pdf.js e o Tesseract são carregados sob demanda,
 * só quando o usuário escolhe um arquivo, para não pesar o restante do CRM.
 * Obs.: o Tesseract baixa o motor (WASM) e o idioma "por" de CDN na primeira execução; o conteúdo do documento não sai do navegador.
 */
export async function readPdfFile(file: File, onProgress: (p: PdfProgress) => void): Promise<PdfTextResult> {
  if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    throw new PdfImportError("invalid_pdf", "Selecione um arquivo PDF.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  let ocr: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
  let reportOcr: (progress: number) => void = () => {};
  const recognizePage = async (pdf: any, pageNumber: number, report: (progress: number) => void) => {
    reportOcr = report;
    if (!ocr) {
      const { createWorker } = await import("tesseract.js");
      ocr = await createWorker("por", 1, { logger: (m) => { if (m.status === "recognizing text") reportOcr(m.progress); } });
    }
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    const { data } = await ocr.recognize(canvas);
    return data.text as string;
  };

  try {
    return await extractPdfText(bytes, { pdfjs, recognizePage, onProgress });
  } finally {
    await (ocr as { terminate(): Promise<unknown> } | null)?.terminate();
  }
}
