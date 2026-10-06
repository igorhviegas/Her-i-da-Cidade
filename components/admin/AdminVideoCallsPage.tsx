import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { dateKey } from '../../functions/missions-core.js';
import { listClients } from '../../services/clientsService';
import { subscribeVideoCallOrders } from '../../services/ordersService';
import type { Client, Order } from '../../types';
import { ErrorNote, cardClass, ghostButton } from './missionsUi';

const PUBLIC_PATH = '/agendar-chamada';
const brDate = (key: string) => key.split('-').reverse().join('/');
const weekday = (key: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));

/**
 * Pré-agendamentos de Vídeo Chamada feitos pelo site (a partir de hoje). Só leitura: o pedido segue sendo gerido em Pedidos
 * (clique para abrir) e o pagamento é confirmado pelo ManyChat. Cancelar = excluir o pedido e o evento no Calendário;
 * o horário volta a ficar livre sozinho quando o pedido deixa de existir.
 */
export const AdminVideoCallsPage: React.FC = () => {
  const { navigate } = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [clients, setClients] = useState<Map<string, Client>>(new Map());
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeVideoCallOrders(dateKey(new Date()), (list) => { setOrders(list); setError(''); }, () => setError('Não foi possível carregar os agendamentos.')), []);
  useEffect(() => { listClients().then((list) => setClients(new Map(list.map((c) => [c.id, c])))).catch(() => {}); }, []);

  const rows = useMemo(() => [...(orders ?? [])].filter((o) => o.videoCall).sort((a, b) => `${a.videoCall!.date}T${a.videoCall!.time}`.localeCompare(`${b.videoCall!.date}T${b.videoCall!.time}`)), [orders]);
  const link = `${window.location.origin}${PUBLIC_PATH}`;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem área de transferência: o link está visível */ } };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl"><CalendarCheck className="h-5 w-5 text-blue-400" />Agendamento de chamadas</h2>
        <p className="text-xs text-white/50">Vídeo Chamadas reservadas pelo site. O pagamento é confirmado pelo ManyChat; reservas sem pagamento são canceladas manualmente.</p>
      </div>

      <div className={`${cardClass} flex flex-wrap items-center gap-3`}>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">Link público de agendamento</p>
          <p className="truncate text-sm text-white/80">{link}</p>
        </div>
        <button type="button" onClick={copy} className={ghostButton}><Copy className="h-3.5 w-3.5" />{copied ? 'Copiado!' : 'Copiar'}</button>
        <a href={PUBLIC_PATH} target="_blank" rel="noreferrer" className={ghostButton}><ExternalLink className="h-3.5 w-3.5" />Abrir</a>
      </div>

      <ErrorNote message={error} />
      {!orders && !error && <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</p>}
      {orders && rows.length === 0 && <p className="text-sm text-white/50">Nenhuma chamada agendada pelo site daqui para frente.</p>}

      <ul className="space-y-2">
        {rows.map((order) => {
          const client = clients.get(order.clientId);
          const pending = order.paymentPending === true;
          return (
            <li key={order.id}>
              <button type="button" onClick={() => navigate(`/admin/pedidos?orderId=${encodeURIComponent(order.id)}`)} className={`${cardClass} flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-left hover:bg-white/[0.03]`}>
                <span className="w-32 shrink-0 text-sm font-bold text-white">{weekday(order.videoCall!.date)}, {brDate(order.videoCall!.date)}<span className="block text-blue-300">{order.videoCall!.time}</span></span>
                <span className="min-w-0 flex-1 text-sm text-white/80">
                  <span className="block truncate font-semibold text-white">{client?.name ?? 'Cliente'} · {order.childName} ({order.videoCall!.childAge})</span>
                  <span className="block truncate text-xs text-white/50">{client?.whatsapp} · {order.videoCall!.theme}</span>
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pending ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{pending ? 'Aguardando pagamento' : 'Confirmada'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
