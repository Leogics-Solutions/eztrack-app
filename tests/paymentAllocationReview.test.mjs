import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentAllocationNeedsRefresh } from '../utils/paymentAllocationReview.ts';

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
