import React from 'react';
import { Loader2 } from 'lucide-react';

export type Run = (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;

export const input = 'w-full rounded-lg border border-white/10 bg-[#070B14] px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/60';
export const iconBtn = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent';
export const card = 'rounded-2xl border border-white/10 bg-[#0D1527]';

export const Loading: React.FC = () => <div className="flex items-center justify-center gap-3 py-12 text-sm text-white/40"><Loader2 className="h-6 w-6 animate-spin text-blue-400" />Carregando...</div>;
