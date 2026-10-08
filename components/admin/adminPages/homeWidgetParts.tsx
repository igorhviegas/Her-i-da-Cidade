import React from 'react';
import { AlertCircle, ArrowRight, Loader2, RefreshCw } from 'lucide-react';

export type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

interface WidgetProps {
  title: string; subtitle: string; icon: React.ElementType; tone: string; onOpen: () => void; openLabel: string; children: React.ReactNode;
}

export const Widget: React.FC<WidgetProps> = ({ title, subtitle, icon: Icon, tone, onOpen, openLabel, children }) => (
  <section className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#0D1527] p-5 shadow-lg" aria-label={title}>
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-white/45">{subtitle}</p>
      </div>
      <div className={`shrink-0 rounded-xl p-2 ${tone}`}><Icon className="h-4 w-4" aria-hidden /></div>
    </header>
    <div className="flex-1">{children}</div>
    <button type="button" onClick={onOpen} className="mt-4 flex items-center gap-1 self-start text-xs font-semibold text-blue-400 transition-colors hover:text-blue-300">
      {openLabel}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </button>
  </section>
);

export const Loading = () => <div className="flex items-center gap-2 py-6 text-xs text-white/50"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando…</div>;
export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="py-6 text-sm text-white/45">{children}</p>;
export const ErrorState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-start gap-2 py-4 text-xs text-red-300">
    <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden />Não foi possível carregar este widget.</span>
    {onRetry && <button type="button" onClick={onRetry} className="flex items-center gap-1 font-semibold text-red-200 hover:text-white"><RefreshCw className="h-3 w-3" aria-hidden />Tentar de novo</button>}
  </div>
);
