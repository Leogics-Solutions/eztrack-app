import test from 'node:test';
import assert from 'node:assert/strict';
import { sqlQueueNotice } from '../utils/sqlQueueNotice.ts';
import { paymentSqlJobNotice } from '../utils/paymentSqlJob.ts';

test('future batch shows Malaysia date/time and does not promise completion', () => {
  const message = sqlQueueNotice({ status: 'PENDING', dispatch_mode: 'BATCH', scheduled_for: '2026-10-03T07:30:00Z', queue_position: null }, Date.parse('2026-10-03T07:12:00Z'));
  assert.match(message, /03\/10, 15:30 \(Malaysia time\)/);
  assert.match(message, /earliest start/);
  assert.doesNotMatch(message, /position/);
});
test('due immediate/batch jobs show shared queue position', () => {
  assert.match(sqlQueueNotice({status: 'PENDING', queue_position: 3}), /position: 3.*Orders, ORs and payment checks/);
  assert.match(sqlQueueNotice({status: 'PENDING', scheduled_for: '2000-01-01T00:00:00Z', queue_position: 1}), /position: 1/);
});
test('legacy/invalid scheduling metadata remains readable', () => {
  assert.match(sqlQueueNotice({status: 'PENDING', scheduled_for: 'bad'}), /Queued for SQL/);
  assert.equal(sqlQueueNotice({status: 'SUCCESS', queue_position: 1}), '');
});
test('SQL read notice explains the actual queue instead of pretending a query started', () => {
  assert.match(paymentSqlJobNotice({status: 'PENDING', scheduled_for: '2000-01-01T00:00:00Z', queue_position: 2}), /position: 2/);
});
