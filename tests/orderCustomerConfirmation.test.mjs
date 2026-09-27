import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresOrderCustomerSelection as required } from '../utils/orderCustomerConfirmation.ts';
const base = { outsourced: false, identityChanged: false, status: 'DRAFT_GENERATED', hasProposal: false };
test('SST, connection, numbering and generic errors do not ask to create the customer', () => {
  for (const code of ['SQL_CUSTOMER_GROUP_EMPTY', 'SQL_TIMEOUT', 'SQL_NUMBER_SERIES_ERROR', undefined]) {
    assert.equal(required({ ...base, delivery: { status: 'failed', error_code: code } }), false);
  }
});
test('explicit missing customer still asks for selection', () => {
  assert.equal(required({ ...base, delivery: { status: 'needs_customer_approval' } }), true);
  assert.equal(required({ ...base, delivery: { status: 'failed', error_code: 'SQL_CUSTOMER_NOT_FOUND' } }), true);
});
test('proposal, outsourced order or changed identity suppresses stale selection', () => {
  for (const change of [{ hasProposal: true }, { outsourced: true }, { identityChanged: true }]) {
    assert.equal(required({ ...base, ...change, delivery: { status: 'needs_customer_approval' } }), false);
  }
});
