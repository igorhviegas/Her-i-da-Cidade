// Gera PDFs mínimos e controlados para os testes (texto selecionável ou página "digitalizada" sem texto).
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** pages: array de arrays de linhas de texto (WinAnsi; acentos via escapes octais). Página vazia = sem texto (simula digitalização). */
export function makePdf(pages) {
  const encode = (line) => esc(line).replace(/[^\x00-\x7f]/g, (c) => `\\${c.charCodeAt(0).toString(8).padStart(3, '0')}`);
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pagesId = objects.length + 1 + pages.length * 2;
  const pageIds = [];
  for (const lines of pages) {
    const stream = lines.length ? `BT /F1 12 Tf 14 TL 50 780 Td ${lines.map((l) => `(${encode(l)}) Tj T*`).join(' ')} ET` : '0.9 g 50 50 200 200 re f';
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`));
  }
  add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n'; const offsets = [];
  objects.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(out, 'latin1'));
}
