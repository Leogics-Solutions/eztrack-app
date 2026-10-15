import test from 'node:test';
import assert from 'node:assert/strict';
import { caseRows, caseTitle } from '../lib/outsourcedCaseRows.ts';

test('one row per supplier/customer/route, preserving all set links and mixed state', () => {
  const set = { issuing_company: 'SUPPLIER', customer: 'BUYER', currency: 'MYR', line_count: 1, delivered: false, status: 'COMPLETED' };
  const rows = caseRows([{ case_id: 1, sets: [
    { ...set, run_id: 1, delivered: true },
    { ...set, run_id: 2, status: 'VERIFICATION_FAILED' },
    { ...set, run_id: 3, customer: 'OTHER BUYER' },
    { ...set, run_id: 4, route_key: 'another supplier account' },
  ] }]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].state, 'ACTION');
  assert.deepEqual(rows[0].sets.map((set) => set.run_id), [1, 2]);
  assert.equal(rows[0].set.run_id, 2);
  assert.equal(caseTitle(rows[0]), 'SUPPLIER → BUYER · 2 sets');
});
