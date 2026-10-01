import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentAllocationNeedsRefresh, paymentAllocationEdits, paymentPlanChanged, paymentInvoiceNumberEdit } from '../utils/paymentAllocationReview.ts';

const invoices = [
  {invoice_number:'MMIV250529-08', requested_amount:37457.6, requested_amount_source:'MANUAL'},
  {invoice_number:'MMIV250630-09', requested_amount:14357.4, requested_amount_source:'MANUAL'},
];
const allocated = invoices.map(row => ({invoice_number:row.invoice_number, amount_to_allocate:row.requested_amount}));

test('1392 FIFO amounts saved with an empty OR plan need a check, not an unapplied-credit override', () => {
  assert.equal(paymentAllocationNeedsRefresh(invoices, []), true);
  assert.equal(paymentAllocationNeedsRefresh(invoices, allocated), false);
});
test('same total with the wrong per-invoice split still needs refresh', () => {
  assert.equal(paymentAllocationNeedsRefresh(invoices, [
    {...allocated[0], amount_to_allocate:30000}, {...allocated[1], amount_to_allocate:21815},
  ]), true);
});
test('a checked partial allocation may legitimately leave unapplied credit', () => {
  assert.equal(paymentAllocationNeedsRefresh([{...invoices[0], requested_amount:100}],
    [{...allocated[0], amount_to_allocate:100}]), false);
});
test('allocations across multiple slips are counted per selected invoice in cents', () => {
  assert.equal(paymentAllocationNeedsRefresh([{...invoices[0], requested_amount:0.3}],
    [{...allocated[0], amount_to_allocate:0.1}, {...allocated[0], amount_to_allocate:0.2}]), false);
});
test('removed invoice allocations, duplicates and malformed manual amounts need review', () => {
  assert.equal(paymentAllocationNeedsRefresh([invoices[0]], allocated), true);
  assert.equal(paymentAllocationNeedsRefresh([invoices[0],invoices[0]], [allocated[0]]), true);
  for (const amount of [null, NaN, Infinity, -1, 0.001]) {
    assert.equal(paymentAllocationNeedsRefresh([{...invoices[0],requested_amount:amount}],[]), true);
  }
});
test('an intentionally invoice-free payment retains its separate credit approval flow', () => {
  assert.equal(paymentAllocationNeedsRefresh([], []), false);
});

test('editing OR allocations updates requested totals and does not create a permanent mismatch', () => {
  const edited = paymentAllocationEdits(invoices, [
    {...allocated[0], or_index:1, amount_to_allocate:30000},
    {...allocated[0], or_index:2, amount_to_allocate:1000},
    {...allocated[1], or_index:2, amount_to_allocate:14357.4},
  ], {accept_unapplied:true, accept_customer_mismatch:true});
  assert.deepEqual(edited.requested_invoices.map(r=>r.requested_amount), [31000,14357.4]);
  assert.equal(paymentAllocationNeedsRefresh(edited.requested_invoices, edited.allocations), false);
  assert.equal(edited.sql_preview.status, 'stale');
  assert.equal(edited.review_override.accept_unapplied, false);
  assert.equal(edited.review_override.accept_customer_mismatch, true);
  assert.deepEqual(edited.allocation_override, edited.allocations);
});

test('a later invoice/slip edit invalidates an earlier manual OR split and credit approval', () => {
  const lowerEdit = paymentAllocationEdits(invoices, allocated, {accept_unapplied:true});
  const upperEdit = {...lowerEdit, ...paymentPlanChanged(lowerEdit.review_override), requested_invoices:invoices};
  assert.deepEqual(upperEdit.allocations, []);
  assert.deepEqual(upperEdit.allocation_override, []);
  assert.equal(upperEdit.review_override.accept_unapplied, false);
  assert.equal(paymentAllocationNeedsRefresh(upperEdit.requested_invoices, upperEdit.allocations), true);
});

test('correcting one invoice number preserves every requested amount and other verified rows', () => {
  const rows = invoices.map(row=>({...row,open_balance:40000,stated_amount:100}));
  const edited = paymentInvoiceNumberEdit(rows, 1, 'CORRECTED');
  assert.deepEqual(edited[0], rows[0]);
  assert.equal(edited[1].invoice_number,'CORRECTED');
  assert.equal(edited[1].invoice_number_as_printed, rows[1].invoice_number);
  assert.equal(edited[1].open_balance,null);
  assert.equal(edited[1].requested_amount,14357.4);
  assert.equal(edited[1].stated_amount,100);
});
