import test from 'node:test';
import assert from 'node:assert/strict';
import {orderUnitPlaces, formatOrderUnit, changedSourceAmountIssue} from '../utils/orderAmountPolicy.ts';
test('precision uses issuing company exact identity, never customer or partial names', () => {
  for (const name of ['FLEXERO SDN. BHD.', 'MURNIRAYA SDN BHD', 'VISTA SEMANGAT TRADING SDN BHD']) assert.equal(orderUnitPlaces({legal_name:name}),3);
  for (const name of ['MAINCELL SDN BHD', 'NOT FLEXERO', 'VISTA ENGINEERING SDN BHD', 'PRECIS SDN BHD']) assert.equal(orderUnitPlaces({legal_name:name}),2);
});
test('final units show both positive and negative midpoint rounding consistently', () => {
  assert.equal(formatOrderUnit(1.005,2),'1.01'); assert.equal(formatOrderUnit(-1.005,2),'-1.01');
  assert.equal(formatOrderUnit(1.2345,3),'1.235'); assert.equal(formatOrderUnit(-1.2345,3),'-1.235');
});
test('1580 edited amount shows specific line and discrepancy without altering data', () => {
  const original={model:'L2',qty:1,unit_price_foreign:45.348,amount_foreign:45.348};
  const changed={...original,amount_foreign:44.348};
  const issue=changedSourceAmountIssue(changed,original,2,'USD');
  assert.match(issue,/Line 3 \(L2\)/); assert.match(issue,/difference = -1.00/);
  assert.equal(changed.amount_foreign,44.348); assert.equal(original.amount_foreign,45.348);
});
test('unchanged source-rounded values and matching edited amounts have no source arithmetic warning', () => {
  const original={qty:8000,unit_price_foreign:.63,amount_foreign:5024};
  assert.equal(changedSourceAmountIssue(original,original,0,'USD'),null);
  assert.equal(changedSourceAmountIssue({...original,qty:10,amount_foreign:6.3},original,0,'USD'),null);
});
