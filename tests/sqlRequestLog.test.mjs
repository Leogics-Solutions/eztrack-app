import test from 'node:test';
import assert from 'node:assert/strict';
import { sqlRequestLogQuery, sqlRequestLogTime, malaysiaToday } from '../utils/sqlRequestLog.ts';

test('CSV and pages use identical filters, without restricting export to one page', () => {
  const filters = { date_from: '2026-10-07', date_to: '2026-10-07', company: 'MURNIRAYA & Co', state: 'FAILED', job_type: 'order_batch' };
  const page = new URLSearchParams(sqlRequestLogQuery(filters, 50));
  const exportQuery = new URLSearchParams(sqlRequestLogQuery(filters));
  assert.equal(page.get('offset'), '50'); assert.equal(page.get('limit'), '50');
  for (const [key, value] of exportQuery) assert.equal(page.get(key), value);
  assert.equal(exportQuery.has('offset'), false); assert.equal(exportQuery.has('limit'), false);
  assert.equal(exportQuery.get('company'), 'MURNIRAYA & Co');
});
test('log dates include year and use Malaysia date across the UTC boundary', () => {
  assert.match(sqlRequestLogTime('2026-10-06T16:00:01Z'), /07\/10\/2026.*00:00:01/);
  assert.equal(malaysiaToday(new Date('2026-10-06T16:00:01Z')), '2026-10-07');
  assert.equal(sqlRequestLogTime('bad'), '—');
});
