import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { orderPdfInput } from '../../../services/eventOrderPdf.js';
import { getEventFormConfig } from '../../../services/siteConfigService';
import type { Client, Order } from '../../../types';

/**
 * Baixa o formulário do evento em PDF: o mesmo que o cliente baixou (pedidos do formulário do site) ou um PDF com os dados do
 * CRM e os termos do Google Forms (pedidos importados ou criados à mão). Gerado no navegador; jsPDF só carrega no clique.
 */
export const FormPdfButton: React.FC<{ order: Order; client: Client | null | undefined }> = ({ order, client }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    setBusy(true); setError('');
    try {
      const input = orderPdfInput(order, client, await getEventFormConfig());
      if (!input) throw new Error('Este pedido não tem os dados do evento.');
      const { downloadEventFormPdf } = await import('../../../services/eventFormPdf');
      await downloadEventFormPdf(input);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.'); }
    setBusy(false);
  };
  return (
    <>
      <button type="button" onClick={download} disabled={busy} title={order.eventFormSite?.form ? 'Mesmo PDF que o cliente baixou' : 'Dados do CRM + termos do Google Forms'}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Baixar formulário (PDF)
      </button>
      {error && <span role="alert" className="text-[11px] font-semibold text-red-300">{error}</span>}
    </>
  );
};
