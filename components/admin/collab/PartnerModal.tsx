import React, { FormEvent, useState } from 'react';
import { AlertCircle, ExternalLink, Gift, Loader2, MessageCircle, Plus, Trash2, X } from 'lucide-react';
import {
  CRITERIA, GRANT_SERVICES, PROJECT_THEMES, REEL_STATUSES, STATUSES, brDate, couponState, normalizeCouponCode, partnerDeadlines, whatsappLink,
} from '../../../services/collab.js';
import type { CollabGrant, CollabPartner } from '../../../services/collab.js';
import type { PartnerInput } from '../../../services/collabService';
import type { Order, OrderStatus } from '../../../types';

// text-base no celular: campo com fonte menor que 16px faz o iPhone dar zoom ao focar.
export const fieldClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-base text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50 sm:text-sm';
export const labelClass = 'block text-xs font-semibold text-white/70';
const sectionClass = 'space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3';
const STATUS_NAMES: Record<OrderStatus, string> = { scheduled: 'Agendado', recording: 'Gravar', editing: 'Editar', delivery: 'Entregar', completed: 'Entregue' };

const EMPTY: PartnerInput = {
  name: '', instagram: '', whatsapp: '', city: '', children: [], contentType: '', status: 'prospect', criteria: {}, publicationModel: '', theme: '',
  briefingUrl: '', conditionsAt: '', reelStatus: '', reelUrl: '', reelPublishedAt: '', storiesAt: '', couponCode: '', notes: '',
};
const inputOf = (p: CollabPartner): PartnerInput => ({
  name: p.name, instagram: p.instagram, whatsapp: p.whatsapp, city: p.city, children: p.children, contentType: p.contentType, status: p.status, criteria: p.criteria,
  publicationModel: p.publicationModel, theme: p.theme, briefingUrl: p.briefingUrl, conditionsAt: p.conditionsAt, reelStatus: p.reelStatus, reelUrl: p.reelUrl,
  reelPublishedAt: p.reelPublishedAt, storiesAt: p.storiesAt, couponCode: p.couponCode, notes: p.notes,
});

interface Props {
  /** null = nova parceira. */
  partner: CollabPartner | null;
  /** Outras parceiras (para não repetir o código do cupom). */
  others: CollabPartner[];
  ordersById: Map<string, Order>;
  remaining: Record<string, number>;
  today: string;
  onClose: () => void;
  onSave: (input: PartnerInput) => Promise<void>;
  onDelete: (partner: CollabPartner) => void;
  onGrant: (partner: CollabPartner, serviceId: string) => Promise<void>;
  onRemoveGrant: (partner: CollabPartner, grant: CollabGrant) => Promise<void>;
}

/** Ficha da criadora: dados do formulário, critérios, andamento da Collab, cupom e benefícios concedidos. */
export const PartnerModal: React.FC<Props> = ({ partner, others, ordersById, remaining, today, onClose, onSave, onDelete, onGrant, onRemoveGrant }) => {
  const [values, setValues] = useState<PartnerInput>(partner ? inputOf(partner) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [grantService, setGrantService] = useState('');
  const set = (patch: Partial<PartnerInput>) => { setValues((v) => ({ ...v, ...patch })); setError(''); };
  const deadlines = partnerDeadlines(values);
  const coupon = couponState(values, today);
  const code = normalizeCouponCode(values.couponCode);
  const codeTaken = !!code && others.some((other) => normalizeCouponCode(other.couponCode) === code);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (codeTaken) { setError(`O cupom ${code} já é de outra parceira.`); return; }
    setSaving(true);
    try { await onSave(values); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); setSaving(false); }
  };

  const grant = async () => {
    if (!partner || !grantService || saving) return;
    setSaving(true); setError('');
    try { await onGrant(partner, grantService); setGrantService(''); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível conceder.'); }
    setSaving(false);
  };
  const ungrant = async (item: CollabGrant) => {
    if (!partner || saving || !window.confirm('Liberar esta vaga? O pedido do benefício continua no Kanban (exclua lá se não for mais entregar).')) return;
    setSaving(true);
    try { await onRemoveGrant(partner, item); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível liberar.'); }
    setSaving(false);
  };

  const chat = partner?.whatsappNormalized ? whatsappLink(partner.whatsappNormalized, `Oi, ${partner.name.split(' ')[0]}! Aqui é do Herói da Cidade.`) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="partner-modal-title" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#0D1527] shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id="partner-modal-title" className="truncate text-base font-bold text-white">{partner ? partner.name : 'Nova parceira'}</h2>
            {partner && <p className="text-[11px] text-white/45">{partner.source === 'form' ? `Formulário enviado${partner.formAtMs ? ` em ${new Date(partner.formAtMs).toLocaleDateString('pt-BR')}` : ''}` : 'Cadastrada pela equipe'}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {partner?.instagram && <a href={`https://instagram.com/${partner.instagram}`} target="_blank" rel="noopener noreferrer" aria-label="Abrir Instagram" className="flex h-10 w-10 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"><ExternalLink className="h-4 w-4" /></a>}
            {chat && <a href={chat} target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-xl text-emerald-300 hover:bg-emerald-500/10"><MessageCircle className="h-4 w-4" /></a>}
            <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
        </header>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClass}>Nome *<input required value={values.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} className={fieldClass} /></label>
              <label className={labelClass}>Status
                <select value={values.status} onChange={(e) => set({ status: e.target.value as PartnerInput['status'] })} className={fieldClass}>
                  {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className={labelClass}>@ Instagram<input value={values.instagram} onChange={(e) => set({ instagram: e.target.value })} maxLength={60} className={fieldClass} placeholder="@perfil" autoCapitalize="none" /></label>
              <label className={labelClass}>WhatsApp<input value={values.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} maxLength={30} className={fieldClass} placeholder="(31) 99999-0000" inputMode="tel" /></label>
              <label className={labelClass}>Cidade<input value={values.city} onChange={(e) => set({ city: e.target.value })} maxLength={80} className={fieldClass} /></label>
              <label className={labelClass}>Tipo de conteúdo<input value={values.contentType} onChange={(e) => set({ contentType: e.target.value })} maxLength={500} className={fieldClass} /></label>
            </div>

            <div className={sectionClass}>
              <p className="text-xs font-bold uppercase tracking-wide text-white/50">Filhos (primeiro nome e idade)</p>
              {values.children.map((child, index) => (
                <div key={index} className="flex items-end gap-2">
                  <label className={`${labelClass} min-w-0 flex-1`}>Nome<input value={child.name} onChange={(e) => set({ children: values.children.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)) })} maxLength={40} className={fieldClass} /></label>
                  <label className={`${labelClass} w-24`}>Idade<input value={child.age} onChange={(e) => set({ children: values.children.map((c, i) => (i === index ? { ...c, age: e.target.value } : c)) })} maxLength={20} className={fieldClass} /></label>
                  <button type="button" onClick={() => set({ children: values.children.filter((_, i) => i !== index) })} aria-label="Remover" className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/50 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => set({ children: [...values.children, { name: '', age: '' }] })} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-blue-300"><Plus className="h-4 w-4" />Adicionar</button>
              {partner?.terms && <p className="text-[11px] text-white/50">Termo {partner.terms.version} aceito em {new Date(partner.terms.acceptedAtMs).toLocaleString('pt-BR')} · crianças no conteúdo: <strong className="text-white/80">{partner.terms.childImage ? 'autorizado' : 'não autorizado'}</strong></p>}
            </div>

            <fieldset className={sectionClass}>
              <legend className="px-1 text-xs font-bold uppercase tracking-wide text-white/50">Critérios (seleção manual)</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CRITERIA.map(([id, label]) => (
                  <label key={id} className="flex min-h-10 items-center gap-2 text-sm text-white/80">
                    <input type="checkbox" checked={values.criteria[id] === true} onChange={(e) => set({ criteria: { ...values.criteria, [id]: e.target.checked } })} className="h-4 w-4 accent-blue-500" />{label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={sectionClass}>
              <p className="text-xs font-bold uppercase tracking-wide text-white/50">Collab</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelClass}>Tema ou serviço
                  <input list="collab-themes" value={values.theme} onChange={(e) => set({ theme: e.target.value })} maxLength={120} className={fieldClass} placeholder="Escolha ou digite" />
                  <datalist id="collab-themes">{[...GRANT_SERVICES.map((s) => s.label), ...PROJECT_THEMES].map((t) => <option key={t} value={t} />)}</datalist>
                </label>
                <label className={labelClass}>Formato de publicação
                  <select value={values.publicationModel} onChange={(e) => set({ publicationModel: e.target.value as PartnerInput['publicationModel'] })} className={fieldClass}>
                    <option value="">A definir</option><option value="A">A · criadora publica e convida</option><option value="B">B · Herói da Cidade publica e convida</option>
                  </select>
                </label>
                <label className={labelClass}>Link do briefing<input type="url" value={values.briefingUrl} onChange={(e) => set({ briefingUrl: e.target.value })} className={fieldClass} placeholder="https://" /></label>
                <label className={labelClass}>Condições definidas em
                  <input type="date" value={values.conditionsAt} onChange={(e) => set({ conditionsAt: e.target.value })} className={fieldClass} />
                  {deadlines.productionDue && <span className="mt-1 block text-[11px] text-white/45">Prazo de produção: {brDate(deadlines.productionDue)}</span>}
                </label>
                <label className={labelClass}>Reel
                  <select value={values.reelStatus} onChange={(e) => set({ reelStatus: e.target.value as PartnerInput['reelStatus'] })} className={fieldClass}>
                    {REEL_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className={labelClass}>Link do Reel publicado<input type="url" value={values.reelUrl} onChange={(e) => set({ reelUrl: e.target.value })} className={fieldClass} placeholder="https://instagram.com/reel/…" /></label>
                <label className={labelClass}>Reel publicado em
                  <input type="date" value={values.reelPublishedAt} onChange={(e) => set({ reelPublishedAt: e.target.value })} className={fieldClass} />
                  {deadlines.keepUntil && <span className="mt-1 block text-[11px] text-white/45">Permanência mínima até {brDate(deadlines.keepUntil)}</span>}
                </label>
                <label className={labelClass}>Stories publicados em<input type="date" value={values.storiesAt} onChange={(e) => set({ storiesAt: e.target.value })} className={fieldClass} /></label>
              </div>
            </div>

            <div className={sectionClass}>
              <label className={labelClass}>Cupom (o mesmo código do campo CUPOM no ManyChat)
                <input value={values.couponCode} onChange={(e) => set({ couponCode: e.target.value })} maxLength={30} className={`${fieldClass} uppercase`} placeholder="Ex.: MARI5" autoCapitalize="characters" />
              </label>
              {code && <p className={`text-[11px] ${codeTaken ? 'text-red-300' : 'text-white/55'}`}>
                {codeTaken ? `${code} já é de outra parceira.`
                  : coupon.state === 'waiting' ? `${code}: começa a valer na publicação do Reel (30 dias).`
                    : coupon.state === 'active' ? `${code}: válido até ${brDate(coupon.until)} (${coupon.daysLeft === 0 ? 'vence hoje' : `faltam ${coupon.daysLeft} dia(s)`}).`
                      : `${code}: venceu em ${brDate(coupon.until)}.`}
              </p>}
            </div>

            {partner && (
              <div className={sectionClass}>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/50"><Gift className="h-3.5 w-3.5" />Benefícios concedidos</p>
                {partner.grants.length === 0 && <p className="text-xs text-white/45">Nenhum ainda.</p>}
                {partner.grants.map((item) => {
                  const order = ordersById.get(item.orderId);
                  return (
                    <div key={`${item.orderId}-${item.serviceId}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-white/85">{GRANT_SERVICES.find((s) => s.serviceId === item.serviceId)?.label ?? item.serviceId} · {brDate(item.at)}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] text-white/50">{order ? STATUS_NAMES[order.status] : 'Pedido excluído'}</span>
                        <button type="button" onClick={() => void ungrant(item)} disabled={saving} aria-label="Liberar vaga" className="flex h-9 w-9 items-center justify-center rounded-lg text-white/45 hover:bg-white/10"><X className="h-4 w-4" /></button>
                      </span>
                    </div>
                  );
                })}
                <div className="flex gap-2">
                  <select value={grantService} onChange={(e) => setGrantService(e.target.value)} className={`${fieldClass} mt-0 min-w-0 flex-1`} aria-label="Serviço a conceder">
                    <option value="">Conceder serviço…</option>
                    {GRANT_SERVICES.map((s) => <option key={s.serviceId} value={s.serviceId} disabled={remaining[s.serviceId] <= 0}>{s.label} ({remaining[s.serviceId]} vaga(s))</option>)}
                  </select>
                  <button type="button" onClick={() => void grant()} disabled={!grantService || saving} className="min-h-11 shrink-0 rounded-xl bg-blue-600/20 px-4 text-sm font-bold text-blue-100 hover:bg-blue-600/30 disabled:opacity-40">Conceder</button>
                </div>
                <p className="text-[11px] text-white/40">Abre um pedido sem valor no Kanban para a criadora; a entrega segue o prazo normal do serviço.</p>
              </div>
            )}

            <label className={labelClass}>Notas e histórico
              <textarea rows={4} value={values.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={5000} className={`${fieldClass} resize-y`} placeholder="Ex.: 12/10 Larissa fez o 1º contato pelo Instagram…" />
            </label>
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {partner ? <button type="button" onClick={() => onDelete(partner)} disabled={saving} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-200/80 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="h-4 w-4" />Excluir</button> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-white/60 hover:bg-white/5">Cancelar</button>
              <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
};
