import test from 'node:test';
import assert from 'node:assert/strict';
import { scriptPublishTime, sortByPublishDate } from './scriptSchedule.js';

const day = (d) => new Date(2026, 9, d, 12);
const ts = (d) => ({ toDate: () => day(d) });

test('publicado usa a data real; não publicado usa a previsão', () => {
  assert.equal(scriptPublishTime({ publicationStatus: 'published', publishedAt: ts(3), plannedPublishAt: day(9) }), day(3).getTime());
  assert.equal(scriptPublishTime({ publicationStatus: 'unpublished', publishedAt: day(3), plannedPublishAt: day(9) }), day(9).getTime());
  assert.equal(scriptPublishTime({ publicationStatus: 'published', plannedPublishAt: day(9) }), day(9).getTime());
  assert.equal(scriptPublishTime({ publicationStatus: 'unpublished' }), null);
});

test('ordena por data e manda os sem data para o final', () => {
  const list = [
    { id: 'sem', publicationStatus: 'unpublished' },
    { id: 'd20', publicationStatus: 'unpublished', plannedPublishAt: day(20) },
    { id: 'd5', publicationStatus: 'published', publishedAt: ts(5) },
    { id: 'd10', publicationStatus: 'unpublished', plannedPublishAt: ts(10) },
  ];
  assert.deepEqual(sortByPublishDate(list).map((s) => s.id), ['d5', 'd10', 'd20', 'sem']);
  assert.deepEqual(sortByPublishDate(list, true).map((s) => s.id), ['d20', 'd10', 'd5', 'sem']);
});
