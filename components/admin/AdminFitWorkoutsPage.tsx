import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Check, Circle, Loader2, Pencil, Play, Plus, Timer, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { deleteExercise, deleteWorkout, loadExercises, loadWorkouts, saveCheckin, saveExercise, saveWorkout } from '../../services/fitDataService';
import {
  cancelTimer, elapsedSec, formatClock, moveItem, moveSessionItem, normalizeExercise, normalizeWorkout, startSession, startTimer, summarizeSession,
  tickSession, timerRemainingSec, toggleItem, type Exercise, type Session, type Workout,
} from '../../services/fitWorkout.js';
import { checkinId } from '../../services/fitCheckin.js';
import { dayKey } from '../../services/fitDaily.js';
import { checkinXp } from '../../functions/xp.js';
import { ClaimButton, useFitClaims } from './FitXp';
import { cardClass, ghostBtn, inputClass, labelClass, primaryBtn } from './financeFormat';

type SubTab = 'treinar' | 'planos' | 'exercicios';
const byText = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

// A sessão do treino fica no navegador (localStorage) para sobreviver a recarregar a página; todo tempo vem de carimbos (ms).
const sessionKey = (uid: string) => `hdc.fit.session.${uid}`;
const readSession = (uid: string): Session | null => { try { const raw = localStorage.getItem(sessionKey(uid)); return raw ? (JSON.parse(raw) as Session) : null; } catch { return null; } };
const writeSession = (uid: string, session: Session | null) => { try { if (session) localStorage.setItem(sessionKey(uid), JSON.stringify(session)); else localStorage.removeItem(sessionKey(uid)); } catch { /* sem armazenamento: o treino segue só na memória */ } };

/** Treinos de academia: biblioteca de exercícios, planos (Treino A, B…) e a execução com checklist, timers e cronômetro. */
export const AdminFitWorkoutsPage: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const claims = useFitClaims();
  const [tab, setTab] = useState<SubTab>('treinar');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const [e, w] = await Promise.all([loadExercises(uid), loadWorkouts(uid)]);
      setExercises(e.sort((a, b) => byText(a.category, b.category) || byText(a.name, b.name)));
      setWorkouts(w.sort((a, b) => byText(a.name, b.name)));
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar os treinos.'); }
    finally { setLoaded(true); }
  }, [uid]);
  useEffect(() => { void load(); }, [load]);

  const exercisesById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const TABS: { id: SubTab; label: string }[] = [{ id: 'treinar', label: 'Treinar' }, { id: 'planos', label: 'Planos' }, { id: 'exercicios', label: 'Exercícios' }];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white">Treinos</h2>
        <p className="text-sm text-white/55">Cadastre os exercícios, monte os treinos (A, B…) e acompanhe o checklist com timer e cronômetro. Ao finalizar, vira check-in de academia.</p>
      </div>
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1" role="tablist" aria-label="Treinos">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === t.id ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p>
        </div>
      )}
      {!loaded ? <p className="text-sm text-white/50">Carregando…</p> : (
        <>
          {tab === 'treinar' && <TrainTab uid={uid} workouts={workouts} exercisesById={exercisesById} claims={claims} onGoPlans={() => setTab('planos')} />}
          {tab === 'planos' && <PlansTab uid={uid} workouts={workouts} exercises={exercises} exercisesById={exercisesById} reload={load} fail={setError} />}
          {tab === 'exercicios' && <ExercisesTab uid={uid} exercises={exercises} reload={load} fail={setError} />}
        </>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ Treinar

type Claims = ReturnType<typeof useFitClaims>;

export const TrainTab: React.FC<{ uid: string; workouts: Workout[]; exercisesById: Map<string, Exercise>; claims: Claims; onGoPlans: () => void }> = ({ uid, workouts, exercisesById, claims, onGoPlans }) => {
  const [session, setSession] = useState<Session | null>(() => readSession(uid));
  const [now, setNow] = useState(() => Date.now());
  const [planId, setPlanId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [finishedDay, setFinishedDay] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);

  const update = useCallback((next: Session | null) => { setSession(next); writeSession(uid, next); }, [uid]);

  // Relógio da tela (cronômetro e contagem do timer); só roda com treino em andamento.
  const active = session !== null;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [active]);

  // Timer que acabou: conclui o exercício, toca e vibra. Se a tela ficou bloqueada, conclui ao voltar.
  useEffect(() => {
    if (!session) return;
    const { session: next, finished } = tickSession(session, now);
    if (!finished.length) return;
    update(next);
    setNotice(`Timer terminou: ${finished.map((id) => session.items.find((i) => i.id === id)?.name).filter(Boolean).join(', ')}`);
    beep(audio.current);
  }, [now, session, update]);

  const start = () => {
    const plan = workouts.find((w) => w.id === (planId || workouts[0]?.id));
    if (!plan) return;
    const next = startSession(plan, exercisesById, Date.now());
    if (!next.items.length) { setProblem('Este treino não tem exercícios cadastrados. Edite o plano na aba Planos.'); return; }
    setProblem(null); setFinishedDay(null); setNotice(null); setNow(Date.now()); update(next);
  };

  const onStartTimer = (id: string) => {
    // O som precisa ser liberado por um toque do usuário (regra do iOS): faz aqui, quando ele inicia o timer.
    try { audio.current ??= new (window.AudioContext || (window as any).webkitAudioContext)(); void audio.current.resume(); } catch { /* sem áudio: só o aviso visual */ }
    if (session) update(startTimer(session, id, Date.now()));
  };

  const finish = async () => {
    if (!session) return;
    const summary = summarizeSession(session, Date.now());
    if (summary.exercisesDone < summary.exercisesTotal && !window.confirm(`Faltam ${summary.exercisesTotal - summary.exercisesDone} exercícios. Finalizar mesmo assim?`)) return;
    const day = dayKey(new Date());
    setSaving(true); setProblem(null);
    try {
      await saveCheckin(uid, { kind: 'gym', day, durationMin: Math.min(summary.durationMin, 1440), workoutName: session.planName.slice(0, 60), exercisesDone: summary.exercisesDone, exercisesTotal: summary.exercisesTotal });
      update(null); setFinishedDay(day); await claims.reload();
    } catch (e) { setProblem(e instanceof Error ? e.message : 'Não foi possível registrar o check-in. O treino continua em andamento.'); }
    finally { setSaving(false); }
  };

  const cancel = () => { if (window.confirm('Cancelar o treino em andamento? O progresso será perdido.')) { update(null); setNotice(null); } };

  if (session) {
    const done = session.items.filter((i) => i.done).length;
    return (
      <div className="space-y-4">
        <div className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{session.planName}</p>
            <p className="font-mono text-4xl font-black tabular-nums text-white" aria-label="Tempo de treino" role="timer">{formatClock(elapsedSec(session, now))}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold tabular-nums text-white">{done}/{session.items.length}</p>
            <p className="text-xs text-white/50">exercícios feitos</p>
          </div>
        </div>
        {notice && <p role="status" className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">{notice}<button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso"><X className="h-4 w-4" /></button></p>}
        {problem && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{problem}</p>}
        <ul className="space-y-2">
          {session.items.map((item, index) => {
            const remaining = timerRemainingSec(item, now);
            return (
              <li key={item.id} className={`${cardClass} flex flex-wrap items-center gap-3 !p-3.5 ${item.done ? 'opacity-60' : ''}`}>
                <button type="button" onClick={() => update(toggleItem(session, item.id))} disabled={!item.done && !!item.timerSec}
                  aria-label={item.done ? `Desmarcar ${item.name}` : item.timerSec ? `${item.name}: conclua com o timer` : `Marcar ${item.name} como feito`}
                  className="shrink-0 text-white/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                  {item.done ? <Check className="h-7 w-7 rounded-full bg-emerald-500 p-1 text-white" /> : <Circle className="h-7 w-7" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold text-white ${item.done ? 'line-through' : ''}`}>{item.name}</p>
                  <p className="text-xs text-white/45">{item.category}{item.timerSec ? ` · timer ${formatClock(item.timerSec)}` : ''}</p>
                </div>
                {item.timerSec && !item.done && (
                  remaining === null
                    ? <button type="button" className={primaryBtn} onClick={() => onStartTimer(item.id)}><Timer className="h-4 w-4" /> Iniciar timer</button>
                    : <div className="flex items-center gap-2"><span className="font-mono text-xl font-black tabular-nums text-amber-300" role="timer">{formatClock(remaining)}</span><button type="button" className={ghostBtn} onClick={() => update(cancelTimer(session, item.id))}>Cancelar</button></div>
                )}
                <div className="flex gap-1">
                  <button type="button" className={ghostBtn} disabled={index === 0} onClick={() => update(moveSessionItem(session, item.id, -1))} aria-label={`Subir ${item.name}`}><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" className={ghostBtn} disabled={index === session.items.length - 1} onClick={() => update(moveSessionItem(session, item.id, 1))} aria-label={`Descer ${item.name}`}><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={primaryBtn} onClick={() => void finish()} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Finalizar treino</button>
          <button type="button" className={ghostBtn} onClick={cancel} disabled={saving}>Cancelar treino</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {finishedDay && (
        <div className={`${cardClass} flex flex-wrap items-center justify-between gap-3 !border-emerald-500/30`}>
          <p className="text-sm text-emerald-200">Treino finalizado e check-in de academia registrado.</p>
          <ClaimButton xp={checkinXp()} claimed={claims.isClaimed('fit_checkin', checkinId('gym', finishedDay))} busy={claims.busy !== null}
            onClick={() => void claims.claim('fit_checkin', checkinId('gym', finishedDay), checkinXp(), { kind: 'gym', day: finishedDay })} />
        </div>
      )}
      {claims.error && <p role="alert" className="text-xs text-red-300">{claims.error}</p>}
      {problem && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{problem}</p>}
      {workouts.length === 0 ? (
        <div className={cardClass}>
          <p className="font-semibold text-white">Nenhum treino cadastrado.</p>
          <p className="mt-1 text-sm text-white/60">Cadastre os exercícios na aba Exercícios e monte o Treino A na aba Planos.</p>
          <button type="button" className={`${primaryBtn} mt-3`} onClick={onGoPlans}>Montar um treino</button>
        </div>
      ) : (
        <div className={`${cardClass} space-y-3`}>
          <label className={labelClass}>Treino de hoje
            <select className={inputClass} value={planId || workouts[0].id} onChange={(e) => setPlanId(e.target.value)}>
              {workouts.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.exerciseIds.filter((id) => exercisesById.has(id)).length} exercícios)</option>)}
            </select>
          </label>
          <button type="button" className={primaryBtn} onClick={start}><Play className="h-4 w-4" /> Iniciar treino</button>
          <p className="text-xs text-white/45">Inicia o cronômetro. Exercícios com timer só são concluídos quando o timer termina. Você pode trocar a ordem durante o treino.</p>
        </div>
      )}
    </div>
  );
};

function beep(ctx: AudioContext | null) {
  try {
    if (ctx) {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 880; gain.gain.value = 0.2;
      osc.start(); window.setTimeout(() => osc.stop(), 700);
    }
  } catch { /* sem áudio */ }
  try { navigator.vibrate?.([300, 150, 300]); } catch { /* sem vibração */ }
}

// ------------------------------------------------------------------ Planos

export const PlansTab: React.FC<{ uid: string; workouts: Workout[]; exercises: Exercise[]; exercisesById: Map<string, Exercise>; reload: () => Promise<void>; fail: (m: string | null) => void }> = ({ uid, workouts, exercises, exercisesById, reload, fail }) => {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);

  const open = (w: Workout | null) => { setEditing(w ? w.id : 'new'); setName(w?.name ?? ''); setIds((w?.exerciseIds ?? []).filter((id) => exercisesById.has(id))); setAdding(''); fail(null); };
  const save = async () => {
    const result = normalizeWorkout({ name, exerciseIds: ids });
    if ('error' in result) { fail(result.error); return; }
    setBusy(true); fail(null);
    try { await saveWorkout(uid, editing === 'new' ? null : editing, result.value); await reload(); setEditing(null); }
    catch (e) { fail(e instanceof Error ? e.message : 'Não foi possível salvar o treino.'); }
    finally { setBusy(false); }
  };
  const remove = async (w: Workout) => {
    if (!window.confirm(`Apagar o ${w.name}? Os exercícios continuam na biblioteca.`)) return;
    try { await deleteWorkout(uid, w.id); await reload(); } catch (e) { fail(e instanceof Error ? e.message : 'Não foi possível apagar.'); }
  };

  const available = exercises.filter((e) => !ids.includes(e.id));
  const categories = [...new Set(available.map((e) => e.category))].sort(byText);

  return (
    <div className="space-y-4">
      {editing === null && (
        <>
          <button type="button" className={primaryBtn} onClick={() => open(null)} disabled={exercises.length === 0}><Plus className="h-4 w-4" /> Novo treino</button>
          {exercises.length === 0 && <p className="text-sm text-white/55">Cadastre primeiro alguns exercícios na aba Exercícios.</p>}
          {workouts.length === 0 && exercises.length > 0 && <p className="text-sm text-white/55">Nenhum treino ainda. Crie o Treino A escolhendo os exercícios e a ordem.</p>}
          <ul className="space-y-2">
            {workouts.map((w) => {
              const valid = w.exerciseIds.filter((id) => exercisesById.has(id));
              return (
                <li key={w.id} className={`${cardClass} flex flex-wrap items-center justify-between gap-3 !p-4`}>
                  <div className="min-w-0">
                    <p className="font-bold text-white">{w.name}</p>
                    <p className="truncate text-xs text-white/50">{valid.length} exercícios{valid.length ? `: ${valid.map((id) => exercisesById.get(id)!.name).join(', ')}` : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={ghostBtn} onClick={() => open(w)} aria-label={`Editar ${w.name}`}><Pencil className="h-3.5 w-3.5" /> Editar</button>
                    <button type="button" className={ghostBtn} onClick={() => void remove(w)} aria-label={`Apagar ${w.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {editing !== null && (
        <div className={`${cardClass} space-y-4`}>
          <h3 className="text-sm font-bold text-white">{editing === 'new' ? 'Novo treino' : 'Editar treino'}</h3>
          <label className={labelClass}>Nome
            <input className={inputClass} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="ex.: Treino A" />
          </label>
          <div>
            <p className={labelClass}>Exercícios, na ordem do treino</p>
            {ids.length === 0 ? <p className="mt-1.5 text-sm text-white/50">Nenhum exercício ainda.</p> : (
              <ol className="mt-1.5 space-y-1.5">
                {ids.map((id, index) => {
                  const ex = exercisesById.get(id)!;
                  return (
                    <li key={id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#070B14] px-3 py-2 text-sm text-white/90">
                      <span className="w-5 text-xs tabular-nums text-white/40">{index + 1}.</span>
                      <span className="min-w-0 flex-1 truncate">{ex.name} <span className="text-xs text-white/40">· {ex.category}{ex.timerSec ? ` · timer ${formatClock(ex.timerSec)}` : ''}</span></span>
                      <button type="button" className={ghostBtn} disabled={index === 0} onClick={() => setIds(moveItem(ids, index, -1))} aria-label={`Subir ${ex.name}`}><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" className={ghostBtn} disabled={index === ids.length - 1} onClick={() => setIds(moveItem(ids, index, 1))} aria-label={`Descer ${ex.name}`}><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" className={ghostBtn} onClick={() => setIds(ids.filter((x) => x !== id))} aria-label={`Remover ${ex.name} do treino`}><X className="h-3.5 w-3.5" /></button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className={`${labelClass} min-w-[12rem] flex-1`}>Adicionar exercício
              <select className={inputClass} value={adding} onChange={(e) => setAdding(e.target.value)}>
                <option value="">Escolha…</option>
                {categories.map((category) => (
                  <optgroup key={category} label={category}>
                    {available.filter((e) => e.category === category).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <button type="button" className={ghostBtn} disabled={!adding} onClick={() => { setIds([...ids, adding]); setAdding(''); }}><Plus className="h-3.5 w-3.5" /> Adicionar</button>
          </div>
          <div className="flex gap-3">
            <button type="button" className={primaryBtn} onClick={() => void save()} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar treino</button>
            <button type="button" className={ghostBtn} onClick={() => { setEditing(null); fail(null); }} disabled={busy}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ Exercícios

export const ExercisesTab: React.FC<{ uid: string; exercises: Exercise[]; reload: () => Promise<void>; fail: (m: string | null) => void }> = ({ uid, exercises, reload, fail }) => {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', category: '', useTimer: false, timerSec: '60' });
  const [busy, setBusy] = useState(false);
  const categories = useMemo(() => [...new Set(exercises.map((e) => e.category))].sort(byText), [exercises]);

  const open = (e: Exercise | null) => { setEditing(e ? e.id : 'new'); setForm({ name: e?.name ?? '', category: e?.category ?? '', useTimer: !!e?.timerSec, timerSec: String(e?.timerSec ?? 60) }); fail(null); };
  const save = async () => {
    const result = normalizeExercise({ name: form.name, category: form.category, timerSec: form.useTimer ? form.timerSec : null });
    if ('error' in result) { fail(result.error); return; }
    setBusy(true); fail(null);
    try { await saveExercise(uid, editing === 'new' ? null : editing, result.value); await reload(); setEditing(null); }
    catch (e) { fail(e instanceof Error ? e.message : 'Não foi possível salvar o exercício.'); }
    finally { setBusy(false); }
  };
  const remove = async (e: Exercise) => {
    if (!window.confirm(`Apagar "${e.name}"? Ele sai da biblioteca e dos treinos que o usam.`)) return;
    try { await deleteExercise(uid, e.id); await reload(); } catch (err) { fail(err instanceof Error ? err.message : 'Não foi possível apagar.'); }
  };

  return (
    <div className="space-y-4">
      {editing === null ? (
        <button type="button" className={primaryBtn} onClick={() => open(null)}><Plus className="h-4 w-4" /> Novo exercício</button>
      ) : (
        <div className={`${cardClass} space-y-3`}>
          <h3 className="text-sm font-bold text-white">{editing === 'new' ? 'Novo exercício' : 'Editar exercício'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Nome
              <input className={inputClass} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex.: Leg press" />
            </label>
            <label className={labelClass}>Categoria
              <input className={inputClass} list="fit-categories" value={form.category} maxLength={40} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="ex.: Perna, Costas, Abdômen" />
              <datalist id="fit-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" checked={form.useTimer} onChange={(e) => setForm({ ...form, useTimer: e.target.checked })} /> Usar timer neste exercício
            </label>
            {form.useTimer && (
              <label className="flex items-center gap-2 text-sm text-white/80">Segundos
                <input type="text" inputMode="numeric" className={`${inputClass} !mt-0 w-24`} value={form.timerSec} onChange={(e) => setForm({ ...form, timerSec: e.target.value })} />
              </label>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" className={primaryBtn} onClick={() => void save()} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar exercício</button>
            <button type="button" className={ghostBtn} onClick={() => { setEditing(null); fail(null); }} disabled={busy}>Cancelar</button>
          </div>
        </div>
      )}
      {exercises.length === 0 && editing === null && <p className="text-sm text-white/55">Nenhum exercício ainda. Cadastre os das máquinas que você usa.</p>}
      {categories.map((category) => (
        <section key={category} className={cardClass}>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-white/60">{category}</h3>
          <ul className="divide-y divide-white/5">
            {exercises.filter((e) => e.category === category).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-white/90">{e.name}{e.timerSec ? <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-300"><Timer className="h-3 w-3" /> {formatClock(e.timerSec)}</span> : null}</span>
                <div className="flex gap-2">
                  <button type="button" className={ghostBtn} onClick={() => open(e)} aria-label={`Editar ${e.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" className={ghostBtn} onClick={() => void remove(e)} aria-label={`Apagar ${e.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
