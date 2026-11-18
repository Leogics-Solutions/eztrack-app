import test from 'node:test';
import assert from 'node:assert/strict';
import { currentPaymentError } from '../utils/paymentErrorState.ts';
const old = 'Cannot prepare Customer Payments: Finance previously marked PENDING SLIP.';
const ready = { status:'PENDING_REVIEW', review_schema:{template_key:'payment_knock_off'},
  corrected_data:{payment_state:{ready_to_post:true,blockers:[]}} };
test('fresh ready result removes the superseded pending-slip error',()=>assert.equal(currentPaymentError(old,ready),null));
test('read admission conflict disappears after a fresh ready result',()=>assert.equal(currentPaymentError('A matching payment is being admitted or stopped. No payment request was sent.',ready),null));
test('a currently blocked or failed result retains the warning',()=>{
  assert.equal(currentPaymentError(old,{...ready,error_message:old}),old);
  assert.equal(currentPaymentError(old,{...ready,corrected_data:{payment_state:{ready_to_post:false,blockers:['pending']}}}),old);
});
test('uncertain posting is never hidden',()=>{
  assert.equal(currentPaymentError(old,{...ready,output_refs:{payment_submit_interrupted:'original-job'}}),old);
  assert.equal(currentPaymentError('SQL result unknown; reconcile the original OR.',ready),'SQL result unknown; reconcile the original OR.');
});
test('completed accounting clears only the known old validation message',()=>{
  assert.equal(currentPaymentError(old,{...ready,status:'COMPLETED'}),null);
  assert.equal(currentPaymentError('Notification failed',{...ready,status:'COMPLETED'}),'Notification failed');
});
test('other workflows keep their original error',()=>assert.equal(currentPaymentError(old,{...ready,review_schema:{template_key:'order_to_invoice'}}),old));
