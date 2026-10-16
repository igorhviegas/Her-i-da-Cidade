// PDF do formulário do evento + termos aceitos, gerado no navegador do cliente na tela final (jsPDF carregado só ali).
// Fontes padrão do PDF (Helvetica/WinAnsi): acentos do português funcionam; emojis e setas não, então o texto não usa.
import { PACKAGES } from './eventQuote.js';
import { ADDON_PRICES, formatCpf } from './eventSiteForm.js';
import { PROVIDER, termsSections } from './eventTerms.js';
import type { SiteFormValues } from './eventSiteForm.js';

export interface PdfInput { form: SiteFormValues; label: string; acceptedAtMs: number; termsVersion: string; total: number; whatsappLabel: string }

const brDate = (key: string) => key.split('-').reverse().join('/');
const brl = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

/** Monta o PDF (sem baixar). */
export async function buildEventFormPdf({ form, label, acceptedAtMs, termsVersion, total, whatsappLabel }: PdfInput) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pack = PACKAGES.find((p) => p.id === form.packageId);
  const accepted = new Date(acceptedAtMs).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const width = 210;
  const margin = 16;
  const usable = width - margin * 2;
  let y = 0;

  const header = () => {
    pdf.setFillColor(13, 21, 39);
    pdf.rect(0, 0, width, 24, 'F');
    pdf.setFillColor(0, 114, 210);
    pdf.rect(0, 24, width, 1.2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('HERÓI DA CIDADE ®', margin, 11);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`Formulário da Missão ${label}`, margin, 17.5);
    pdf.text(`CNPJ ${PROVIDER.cnpj}`, width - margin, 17.5, { align: 'right' });
    pdf.setTextColor(30, 30, 30);
    y = 34;
  };
  const ensure = (needed: number) => { if (y + needed > 282) { pdf.addPage(); header(); } };
  const heading = (text: string) => {
    ensure(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 90, 170);
    pdf.text(text, margin, y);
    pdf.setTextColor(30, 30, 30);
    y += 6;
  };
  const paragraph = (text: string, size = 9.5) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size);
    for (const line of pdf.splitTextToSize(text, usable) as string[]) { ensure(5); pdf.text(line, margin, y); y += size * 0.45; }
    y += 1.2;
  };
  const row = (name: string, value: string) => {
    pdf.setFontSize(9.5);
    pdf.setFont('helvetica', 'bold');
    const lines = pdf.splitTextToSize(value || '—', usable - 52) as string[];
    ensure(lines.length * 4.6 + 1);
    pdf.text(name, margin, y);
    pdf.setFont('helvetica', 'normal');
    lines.forEach((line, i) => pdf.text(line, margin + 52, y + i * 4.6));
    y += lines.length * 4.6 + 1.4;
  };

  header();
  const isVip = form.packageId === 'vip';
  heading('Pacote');
  row('Tipo do evento', pack?.title ?? form.packageId);
  row('Duração', pack?.duration ?? '');
  heading(isVip ? 'Evento' : 'Aniversariante');
  row(isVip ? 'Nome do evento' : 'Nome', form.childName);
  if (form.childAge) row('Idade', form.childAge);
  row('PCD/PNE', form.pcd === true ? `Sim${form.pcdDetails ? `: ${form.pcdDetails}` : ''}` : form.pcd === false ? 'Não' : 'Não informado');
  heading('Dados do evento');
  row('Data', brDate(form.eventDate));
  row('Horário de início', form.eventTime);
  row('Endereço', form.location);
  if (form.reference) row('Ponto de referência', form.reference);
  heading('Responsável');
  row('Nome', form.responsibleName);
  row('CPF', formatCpf(form.cpf));
  row('WhatsApp', whatsappLabel);
  row('E-mail', form.email);
  heading('Adicionais');
  row('Teia extra', form.extraWeb ? `${form.extraWeb} lançamento(s) extra(s) (+${brl(form.extraWeb * ADDON_PRICES.extraWeb)})` : 'Não');
  row('Vídeo de Aniversário', form.birthdayVideo ? `Sim, para ${form.birthdayName} (+${brl(ADDON_PRICES.birthdayVideo)})` : 'Não');
  row('Vídeo Convite', form.inviteVideo ? `Sim (+${brl(ADDON_PRICES.inviteVideo)})${form.inviteDetails ? `. Detalhes: ${form.inviteDetails}` : ''}` : 'Não');
  if (form.observations) row('Observações', form.observations);
  heading('Valor e reserva');
  paragraph(total > 0
    ? `Valor total: ${brl(total)} (orçamento + adicionais). Sinal de 50%: ${brl(total / 2)}, para reservar a data.`
    : 'Valor total: conforme o orçamento enviado pelo WhatsApp, somado aos adicionais. A data é reservada com o sinal de 50%.');
  heading('Autorizações');
  row('Termos de contratação', `Li e aceito (versão ${termsVersion})`);
  row('Uso de imagens', form.imageAuthorization ? 'Autorizo' : 'Não autorizo');
  row('Enviado em', `${accepted} (horário de Brasília)`);

  pdf.addPage();
  header();
  heading('TERMOS DE PRESTAÇÃO DE SERVIÇO: PRESENÇA TEATRAL');
  paragraph(`Formulário ${label} · Versão dos termos: ${termsVersion} · Aceito em ${accepted}`, 8.5);
  for (const section of termsSections({
    number: label, packageTitle: pack?.title, duration: pack?.duration, date: brDate(form.eventDate), time: form.eventTime, location: form.location,
    name: form.responsibleName, cpf: formatCpf(form.cpf), whatsapp: whatsappLabel, email: form.email,
  })) {
    heading(section.title);
    section.items.forEach((item, index) => paragraph(`${index + 1}. ${item}`, 9));
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(7.5);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`${PROVIDER.tradeName} · heroidacidade.com · Formulário ${label} · página ${page} de ${pages}`, width / 2, 291, { align: 'center' });
  }
  return pdf;
}

export async function downloadEventFormPdf(input: PdfInput): Promise<void> {
  const pdf = await buildEventFormPdf(input);
  pdf.save(`Formulario ${input.label} - ${input.form.childName}.pdf`.replace(/[\\/:*?"<>|]/g, ''));
}
