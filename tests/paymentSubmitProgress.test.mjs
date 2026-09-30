import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentSubmitProgress } from '../utils/paymentSubmitProgress.ts';

test('queued work does not pretend SQL has started', () => {
  assert.deepEqual(paymentSubmitProgress({status:'PENDING', result:{stage:'QUEUED'}}).steps.map(s=>s.state), ['waiting','waiting','waiting']);
});
test('progress distinguishes saved OR from failed notification', () => {
  const result=paymentSubmitProgress({status:'NEEDS_ATTENTION',result:{stage:'NOTIFYING'}});
  assert.equal(result.running,false);
  assert.deepEqual(result.steps.map(s=>s.state), ['done','done','stopped']);
});
test('unknown posting outcome is stopped and never shown complete', () => {
  assert.deepEqual(paymentSubmitProgress({status:'INTERRUPTED',result:{stage:'POSTING'}}).steps.map(s=>s.state), ['done','stopped','waiting']);
});
test('only successful completion marks all three steps done', () => {
  assert.deepEqual(paymentSubmitProgress({status:'SUCCESS',result:{stage:'COMPLETE'}}).steps.map(s=>s.state), ['done','done','done']);
});
