import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Copy, ExternalLink, Loader2, RotateCcw, Save } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { dateKey } from '../../functions/missions-core.js';
import { DEFAULT_VIDEO_CALL_CONFIG, normalizeVideoCallConfig, parseTimes, type VideoCallConfig } from '../../functions/video-call-config.js';
import { BUSINESS_TIME_ZONE, localSlot } from '../../functions/video-call-time.js';
import { listClients } from '../../services/clientsService';
import { subscribeVideoCallOrders } from '../../services/ordersService';
import { getVideoCallConfig, saveVideoCallConfig } from '../../services/siteConfigService';
import type { Client, Order } from '../../types';
import { ErrorNote, cardClass, ghostButton, inputClass, labelClass, primaryButton } from './missionsUi';

const PUBLIC_PATH = '/agendar-chamada';
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const brDate = (key: string) => key.split('-').reverse().join('/');
const weekday = (key: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));

/**
 * Módulo "Agendamento de chamadas" (filho de Calendário no menu). Aba Agendamentos: pré-agendamentos feitos pelo site, só leitura
 * (o pedido segue em Pedidos; o pagamento é confirmado pelo ManyChat). Aba Configurações: valor, horários, prazos e textos.
 */
export const AdminVideoCallsPage: React.FC = () => {
  const [tab, setTab] = useState<'list' | 'settings'>('list');
  const tabClass = (active: boolean) => `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${active ? 'bg-blue-600 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`;
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl"><CalendarCheck className="h-5 w-5 text-blue-400" />Agendamento de chamadas</h2>
          <p className="text-xs text-white/50">Vídeo Chamadas reservadas pelo site. O pagamento é confirmado pelo ManyChat; sem pagamento no prazo, a reserva é excluída sozinha.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-white/5 p-1" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')} className={tabClass(tab === 'list')}>Agendamentos</button>
          <button type="button" role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')} className={tabClass(tab === 'settings')}>Configurações</button>
        </div>
      </div>
      {tab === 'list' ? <BookingsList /> : <Settings />}
    </div>
  );
};

const BookingsList: React.FC = () => {
  const { navigate } = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [clients, setClients] = useState<Map<string, Client>>(new Map());
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeVideoCallOrders(dateKey(new Date()), (list) => { setOrders(list); setError(''); }, () => setError('Não foi possível carregar os agendamentos.')), []);
  useEffect(() => { listClients().then((list) => setClients(new Map(list.map((c) => [c.id, c])))).catch(() => {}); }, []);

  const rows = useMemo(() => [...(orders ?? [])].filter((o) => o.videoCall).sort((a, b) => `${a.videoCall.date}T${a.videoCall.time}`.localeCompare(`${b.videoCall.date}T${b.videoCall.time}`)), [orders]);
  const link = `${window.location.origin}${PUBLIC_PATH}`;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem área de transferência: o link está visível */ } };

  return (
    <>
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
          const call = order.videoCall;
          // Cliente em outro fuso: o horário dele ao lado do de Brasília (a agenda é sempre a de Brasília).
          const local = call.timezone && call.timezone !== BUSINESS_TIME_ZONE ? localSlot(call.date, call.time, call.timezone) : null;
          return (
            <li key={order.id}>
              <button type="button" onClick={() => navigate(`/admin/pedidos?orderId=${encodeURIComponent(order.id)}`)} className={`${cardClass} flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-left hover:bg-white/[0.03]`}>
                <span className="w-32 shrink-0 text-sm font-bold text-white">{weekday(order.videoCall.date)}, {brDate(order.videoCall.date)}<span className="block text-blue-300">{order.videoCall.time}</span></span>
                <span className="min-w-0 flex-1 text-sm text-white/80">
                  <span className="block truncate font-semibold text-white">{client?.name ?? 'Cliente'} · {order.childName} ({order.videoCall.childAge})</span>
                  <span className="block truncate text-xs text-white/50">{[client?.whatsapp, call.email, call.theme].filter(Boolean).join(' · ')}</span>
                  {local && !local.same && <span className="block truncate text-xs text-sky-300/80">Cliente em {call.timezone}: {brDate(local.date)} às {local.time} no horário dele</span>}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pending ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{pending ? 'Aguardando pagamento' : 'Confirmada'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
};

// ---------- Configurações ----------

interface Draft { price: string; durationMinutes: string; minNoticeHours: string; maxAdvanceDays: string; paymentDeadlineHours: string; expireAfterHours: string; weekly: string[]; busy: string; info: string; confirm: string; whatsapp: string; security: string }

const toDraft = (c: VideoCallConfig): Draft => ({
  price: String(c.price).replace('.', ','), durationMinutes: String(c.durationMinutes), minNoticeHours: String(c.minNoticeHours), maxAdvanceDays: String(c.maxAdvanceDays),
  paymentDeadlineHours: String(c.paymentDeadlineHours), expireAfterHours: String(c.expireAfterHours), weekly: WEEKDAYS.map((_, day) => (c.weekly[day] ?? []).join(', ')), busy: c.busyCalendarIds.join('\n'),
  info: c.texts.info, confirm: c.texts.confirm, whatsapp: c.texts.whatsapp, security: c.texts.security,
});

const NUMBER_FIELDS: { key: 'price' | 'durationMinutes' | 'minNoticeHours' | 'maxAdvanceDays' | 'paymentDeadlineHours' | 'expireAfterHours'; label: string; hint: string }[] = [
  { key: 'price', label: 'Valor (R$)', hint: 'Usado nos textos e gravado no pedido.' },
  { key: 'durationMinutes', label: 'Duração (min)', hint: 'Tamanho do evento na agenda.' },
  { key: 'paymentDeadlineHours', label: 'Prazo informado ao cliente (h)', hint: 'Aparece nos textos como {prazo}.' },
  { key: 'expireAfterHours', label: 'Exclusão automática (h)', hint: 'Sem pagamento, a reserva é excluída depois disso.' },
  { key: 'minNoticeHours', label: 'Antecedência mínima (h)', hint: 'Não agenda mais perto que isso.' },
  { key: 'maxAdvanceDays', label: 'Antecedência máxima (dias)', hint: 'Até quando o cliente pode agendar.' },
];

/** Lê o rascunho da tela; devolve a configuração pronta ou o primeiro problema encontrado. */
function fromDraft(draft: Draft): { config?: VideoCallConfig; problem?: string } {
  const raw = {
    price: Number(draft.price.replace(',', '.')), durationMinutes: Number(draft.durationMinutes), minNoticeHours: Number(draft.minNoticeHours),
    maxAdvanceDays: Number(draft.maxAdvanceDays), paymentDeadlineHours: Number(draft.paymentDeadlineHours), expireAfterHours: Number(draft.expireAfterHours),
    weekly: Object.fromEntries(draft.weekly.map((value, day) => [day, parseTimes(value)])),
    busyCalendarIds: draft.busy.split(/\s+/).filter(Boolean),
    texts: { info: draft.info, confirm: draft.confirm, whatsapp: draft.whatsapp, security: draft.security },
  };
  if (raw.expireAfterHours < raw.paymentDeadlineHours) return { problem: 'A exclusão automática não pode acontecer antes do prazo informado ao cliente.' };
  const config = normalizeVideoCallConfig(raw);
  // O normalizador troca valor inválido pelo padrão; aqui isso vira aviso, para nada ser salvo diferente do que foi digitado.
  for (const { key, label } of NUMBER_FIELDS) if (config[key] !== raw[key]) return { problem: `Confira o campo "${label}".` };
  const typed = draft.weekly.map((value) => value.split(/[\s,;]+/).filter(Boolean).length);
  const badDay = typed.findIndex((count, day) => count !== (config.weekly[day] ?? []).length);
  if (badDay >= 0) return { problem: `Horários de ${WEEKDAYS[badDay]}: use o formato HH:MM separado por vírgula, sem repetir (ex.: 19:30, 20:00).` };
  if (!Object.keys(config.weekly).length) return { problem: 'Informe ao menos um horário em algum dia da semana.' };
  for (const [key, label] of [['info', 'Informações'], ['confirm', 'Aviso final'], ['whatsapp', 'Mensagem do WhatsApp'], ['security', 'Aviso de segurança']] as const) if (!draft[key].trim()) return { problem: `O texto "${label}" não pode ficar vazio.` };
  return { config };
}

const Settings: React.FC = () => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);

  // Confere a página pública de verdade (mesma chamada que o cliente faz): mostra se as agendas configuradas estão acessíveis.
  const runCheck = useCallback(async () => {
    setCheck(null);
    try {
      const response = await fetch('/api/video-call');
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error?.message || 'erro');
      const count = (data.days as { times: string[] }[]).reduce((sum, day) => sum + day.times.length, 0);
      setCheck({ ok: true, message: `Página pública funcionando: ${count} ${count === 1 ? 'horário livre' : 'horários livres'} agora.` });
    } catch {
      setCheck({ ok: false, message: 'A página pública está com erro ao consultar a agenda. Confira se as agendas extras estão compartilhadas com a conta de serviço do sistema.' });
    }
  }, []);

  useEffect(() => { getVideoCallConfig().then((c) => setDraft(toDraft(c))).catch(() => setError('Não foi possível carregar as configurações.')); runCheck(); }, [runCheck]);

  if (!draft) return error ? <ErrorNote message={error} /> : <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</p>;

  const set = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); setSaved(false); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const { config, problem } = fromDraft(draft);
    if (!config) { setError(problem ?? 'Confira os campos.'); return; }
    setSaving(true);
    setError('');
    try {
      await saveVideoCallConfig(config);
      setDraft(toDraft(config));
      setSaved(true);
      runCheck();
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };
  const textArea = (key: 'info' | 'confirm' | 'whatsapp' | 'security', title: string, hint: string, rows: number) => (
    <label className={labelClass}>{title}
      <textarea rows={rows} value={draft[key]} onChange={(e) => set({ [key]: e.target.value })} className={inputClass} />
      <span className="mt-1 block font-normal text-white/40">{hint}</span>
    </label>
  );

  return (
    <form onSubmit={save} className="space-y-4">
      {check && <p className={`rounded-xl border px-3 py-2 text-xs ${check.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{check.message}</p>}

      <section className={`${cardClass} space-y-4`}>
        <h3 className="font-bold text-white">Valor e prazos</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NUMBER_FIELDS.map(({ key, label, hint }) => (
            <label key={key} className={labelClass}>{label}
              <input inputMode="decimal" value={draft[key]} onChange={(e) => set({ [key]: e.target.value })} className={inputClass} />
              <span className="mt-1 block font-normal text-white/40">{hint}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={`${cardClass} space-y-3`}>
        <div>
          <h3 className="font-bold text-white">Dias e horários</h3>
          <p className="text-xs text-white/50">Horários de início (horário de Brasília), separados por vírgula. Deixe o dia vazio para não atender.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {WEEKDAYS.map((name, day) => (
            <label key={name} className={labelClass}>{name}
              <input placeholder="Sem atendimento" value={draft.weekly[day]} onChange={(e) => set({ weekly: draft.weekly.map((value, i) => (i === day ? e.target.value : value)) })} className={inputClass} />
            </label>
          ))}
        </div>
      </section>

      <section className={`${cardClass} space-y-4`}>
        <div>
          <h3 className="font-bold text-white">Textos</h3>
          <p className="text-xs text-white/50">Use **negrito** entre dois asteriscos e uma linha em branco entre parágrafos. Variáveis: {'{valor}'}, {'{duracao}'} e {'{prazo}'}.</p>
        </div>
        {textArea('info', 'Informações (aparecem quando o cliente escolhe o horário)', 'Se mudar os dias de atendimento, lembre de ajustar a última frase.', 10)}
        {textArea('confirm', 'Aviso final (acima do botão de prosseguir)', 'Mostrado depois que o cliente preenche os dados.', 3)}
        {textArea('whatsapp', 'Mensagem enviada no WhatsApp', 'Só dos agendamentos; os links dos serviços não mudam. Aceita também {data} e {horario}.', 3)}
        {textArea('security', 'Aviso de segurança (com cadeado, abaixo do agendamento)', 'Aparece em letras pequenas na página /agendar-chamada. Mantenha curto.', 3)}
      </section>

      <section className={`${cardClass} space-y-2`}>
        <h3 className="font-bold text-white">Agendas extras para checar conflitos</h3>
        <p className="text-xs text-white/50">Além da agenda do sistema, horários ocupados nestas agendas do Google também ficam indisponíveis (ex.: sua agenda pessoal, onde o Calendly gravava). Um ID por linha; cada agenda precisa estar compartilhada com a conta de serviço do sistema, com permissão para ver os eventos. Se uma delas não estiver acessível, a página pública para de mostrar horários.</p>
        <textarea rows={2} placeholder="exemplo@gmail.com" value={draft.busy} onChange={(e) => set({ busy: e.target.value })} className={inputClass} />
      </section>

      <ErrorNote message={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className={primaryButton}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar configurações</button>
        <button type="button" onClick={() => { setDraft(toDraft(DEFAULT_VIDEO_CALL_CONFIG)); setSaved(false); setError(''); }} className={ghostButton}><RotateCcw className="h-3.5 w-3.5" />Restaurar padrão</button>
        {saved && <span className="text-sm font-semibold text-emerald-300">Salvo!</span>}
      </div>
    </form>
  );
};
