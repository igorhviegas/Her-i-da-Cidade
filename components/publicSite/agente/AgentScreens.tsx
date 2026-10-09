import React from 'react';
import { ChevronRight, CircleHelp, ClipboardList, Info, MessageCircle, Music, Route, Timer, TriangleAlert, ChevronLeft } from 'lucide-react';
import type { AgentFaqCategory, AgentStep, AgentTrack } from '../../../services/agentService';
import { SUPPORT_WHATSAPP_URL, searchFaq } from '../../../services/agentContent.js';
import { TravelCalculator } from '../../agente/TravelCalculator';
import { FaqResults, FaqView, InfoCard, PlayerButtons, SearchBox } from './AgentBits';
import { MusicView } from './MusicView';
import { StepView } from './StepView';
import { bigBtn, btn, type Player, type Saved } from './agenteShared';
import type { StepProgress, ViewInfo } from './agenteView';

type Update = (fn: (s: Saved) => Saved) => void;

interface HomeViewProps {
  saved: Saved;
  update: Update;
  progress: StepProgress;
  player: Player;
  trackCount: number;
  setView: (view: string) => void;
  onStart: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ saved, update, progress, player, trackCount, setView, onStart }) => {
  const { done, total } = progress;
  return (
    <>
        {saved.event ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
            <p className="font-bold">Evento em andamento</p>
            <p className="mt-0.5 text-emerald-200/70">O timer fica no topo em todas as telas.</p>
            <button onClick={() => { if (window.confirm('Encerrar o evento e parar o timer?')) update((s) => ({ ...s, event: null })); }} className={`${btn} mt-3 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/80`}>Encerrar evento</button>
          </div>
        ) : (
          <button onClick={onStart} className={`${btn} w-full rounded-2xl bg-emerald-500 px-6 py-8 text-2xl font-black uppercase tracking-wide text-[#04210F] shadow-lg shadow-emerald-500/30`}>Iniciar evento</button>
        )}
        <button onClick={() => setView('music')} className={bigBtn}>
          <Music className="h-7 w-7 shrink-0 text-pink-300" />
          <span className="min-w-0 flex-1"><span className="block text-lg font-bold">Músicas</span><span className="block truncate text-sm text-white/50">{player.current ? `${player.playing ? '▶' : '❚❚'} ${player.current.title}` : `${trackCount} na playlist`}</span></span>
          <ChevronRight className="h-5 w-5 text-white/40" />
        </button>
        <button onClick={() => setView('steps')} className={bigBtn}>
          <ClipboardList className="h-7 w-7 shrink-0 text-blue-300" />
          <span className="min-w-0 flex-1"><span className="block text-lg font-bold">Passo a passo</span><span className="block text-sm text-white/50">{done} de {total} itens concluídos</span></span>
          <ChevronRight className="h-5 w-5 text-white/40" />
        </button>
        <button onClick={() => setView('travel')} className={bigBtn}>
          <Route className="h-7 w-7 shrink-0 text-emerald-300" />
          <span className="min-w-0 flex-1"><span className="block text-lg font-bold">Deslocamento</span><span className="block text-sm text-white/50">Km da rota, cachês e texto do WhatsApp</span></span>
          <ChevronRight className="h-5 w-5 text-white/40" />
        </button>
        <button onClick={() => setView('support')} className={bigBtn}>
          <CircleHelp className="h-7 w-7 shrink-0 text-amber-300" />
          <span className="min-w-0 flex-1"><span className="block text-lg font-bold">Suporte</span><span className="block text-sm text-white/50">Dúvidas, informações e ajuda</span></span>
          <ChevronRight className="h-5 w-5 text-white/40" />
        </button>
    </>
  );
};

interface StepsListProps { steps: AgentStep[]; progress: StepProgress; setView: (view: string) => void }

const StepsList: React.FC<StepsListProps> = ({ steps, progress, setView }) => (
  <>
    {steps.map((step) => {
    const d = progress.stepDone(step); const t = progress.stepTotal(step);
    const isNext = progress.nextStep?.id === step.id; // próxima etapa pendente: destacada para continuar com um toque
    return (
      <button key={step.id} onClick={() => setView(`step:${step.id}`)} className={`${bigBtn} ${step.highlight ? 'border-amber-400/50 bg-amber-400/10' : isNext ? 'border-blue-500/40 bg-blue-600/15' : ''}`}>
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${d === t && t > 0 ? 'bg-emerald-500 text-[#04210F]' : 'bg-white/10 text-white/80'}`}>{d === t && t > 0 ? '✓' : `${d}/${t}`}</span>
        <span className="min-w-0 flex-1">
          {isNext ? <span className="block text-[11px] font-bold uppercase tracking-widest text-blue-300">Continuar{step.kicker ? ` · ${step.kicker}` : ''}</span>
            : step.kicker && <span className="block text-[11px] font-bold uppercase tracking-widest text-white/40">{step.kicker}</span>}
          <span className="block text-lg font-bold leading-tight">{step.title}</span>
        </span>
        {step.alert && <TriangleAlert className="h-5 w-5 shrink-0 text-red-400" aria-label="Contém alerta" />}
      </button>
    );
  })}
  </>
);

interface SupportViewProps { faq: AgentFaqCategory[]; query: string; onQuery: (v: string) => void; setView: (view: string) => void }

const SupportView: React.FC<SupportViewProps> = ({ faq, query, onQuery, setView }) => (
  <>
      <SearchBox value={query} onChange={onQuery} placeholder="Buscar em todas as perguntas e respostas" />
      {query.trim() ? <FaqResults results={searchFaq(faq, query)} /> : <>
      <button onClick={() => setView('support:info')} className={bigBtn}>
        <Info className="h-7 w-7 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1"><span className="block text-lg font-bold">Informações importantes</span><span className="block text-sm text-white/50">Duração, alertas e novo evento</span></span>
        <ChevronRight className="h-5 w-5 text-white/40" />
      </button>
      {faq.map((category) => (
        <button key={category.id} onClick={() => setView(`support:${category.id}`)} className={bigBtn}>
          <CircleHelp className="h-7 w-7 shrink-0 text-blue-300" />
          <span className="min-w-0 flex-1"><span className="block text-lg font-bold">{category.title}</span><span className="block text-sm text-white/50">{category.items.length} {category.items.length === 1 ? 'pergunta' : 'perguntas'}</span></span>
          <ChevronRight className="h-5 w-5 text-white/40" />
        </button>
      ))}
      <p className="px-1 pt-2 text-center text-sm text-white/40">Não achou? Toque no botão verde para falar com o Vitor.</p>
      </>}
  </>
);

const SupportInfoView: React.FC<{ onReset: () => void }> = ({ onReset }) => (
  <>
      <InfoCard title="Duração e chegada">O evento contratado dura <b>1 hora</b>. O agente chega ~<b>30 minutos antes</b> para preparar tudo.</InfoCard>
      <InfoCard title="Timer do evento">Toque em <b>Iniciar evento</b> quando a apresentação começar. Use <b>−5 / +5</b> no topo para ajustar se os pais pedirem para atrasar.</InfoCard>
      <InfoCard title="Alertas automáticos">Aos <b>30 min</b> restantes: combinar os parabéns com os responsáveis. Aos <b>5 min</b>: <b>ligar o distintivo</b> (sinal para o Homem-Aranha) e começar a guardar o material.</InfoCard>
      <InfoCard title="Voltagem">⚠️ Sempre confira a voltagem da tomada antes de ligar a caixa de som.</InfoCard>
      <button onClick={onReset} className={`${btn} w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-300`}>Novo evento (limpar checklist e timer)</button>
  </>
);

interface AgentScreensProps {
  view: string;
  info: ViewInfo;
  steps: AgentStep[];
  tracks: AgentTrack[];
  tracksLoading: boolean;
  faq: AgentFaqCategory[];
  saved: Saved;
  update: Update;
  progress: StepProgress;
  player: Player;
  query: string;
  onQuery: (v: string) => void;
  setView: (view: string) => void;
  rawSetView: (view: string) => void;
  onStart: () => void;
  onReset: () => void;
}

/** Conteúdo da tela atual (home, passo a passo, etapa, deslocamento, músicas, suporte). */
export const AgentScreens: React.FC<AgentScreensProps> = ({ view, info, steps, tracks, tracksLoading, faq, saved, update, progress, player, query, onQuery, setView, rawSetView, onStart, onReset }) => {
  const { activeStep, stepIndex, faqCategory } = info;
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 pt-4">
      {view === 'home' && <HomeView saved={saved} update={update} progress={progress} player={player} trackCount={tracks.length} setView={setView} onStart={onStart} />}

      {view === 'steps' && <StepsList steps={steps} progress={progress} setView={setView} />}

      {activeStep && (
        <StepView
          step={activeStep}
          saved={saved}
          update={update}
          eventRunning={!!saved.event}
          onStart={onStart}
          prev={steps[stepIndex - 1]}
          next={steps[stepIndex + 1]}
          go={(id) => { rawSetView(`step:${id}`); window.scrollTo(0, 0); }}
        />
      )}

      {view === 'travel' && <TravelCalculator />}

      {view === 'music' && <MusicView player={player} tracks={tracks} loading={tracksLoading} query={query} onQuery={onQuery} />}

      {view === 'support' && <SupportView faq={faq} query={query} onQuery={onQuery} setView={setView} />}

      {view === 'support:info' && <SupportInfoView onReset={onReset} />}

      {faqCategory && <FaqView category={faqCategory} />}
    </main>
  );
};

interface AgentHeaderProps { view: string; title: string; onBack: () => void }

export const AgentHeader: React.FC<AgentHeaderProps> = ({ view, title, onBack }) => (
    <header className="flex items-center gap-2 border-b border-white/10 bg-[#0B1120] px-3 py-2">
      {view !== 'home' ? (
        <button onClick={onBack} aria-label="Voltar" className={`${btn} flex h-12 w-12 items-center justify-center rounded-xl bg-white/5`}><ChevronLeft className="h-6 w-6" /></button>
      ) : <span className="flex h-12 w-12 items-center justify-center text-blue-400"><Timer className="h-6 w-6" /></span>}
      <h1 className="truncate text-lg font-extrabold tracking-tight">{title}</h1>
    </header>
);

interface AgentFooterProps { view: string; showMini: boolean; player: Player; onOpenMusic: () => void }

/** Mini player (fora da tela de músicas) e botão de suporte urgente. */
export const AgentFooter: React.FC<AgentFooterProps> = ({ view, showMini, player, onOpenMusic }) => (
  <>
      {showMini && player.current && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0B1120]/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="h-1 bg-white/10"><div className="h-full bg-pink-400" style={{ width: `${player.progress * 100}%` }} /></div>
          <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-2">
            <button onClick={() => onOpenMusic()} className={`${btn} min-w-0 flex-1 px-2 text-left`}>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-pink-300">{player.playing ? 'Tocando' : 'Pausado'}</span>
              <span className="block truncate text-base font-bold">{player.current.title}</span>
            </button>
            <PlayerButtons player={player} size="sm" />
          </div>
        </div>
      )}

      {view.startsWith('support') && <a
        href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label="Suporte urgente: WhatsApp do Vitor"
        className={`${btn} fixed right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-[#25D366] px-5 text-base font-black text-[#04210F] shadow-lg shadow-black/50 ${showMini ? 'bottom-24' : 'bottom-5'}`}
      >
        <MessageCircle className="h-6 w-6" />Vitor
      </a>}
  </>
);
