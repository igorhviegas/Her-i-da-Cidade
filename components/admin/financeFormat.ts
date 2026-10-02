export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatMoney = (value: number) => brl.format(value);
export const formatDate = (date: Date) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
export const monthLabel = (monthKey: string) => `${MONTH_NAMES[Number(monthKey.slice(5)) - 1]} de ${monthKey.slice(0, 4)}`;
export const shortMonthLabel = (monthKey: string) => `${MONTH_NAMES[Number(monthKey.slice(5)) - 1].slice(0, 3)}/${monthKey.slice(2, 4)}`;

export const inputClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50';
export const labelClass = 'block text-xs font-semibold text-white/70';
export const cardClass = 'rounded-2xl border border-white/10 bg-[#0D1527] p-5 shadow-lg';
export const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50';
export const ghostBtn = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-50';
