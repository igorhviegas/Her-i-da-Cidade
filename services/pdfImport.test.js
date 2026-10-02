// Importação de PDF: parser, extração de texto, roteamento para OCR e erros.
// Os textos abaixo são SINTÉTICOS (inspirados no padrão genérico de exportações do Google Forms). Nenhum PDF real do
// formulário do Herói da Cidade estava disponível: a compatibilidade com o layout real NÃO está validada.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { makePdf } from '../tests/helpers/makePdf.js';
import { PdfImportError, extractPdfText, linesFromTextItems } from './pdfExtract.js';
import { buildOrderContent, classifyLabel, importFingerprint, parseDate, parseFormText, parseTime, toOrderFormValues } from './pdfFormParser.js';

const today = new Date(2026, 9, 2); // 02/10/2026
const FORM = [
  'Carimbo de data/hora', '01/10/2026 14:32:10',
  'Nome do responsável *', 'Maria Souza',
  'WhatsApp *', '(31) 99904-4206',
  'Nome do aniversariante *', 'Pedro e Lucas',
  'Idade', '6 anos',
  'Data da festa *', '15/11/2026',
  'Horário *', '15h30',
  'Endereço', 'Rua das Flores, 123', 'Bairro Centro - Betim',
  'Teia extra?', 'Sim, 1 teia extra',
  'Observações:', 'Chegar 10 minutos antes',
];

test('parser: reconhece campos do formulário e ignora o carimbo de data/hora do Forms', () => {
  const parsed = parseFormText(FORM.join('\n'), { today });
  const f = parsed.fields;
  assert.equal(f.clientName.value, 'Maria Souza');
  assert.equal(f.whatsapp.parsed, '31999044206');
  assert.equal(f.eventDate.parsed, '2026-11-15'); // não confunde com o carimbo (01/10/2026)
  assert.equal(f.eventTime.parsed, '15:30');
  assert.equal(f.address.value, 'Rua das Flores, 123, Bairro Centro - Betim');
  assert.equal(f.extras.value, 'Sim, 1 teia extra');
  assert.equal(f.childName.value, 'Pedro e Lucas');
  assert.equal(parsed.childrenCount, 2);
  assert.match(f.childName.notes.join(' '), /2 crianças/);
  assert.deepEqual(parsed.others, [{ label: 'Observações', value: 'Chegar 10 minutos antes' }]);
  assert.equal(f.clientName.confidence, 'high');
});

test('limitação conhecida: pergunta desconhecida SEM marcador (?, *, :) se funde à resposta anterior, mas o texto fica visível para revisão', () => {
  const parsed = parseFormText('Endereço\nRua A, 1\nObservações\nChegar cedo', { today });
  assert.match(parsed.fields.address.value, /Rua A, 1.*Observações.*Chegar cedo/);
});

test('parser: valores para o formulário de pedido e conteúdo compatível com o nome do aniversariante', () => {
  const values = toOrderFormValues(parseFormText(FORM.join('\n'), { today }));
  assert.equal(values.name, 'Maria Souza');
  assert.equal(values.whatsapp, '31999044206');
  assert.equal(values.eventDate, '2026-11-15');
  assert.match(values.content, /^Nome do aniversariante: Pedro e Lucas$/m);
  assert.match(values.content, /^Horário: 15:30$/m);
  assert.match(values.content, /^Endereço: Rua das Flores/m);
  assert.match(values.content, /^Observações: Chegar 10 minutos antes$/m);
  assert.doesNotMatch(values.content, /Maria Souza|99904/); // cliente tem campos próprios
});

test('parser: formato "Rótulo: valor" na mesma linha', () => {
  const parsed = parseFormText('Nome do responsável: Ana\nTelefone: 31 98888-7777\nData do evento: 3 de dezembro de 2026 às 14:00', { today });
  assert.equal(parsed.fields.clientName.value, 'Ana');
  assert.equal(parsed.fields.whatsapp.parsed, '31988887777');
  assert.equal(parsed.fields.eventDate.parsed, '2026-12-03');
  assert.equal(parsed.fields.eventTime.parsed, '14:00');
});

test('parser: campos ausentes, ambíguos e baixa confiança são sinalizados', () => {
  const parsed = parseFormText('Nome\nJoão\nTelefone\n123\nData da festa\n12/03\nHorário\nde tarde', { today });
  assert.equal(parsed.fields.clientName.confidence, 'low'); // "Nome" sozinho é ambíguo
  assert.equal(parsed.fields.whatsapp.confidence, 'low');
  assert.equal(parsed.fields.whatsapp.parsed, undefined);
  assert.equal(parsed.fields.eventDate.confidence, 'low'); // sem ano
  assert.equal(parsed.fields.eventDate.parsed, '2027-03-12'); // próxima ocorrência
  assert.equal(parsed.fields.eventTime.confidence, 'low');
  assert.equal(parsed.fields.address, undefined);
  assert.equal(parseFormText('', { today }).childrenCount, 0);
});

test('parser: OCR rebaixa a confiança e avisa', () => {
  const normal = parseFormText('WhatsApp\n31999044206', { today });
  const ocr = parseFormText('WhatsApp\n31999044206', { today, ocr: true });
  assert.equal(normal.fields.whatsapp.confidence, 'high');
  assert.equal(ocr.fields.whatsapp.confidence, 'medium');
  assert.ok(ocr.warnings.some((w) => /OCR/.test(w)));
});

test('datas, horários e rótulos', () => {
  assert.deepEqual(parseDate('15/11/2026', today), { iso: '2026-11-15', ambiguous: false });
  assert.deepEqual(parseDate('5-1-27', today), { iso: '2027-01-05', ambiguous: false });
  assert.deepEqual(parseDate('2026-12-24', today), { iso: '2026-12-24', ambiguous: false });
  assert.equal(parseDate('31/02/2026', today), null);
  assert.equal(parseDate('sem data', today), null);
  assert.equal(parseTime('às 15 horas'), '15:00');
  assert.equal(parseTime('9h05'), '09:05');
  assert.equal(parseTime('25h'), null);
  assert.equal(classifyLabel('Carimbo de data/hora'), null);
  assert.equal(classifyLabel('E-mail'), null);
  assert.equal(classifyLabel('Local da festa').key, 'address');
});

test('conteúdo vazio quando nada é reconhecido; fingerprint estável e sensível ao conteúdo', async () => {
  assert.equal(buildOrderContent(parseFormText('texto solto sem perguntas', { today })), '');
  const a = await importFingerprint('Nome:  Maria\nData: 1');
  assert.equal(a, await importFingerprint('nome: maria data: 1'));
  assert.notEqual(a, await importFingerprint('Nome: Maria\nData: 2'));
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
});

test('PDF com texto selecionável: extrai sem OCR e o parser lê os campos', async () => {
  const pdf = makePdf([FORM.slice(0, 12), FORM.slice(12)]);
  let ocrCalls = 0;
  const result = await extractPdfText(pdf, { pdfjs, recognizePage: async () => { ocrCalls += 1; return ''; } });
  assert.equal(result.method, 'text');
  assert.equal(result.pages, 2);
  assert.equal(ocrCalls, 0);
  const parsed = parseFormText(result.text, { today });
  assert.equal(parsed.fields.clientName.value, 'Maria Souza');
  assert.equal(parsed.fields.eventDate.parsed, '2026-11-15');
  assert.equal(parsed.fields.address.value, 'Rua das Flores, 123, Bairro Centro - Betim');
});

test('PDF digitalizado (sem texto): usa o OCR por página e marca o método', async () => {
  const pdf = makePdf([[], []]);
  const progress = [];
  const result = await extractPdfText(pdf, {
    pdfjs, onProgress: (p) => progress.push(p.stage),
    recognizePage: async (_doc, page) => (page === 1 ? 'Nome do responsável\nCarla Dias\nWhatsApp\n31 97777-6666' : 'Data da festa\n20/12/2026'),
  });
  assert.equal(result.method, 'ocr');
  assert.equal(result.ocrPages, 2);
  assert.ok(progress.includes('ocr'));
  assert.equal(parseFormText(result.text, { ocr: true, today }).fields.clientName.value, 'Carla Dias');
});

test('PDF misto: só a página sem texto vai para o OCR', async () => {
  const pdf = makePdf([FORM.slice(0, 12), []]);
  const result = await extractPdfText(pdf, { pdfjs, recognizePage: async () => 'Observações\nlido por OCR' });
  assert.equal(result.method, 'mixed');
  assert.equal(result.ocrPages, 1);
  assert.match(result.text, /lido por OCR/);
});

test('erros claros: arquivo vazio, inválido, protegido, sem conteúdo e falha de OCR', async () => {
  const code = (promise) => promise.then(() => 'ok', (e) => (e instanceof PdfImportError ? e.code : `outro:${e.message}`));
  assert.equal(await code(extractPdfText(new Uint8Array(0), { pdfjs })), 'empty');
  assert.equal(await code(extractPdfText(new TextEncoder().encode('isto não é um pdf'), { pdfjs })), 'invalid_pdf');
  const locked = { getDocument: () => ({ promise: Promise.reject(Object.assign(new Error('x'), { name: 'PasswordException' })) }) };
  assert.equal(await code(extractPdfText(makePdf([['a']]), { pdfjs: locked })), 'password');
  assert.equal(await code(extractPdfText(makePdf([[]]), { pdfjs })), 'empty'); // sem texto e sem OCR disponível
  assert.equal(await code(extractPdfText(makePdf([[]]), { pdfjs, recognizePage: async () => '   ' })), 'empty'); // OCR não achou nada
  assert.equal(await code(extractPdfText(makePdf([[]]), { pdfjs, recognizePage: async () => { throw new Error('worker caiu'); } })), 'ocr_failed');
  assert.equal(await code(extractPdfText(new Uint8Array(16 * 1024 * 1024), { pdfjs })), 'too_large');
});

test('linhas: agrupa itens do mesmo Y e ordena por X', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y], height: 10 });
  assert.equal(linesFromTextItems([item('b', 80, 700), item('a', 10, 700.5), item('c', 10, 680)]), 'a b\nc');
});
