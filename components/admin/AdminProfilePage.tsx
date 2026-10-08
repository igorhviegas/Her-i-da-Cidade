import React, { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, Coins, Eye, EyeOff, Flag, Loader2, Pencil, ShoppingBag, Sparkles, Swords, TrendingDown, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { subscribeCompletedOrders, listFixedExpenses } from '../../services/financeService';
import { useXp } from '../../context/XpContext';
import { activateXp, loadProfileCounts, previewBaseline } from '../../services/xpService';
import {
  buildRevenueEntries, editingCostForMonth, eventCostForMonth, expensesForMonth, monthKeyOf, shiftMonth, type FixedExpense,
} from '../../services/financeCalculations.js';
import { levelInfo } from '../../functions/xp.js';
import { cardClass, formatMoney, ghostBtn, inputClass, labelClass, primaryBtn } from './financeFormat';

const HIDDEN_KEY = 'hdc.finance.revenueHidden'; // o mesmo do indicador de faturamento no topo do painel
const readHidden = () => { try { return localStorage.getItem(HIDDEN_KEY) === '1'; } catch { return false; } };
type Category = { count: number; xp: number };
const number = (value: number) => Math.round(value).toLocaleString('pt-BR');
const CATEGORY_LABELS: Record<string, string> = {
  orders: 'Pedidos concluídos', content: 'Conteúdos publicados', views: 'Visualizações', likes: 'Curtidas', comments: 'Comentários',
  followers: 'Seguidores', missions: 'Missões e tarefas', scripts: 'Roteiros prontos', goals: 'Metas atingidas',
};

/** Total de gastos desde o primeiro mês com registro: despesas fixas + custo de edição + despesa de evento (mesma base do Financeiro). */
function totalExpenses(entries: ReturnType<typeof buildRevenueEntries>['entries'], costs: ReturnType<typeof buildRevenueEntries>['costs'], fixed: FixedExpense[], now: Date) {
  const nowKey = monthKeyOf(now);
  const first = [...entries.map((e) => e.monthKey), ...costs.map((c) => c.monthKey), ...fixed.map((f) => (f as any).startMonth).filter(Boolean)].sort()[0];
  let total = 0;
  for (let key = first ?? nowKey; key <= nowKey; key = shiftMonth(key, 1)) {
    total += expensesForMonth(fixed, key).total + editingCostForMonth(entries, key).total + eventCostForMonth(costs, key).total;
  }
  return total;
}

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }> = ({ icon, label, value, hint }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/45">{icon}{label}</div>
    <div className="mt-2 text-xl font-extrabold tabular-nums text-white">{value}</div>
    {hint && <p className="mt-1 text-[11px] text-white/40">{hint}</p>}
  </div>
);

export const AdminProfilePage: React.FC = () => {
  const { user, setDisplayName } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const xp = useXp(); // ao vivo: ativar o XP ou ganhar uma atividade atualiza a tela sozinho
  const [counts, setCounts] = useState<Awaited<ReturnType<typeof loadProfileCounts>> | null>(null);
  const [orders, setOrders] = useState<unknown[] | null>(null);
  const [fixed, setFixed] = useState<FixedExpense[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(readHidden);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewBaseline>> | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    loadProfileCounts().then(setCounts).catch((e) => setLoadError(e?.message ?? 'Falha ao carregar o perfil.'));
    listFixedExpenses().then(setFixed).catch((e) => setLoadError(e?.message ?? 'Falha ao carregar os gastos.'));
    return subscribeCompletedOrders(setOrders, (e) => setLoadError(e.message));
  }, []);

  const finance = useMemo(() => {
    if (!orders || !fixed) return null;
    const { entries, costs } = buildRevenueEntries(orders);
    return {
      revenue: entries.reduce((sum, e) => sum + e.value, 0),
      // pedido de evento tem várias linhas no livro, e ajustes de receita não são pedido: conta pedidos distintos
      orders: new Set(entries.filter((e) => e.order?.ledgerKind !== 'adjrev').map((e) => e.order?.orderId || e.order?.id)).size,
      expenses: totalExpenses(entries, costs, fixed, new Date()),
    };
  }, [orders, fixed]);

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    try { localStorage.setItem(HIDDEN_KEY, next ? '1' : '0'); } catch { /* vale só nesta sessão */ }
  };
  const money = (value: number | undefined) => (value === undefined ? '…' : hidden ? 'R$ ••••' : formatMoney(value));

  const saveName = async () => {
    setSaving(true); setNameError(null); setSaved(false);
    try { await setDisplayName(name); setSaved(true); } catch (e) { setNameError(e?.message ?? 'Não foi possível salvar o nome.'); } finally { setSaving(false); }
  };

  const startActivation = async () => {
    setActivating(true); setLoadError(null);
    try { setPreview(await previewBaseline()); } catch (e) { setLoadError(e?.message ?? 'Falha ao calcular o XP inicial.'); } finally { setActivating(false); }
  };
  const confirmActivation = async () => {
    if (!preview) return;
    setActivating(true); setLoadError(null);
    try { await activateXp(preview); setPreview(null); } catch (e) { setLoadError(e?.message ?? 'Falha ao gravar o XP inicial (as regras do Firestore já foram publicadas?).'); } finally { setActivating(false); }
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Administrador';
  const level = xp.level;
  const previewLevel = preview ? levelInfo(preview.total) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">Perfil</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Ficha do Herói</h2>
      </div>
      {loadError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{loadError}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Identidade */}
        <section className={cardClass}>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-3xl font-black text-white ring-4 ring-white/10">
                {displayName[0].toUpperCase()}
              </div>
              {level && <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-[#0D1527] bg-amber-400 px-2 py-0.5 text-[11px] font-black text-black">Nv {level.level}</span>}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-white">{displayName}</p>
              <p className="truncate text-xs text-white/50">@{user?.email?.split('@')[0]}</p>
              <p className="truncate font-mono text-xs text-white/40">{user?.email}</p>
            </div>
          </div>
          <form className="mt-5" onSubmit={(e) => { e.preventDefault(); void saveName(); }}>
            <label className={labelClass} htmlFor="display-name">Nome de exibição</label>
            <div className="mt-0 flex gap-2">
              <input id="display-name" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="Como a plataforma deve te chamar" className={inputClass} />
              <button type="submit" disabled={saving || !name.trim() || name.trim() === (user?.displayName ?? '')} className={`${primaryBtn} mt-1.5 shrink-0`}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}Salvar
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-white/40">Aparece na saudação da Principal ("Olá, {name.trim() || displayName}!").</p>
            {saved && <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-300" role="status"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Nome salvo.</p>}
            {nameError && <p className="mt-1.5 text-xs text-red-300" role="alert">{nameError}</p>}
          </form>
        </section>

        {/* Progressão */}
        <section className={cardClass}>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-300"><Zap className="h-4 w-4" aria-hidden />Experiência</div>
          {!xp.ready ? (
            <p className="mt-4 text-sm text-white/50">Carregando…</p>
          ) : !level ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-white/70">O sistema de XP ainda não foi ativado. Ao ativar, o XP inicial é calculado uma única vez com todo o histórico existente (pedidos, conteúdos, Instagram, missões e metas) e, daí em diante, cada nova atividade soma XP automaticamente.</p>
              {!preview ? (
                <button type="button" onClick={startActivation} disabled={activating} className={primaryBtn}>{activating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}Calcular XP inicial</button>
              ) : (
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries<Category>(preview.categories).map(([key, c]) => (
                        <tr key={key} className="border-b border-white/5 last:border-0">
                          <td className="py-1.5 text-white/70">{CATEGORY_LABELS[key] ?? key}</td>
                          <td className="py-1.5 text-right tabular-nums text-white/45">{number(c.count)}</td>
                          <td className="py-1.5 pl-4 text-right font-semibold tabular-nums text-white">{number(c.xp)} XP</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-sm font-bold text-white">Total: {number(preview.total)} XP → nível {previewLevel.level}</p>
                  <p className="text-[11px] text-white/45">Esta gravação acontece uma única vez e não pode ser desfeita pelo painel.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={confirmActivation} disabled={activating} className={primaryBtn}>{activating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Ativar com este XP</button>
                    <button type="button" onClick={() => setPreview(null)} disabled={activating} className={ghostBtn}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-end justify-between gap-3">
                <p className="text-4xl font-black tracking-tight text-white">Nível {level.level}</p>
                <p className="text-sm font-semibold tabular-nums text-white/70">{number(xp.total)} XP</p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.percent)} aria-label="Progresso até o próximo nível">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all" style={{ width: `${Math.min(100, level.percent)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs tabular-nums text-white/55">
                <span>{number(level.into)} / {number(level.need)} XP ({level.percent.toFixed(1)}%)</span>
                <span>faltam {number(level.left)} XP para o nível {level.level + 1}</span>
              </div>
              <details className="mt-4 text-xs text-white/55">
                <summary className="cursor-pointer select-none font-semibold text-white/70">XP inicial por categoria</summary>
                <table className="mt-2 w-full">
                  <tbody>
                    {Object.entries<Category>(xp.baseline?.categories ?? {}).map(([key, c]) => (
                      <tr key={key}><td className="py-0.5">{CATEGORY_LABELS[key] ?? key}</td><td className="py-0.5 text-right tabular-nums">{number(c.xp)} XP</td></tr>
                    ))}
                    <tr className="border-t border-white/10"><td className="py-0.5 font-semibold text-white/75">Ganho depois da ativação</td><td className="py-0.5 text-right font-semibold tabular-nums text-white/75">{number(xp.fromEvents)} XP</td></tr>
                  </tbody>
                </table>
              </details>
            </div>
          )}
        </section>
      </div>

      {/* Atributos */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">Atributos</h3>
          <button type="button" onClick={toggleHidden} aria-pressed={hidden} aria-label={hidden ? 'Mostrar faturamento e gastos' : 'Ocultar faturamento e gastos'} className={ghostBtn}>
            {hidden ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}{hidden ? 'Mostrar valores' : 'Ocultar valores'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat icon={<Camera className="h-3.5 w-3.5 text-pink-300" aria-hidden />} label="Seguidores" value={counts ? (counts.followers === null ? '—' : counts.followers.toLocaleString('pt-BR')) : '…'} hint="Última sincronização do Instagram" />
          <Stat icon={<Coins className="h-3.5 w-3.5 text-amber-300" aria-hidden />} label="Faturamento total" value={money(finance?.revenue)} hint="Desde o primeiro pedido registrado" />
          <Stat icon={<TrendingDown className="h-3.5 w-3.5 text-red-300" aria-hidden />} label="Gastos registrados" value={money(finance?.expenses)} hint="Despesas fixas, edição e eventos" />
          <Stat icon={<Swords className="h-3.5 w-3.5 text-blue-300" aria-hidden />} label="Missões concluídas" value={counts ? number(counts.missions) : '…'} />
          <Stat icon={<Flag className="h-3.5 w-3.5 text-emerald-300" aria-hidden />} label="Metas atingidas" value={counts ? number(counts.goals) : '…'} hint="Desde o início do histórico de atividades" />
          <Stat icon={<ShoppingBag className="h-3.5 w-3.5 text-violet-300" aria-hidden />} label="Pedidos concluídos" value={finance ? number(finance.orders) : '…'} />
        </div>
      </section>
    </div>
  );
};
