import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentSqlJobRunning, paymentSqlJobNotice, readPaymentSqlProgress } from '../utils/paymentSqlJob.ts';

test('new retry hides the old failed result before its first poll', () => {
  assert.equal(paymentSqlJobRunning('new', {id:'old',status:'FAILED'}), true);
  assert.equal(paymentSqlJobRunning('new', {id:'new',status:'PENDING'}), true);
  assert.equal(paymentSqlJobRunning('new', {id:'new',status:'RUNNING'}), true);
  assert.equal(paymentSqlJobRunning('new', {id:'new',status:'SUCCESS'}), false);
  assert.equal(paymentSqlJobRunning('', {id:'old',status:'RUNNING'}), false);
});

test('migrated job mismatch with an unchanged review stops the spinner', async () => {
  const result = await readPaymentSqlProgress('utc', async()=>({id:'local',status:'SUCCESS'}),
    async()=>({output_refs:{payment_sql_job_id:'utc'}}));
  assert.equal(result.follow, undefined);
  assert.equal(result.job.status, 'UNAVAILABLE');
  assert.equal(paymentSqlJobRunning('utc', result.job), false);
  assert.match(result.notice, /does not match/);
});

test('a genuine new check from another tab follows its new reference', async () => {
  const result = await readPaymentSqlProgress('old', async()=>({id:'new',status:'RUNNING'}),
    async()=>({output_refs:{payment_sql_job_id:'new'}}));
  assert.equal(result.follow, true);
  assert.equal(result.updated.output_refs.payment_sql_job_id, 'new');
});

test('status network errors report unknown, not perpetual RUNNING', async () => {
  const result = await readPaymentSqlProgress('job', async()=>{throw Error('offline');},
    async()=>assert.fail('Review should not be fetched'));
  assert.equal(paymentSqlJobRunning('job', result.job), false);
  assert.equal(result.retry, true);
  assert.match(result.notice, /unknown/);
});

test('completed customer check stays completed when review reload fails', async () => {
  const result = await readPaymentSqlProgress('job',
    async()=>({id:'job',status:'SUCCESS',result:{sql_status:'needs_customer'}}),
    async()=>{throw Error('offline');});
  assert.equal(result.job.status, 'SUCCESS');
  assert.equal(paymentSqlJobRunning('job', result.job), false);
  assert.match(result.notice, /customer confirmation needed/);
  assert.match(result.notice, /Could not reload/);
});
test('customer clarification is not displayed as a SQL connection failure, including old jobs', () => {
  for (const status of ['FAILED','SUCCESS']) {
    assert.match(paymentSqlJobNotice({status,result:{sql_status:'needs_customer'}}), /completed: customer confirmation needed/);
  }
  assert.equal(paymentSqlJobNotice({status:'FAILED',error_message:'SQL unavailable'}), 'SQL unavailable');
});
