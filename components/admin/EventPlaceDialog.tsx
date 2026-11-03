import React, { useEffect, useState } from 'react';
import { ChevronLeft, ExternalLink, Loader2, X } from 'lucide-react';
import type { Order } from '../../types';
import { useRouter } from '../../lib/router';
import { getClientById } from '../../services/clientsService';
import { getServiceById } from '../../services/servicesService';
import { buildOrderRows } from './orders/orderDetails';
import { STATUS_LABELS } from './orders/orderView';

/** Evento mostrado na janela: pedido do CRM (`order`) ou evento antigo importado do PDF do Google. */
export interface PlaceEvent { key: string; date: Date | null; time: string; name: string; location: string; order?: Order }

type Row = [string, string];

const historyRows = (e: PlaceEvent): Row[] => [
  ['Nome da criança', e.name],
  ['Data do evento', e.date ? e.date.toLocaleDateString('pt-BR') : '—'],
  ['Horário de início', e.time || '—'],
  ['Local', e.location || '—'],
  ['Origem', 'PDF do Google Forms (importado no Mapa)'],
];

/** Linhas do pedido iguais às do Kanban (busca cliente e serviço só ao abrir: 2 leituras). */
const useRows = (e: PlaceEvent | null) => {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    setRows(null);
    if (!e) return;
    const order = e.order;
    if (!order) { setRows(historyRows(e)); return; }
    let alive = true;
    Promise.all([getClientById(order.clientId).catch(() => null), getServiceById(order.serviceId).catch(() => null)])
      .then(([client, service]) => { if (alive) setRows(buildOrderRows({ order, client, service }, []).detailRows as Row[]); });
    return () => { alive = false; };
  }, [e]);
  return rows;
};

const DialogHeader: React.FC<{ events: PlaceEvent[]; picked: PlaceEvent | null; onBack: () => void; onClose: () => void }> = ({ events, picked, onBack, onClose }) => {
  const subtitle = !picked ? events[0]?.location : picked.order ? STATUS_LABELS[picked.order.status] : 'Evento antigo (Google)';
  return (
    <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
      {picked && events.length > 1 && (
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Voltar para a lista"><ChevronLeft className="h-4 w-4" /></button>
      )}
      <div className="min-w-0 flex-1">
        <h2 id="place-dialog-title" className="truncate text-lg font-extrabold text-white">{picked ? picked.name : `${events.length} eventos neste local`}</h2>
        <p className="truncate text-xs text-white/50">{subtitle}</p>
      </div>
      <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Fechar"><X className="h-5 w-5" /></button>
    </header>
  );
};

const PlaceList: React.FC<{ events: PlaceEvent[]; onPick: (e: PlaceEvent) => void }> = ({ events, onPick }) => (
  <ul className="space-y-1.5">
    {events.map((e) => (
      <li key={e.key}>
        <button type="button" onClick={() => onPick(e)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-left hover:bg-white/5">
          <span className="w-20 shrink-0 text-xs tabular-nums text-white/60">{e.date ? e.date.toLocaleDateString('pt-BR') : 'sem data'}</span>
          <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-orange-300">{e.time}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{e.name}</span>
          {!e.order && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/50">Google</span>}
        </button>
      </li>
    ))}
  </ul>
);

/**
 * Janela do clique numa bolinha do Mapa. Um evento: mostra os dados direto. Vários no mesmo local: lista para escolher um.
 * Só leitura; "Abrir no Kanban" leva à janela completa do pedido (editar, mudar etapa etc.).
 */
export const EventPlaceDialog: React.FC<{ events: PlaceEvent[]; onClose: () => void }> = ({ events, onClose }) => {
  const { navigate } = useRouter();
  const [picked, setPicked] = useState<PlaceEvent | null>(events.length === 1 ? events[0] : null);
  const rows = useRows(picked);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="place-dialog-title" className="my-auto max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
        <DialogHeader events={events} picked={picked} onBack={() => setPicked(null)} onClose={onClose} />

        <div className="space-y-4 p-5 sm:p-6">
          {!picked && <PlaceList events={events} onPick={setPicked} />}

          {picked && !rows && <div className="flex justify-center py-8 text-white/50"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {picked && rows && (
            <dl className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label} className="min-w-0 border-b border-white/[0.07] py-2.5">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">{label}</dt>
                  <dd className="mt-0.5 break-words text-sm text-white/85">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {picked?.order && (
            <button type="button" onClick={() => navigate(`/admin/pedidos?orderId=${encodeURIComponent(picked.order?.id ?? '')}`)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
              <ExternalLink className="h-4 w-4" />Abrir no Kanban
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
