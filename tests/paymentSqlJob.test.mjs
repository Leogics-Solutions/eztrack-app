import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentSqlJobRunning, paymentSqlJobNotice } from '../utils/paymentSqlJob.ts';

test('new retry hides the old failed result before its first poll', () => {
  assert.equal(paymentSqlJobRunning('new', {id:'old',status:'FAILED'}), true);
  assert.equal(paymentSqlJobRunning('new', {id:'new',status:'PENDING'}), true);
  assert.equal(paymentSqlJobRunning('new', {id:'new',status:'RUNNING'}), true);
  assert.equal(paymentSqlJobRunning('new', {id:'new',status:'SUCCESS'}), false);
  assert.equal(paymentSqlJobRunning('', {id:'old',status:'RUNNING'}), false);
});
test('customer clarification is not displayed as a SQL connection failure, including old jobs', () => {
  for (const status of ['FAILED','SUCCESS']) {
    assert.match(paymentSqlJobNotice({status,result:{sql_status:'needs_customer'}}), /completed: customer confirmation needed/);
  }
  assert.equal(paymentSqlJobNotice({status:'FAILED',error_message:'SQL unavailable'}), 'SQL unavailable');
});
