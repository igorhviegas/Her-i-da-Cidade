// Aviso do sino "Relatório de <mês> pronto" (Financeiro → Relatórios → Mensal). Puro: o cron diário de missões grava o aviso
// (functions/missions-sync.js). ID determinístico por mês: criado uma vez; descartado não volta. Como o cron roda todo dia, uma
// falha no dia 1º é recuperada no dia seguinte.
import { dateKey } from './missions-core.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Aviso do mês anterior ao de hoje (data de Brasília): { id, type, title, body, refType, refId } com refId = 'AAAA-MM'. */
export function buildReportNotice(now = new Date()) {
  const [year, month] = dateKey(now).split('-').map(Number);
  const prev = new Date(Date.UTC(year, month - 2, 1)); // mês anterior; Date.UTC resolve a virada de ano
  const key = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
  return {
    id: `monthly_report_${key}`, type: 'monthly_report', title: `Relatório de ${MONTHS[prev.getUTCMonth()]} pronto`,
    body: 'Receita, custos, serviços, clientes, Instagram e Fit do mês. Dá para salvar em PDF.', refType: 'report', refId: key,
  };
}
