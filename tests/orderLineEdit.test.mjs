import test from 'node:test';
import assert from 'node:assert/strict';
import { editOrderLine } from '../utils/orderLineEdit.ts';
const line = { name: 'Cable', qty: 8000, unit_price_foreign: .63, amount_foreign: 5024 };
test('description and translation edits preserve source amount', () => {
  for (const patch of [{more_description:'Long specification'}, {match:{en_description:'Cable description'}}]) {
    assert.equal(editOrderLine(line, patch).amount_foreign, 5024);
  }
});
test('price and quantity changes recalculate using full precision', () => {
  assert.equal(editOrderLine(line, {unit_price_foreign:.628}).amount_foreign, 5024);
  assert.equal(editOrderLine(line, {qty:10}).amount_foreign, 6.3);
  assert.equal(editOrderLine(line, {qty:null}).amount_foreign, null);
  assert.equal(line.amount_foreign, 5024);
});

test('unit edits update the posted source unit without changing money', () => {
  const original = {...line, unit:'SET', source_unit:'SET'};
  const changed = editOrderLine(original, {unit:'PCS'});
  assert.equal(changed.source_unit, 'PCS');
  assert.equal(changed.omit_document_uom, false);
  assert.equal(changed.amount_foreign, 5024);
  const blank = editOrderLine(original, {unit:''});
  assert.equal(blank.source_unit, '');
  assert.equal(blank.omit_document_uom, true);
  assert.equal(original.source_unit, 'SET');
});
