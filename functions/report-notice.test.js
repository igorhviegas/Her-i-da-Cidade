import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportNotice } from './report-notice.js';

test('aviso do relatório mensal: sempre do mês anterior (data de Brasília), inclusive na virada do ano', () => {
  const a = buildReportNotice(new Date('2026-10-01T03:30:00Z')); // 00:30 de 01/10 em Brasília
  assert.deepEqual([a.id, a.title, a.refType, a.refId, a.type], ['monthly_report_2026-09', 'Relatório de setembro pronto', 'report', '2026-09', 'monthly_report']);
  assert.equal(buildReportNotice(new Date('2026-10-01T02:00:00Z')).refId, '2026-08'); // ainda 30/09 em Brasília: mês anterior é agosto
  assert.equal(buildReportNotice(new Date('2027-01-01T03:30:00Z')).refId, '2026-12');
  assert.equal(buildReportNotice(new Date('2026-03-15T12:00:00Z')).title, 'Relatório de fevereiro pronto');
});
