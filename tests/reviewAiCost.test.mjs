import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAiCost, aiStageLabel } from '../utils/reviewAiCost.ts';

test('small costs remain visible instead of rounding to free', () => {
  assert.equal(formatAiCost('0.000004'), '< USD $0.0001');
  assert.equal(formatAiCost('0'), 'USD $0.0000');
  assert.equal(formatAiCost('0.03234'), 'USD $0.0323');
  assert.equal(formatAiCost('NaN'), 'Unavailable');
  assert.equal(formatAiCost(null), 'Cost not yet known');
});
test('shared source and customer processing have clear labels', () => {
  assert.equal(aiStageLabel('excel_ai.discover_workbook_units'), 'Shared workbook discovery');
  assert.equal(aiStageLabel('payment_business_decision.select_customer'), 'Customer matching');
});
