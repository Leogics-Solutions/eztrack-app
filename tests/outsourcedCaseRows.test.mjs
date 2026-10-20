import test from 'node:test';
import assert from 'node:assert/strict';
import { caseRows, caseTitle, caseAmount } from '../lib/outsourcedCaseRows.ts';

test('one row per source request preserves distinct routes and all set links', () => {
  const set = { issuing_company: 'SUPPLIER', customer: 'BUYER', currency: 'MYR', line_count: 1, delivered: false, status: 'COMPLETED' };
  const rows = caseRows([{ case_id: 1, sets: [
    { ...set, run_id: 1, delivered: true },
    { ...set, run_id: 2, status: 'VERIFICATION_FAILED' },
    { ...set, run_id: 3, customer: 'OTHER BUYER' },
    { ...set, run_id: 4, route_key: 'another supplier account' },
  ] }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, 'ACTION');
  assert.deepEqual(rows[0].sets.map((set) => set.run_id), [1, 2, 3, 4]);
  assert.equal(rows[0].set.run_id, 2);
  assert.equal(caseTitle(rows[0]), 'SUPPLIER → Multiple customers · 4 sets');
});

test('case 2322 stays one six-set request across currency and destination edits', () => {
  const sets=Array.from({length:6},(_,i)=>({run_id:2322+i,status:'WAITING_EXTERNAL_DOCUMENTS',
    issuing_company:'FIN8',customer:'YL PROSPER',currency:'MYR',amount:5000,line_count:1,delivered:false,
    route_key:i===2 ? 'edited-destination' : 'original-destination'}));
  const [row]=caseRows([{case_id:2322,sets}]);
  assert.equal(row.sets.length,6);assert.equal(row.state,'WAITING');
  assert.equal(caseAmount(row),'RM 30,000.00');
  assert.equal(caseTitle(row),'FIN8 → YL PROSPER · 6 sets');
});

test('unknown money never becomes zero and different currencies are never added together', () => {
  const set={run_id:1,status:'PENDING_REVIEW',line_count:1,delivered:false};
  const row=sets=>caseRows([{case_id:1,sets}])[0];
  assert.equal(caseAmount(row([{...set,currency:'MYR',amount:null}])),'Amount needs confirmation');
  assert.equal(caseAmount(row([{...set,amount:5000}])),'Currency needs confirmation');
  assert.equal(caseAmount(row([{...set,currency:'MYR',amount:5000},{...set,run_id:2,currency:'USD',amount:100}])),'RM 5,000.00 + USD 100.00');
  assert.equal(caseAmount(row([{...set,currency:'MYR',amount:0}])),'RM 0.00');
});
