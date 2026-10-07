import test from 'node:test';
import assert from 'node:assert/strict';
import { sqlQueueType, sqlQueueState, sqlQueueTime, sqlQueueStage } from '../utils/sqlQueueView.ts';
import { sqlQueueNotice } from '../utils/sqlQueueNotice.ts';
test('position nine means eight requests ahead, including current work',()=>{
  assert.match(sqlQueueNotice({status:'PENDING',queue_position:9}),/position: 9 \(8 request\(s\) ahead\)/);
  assert.match(sqlQueueNotice({status:'PENDING',queue_position:1}),/0 request\(s\) ahead/);
});
test('private queue rows reveal neither type nor identity',()=>{
  assert.equal(sqlQueueType({restricted:true,job_type:'order_batch',action:'PREPARE'}),'Other workspace request / 其他工作区请求');
});
test('prepare completion must not be described as posted to SQL',()=>{
  assert.match(sqlQueueType({job_type:'order_batch',action:'PREPARE'}),/Prepare DO/);
  assert.doesNotMatch(sqlQueueState('SUCCESS'),/posted/i);
  assert.match(sqlQueueType({job_type:'payment_sql_preview'}),/Payment SQL check/);
});
test('timestamps use Malaysia time and reject invalid dates',()=>{
  assert.match(sqlQueueTime('2026-10-07T01:00:01Z'),/07\/10.*09:00:01/);
  assert.equal(sqlQueueTime('bad'),'—');
});
test('running row preparation is distinct from save completion',()=>{
  assert.equal(sqlQueueStage('prepared_invoice_lines_18_of_525'),'Invoice: 18 / 525 rows prepared');
});
