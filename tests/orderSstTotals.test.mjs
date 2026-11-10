import test from 'node:test';
import assert from 'node:assert/strict';
import {orderSstTotals,orderSstReconciliation} from '../utils/orderSstTotals.ts';
const state={applicable:true,ready:true,status:'NOT_GROUP_J',configured_rate:6,rate:6};
for(const [net,tax,gross] of [[10900,654,11554],[13470,808.2,14278.2]]) {
  test(`EPLUS ${net} shows tax and gross and reconciles`,()=>{
    const totals=orderSstTotals(net,[{qty:1,unit_price_foreign:net}],state,true);
    assert.equal(totals.tax,tax);assert.equal(totals.grandTotal,gross);
    const r=orderSstReconciliation({status:'MISMATCH',expected_foreign_total:gross,requires_review:true},totals,true);
    assert.equal(r.reconciliation.status,'MATCHED');assert.equal(r.reconciliation.variance_foreign,0);
  });
  test(`EPLUS ${net} unconfirmed difference identifies SST without accepting`,()=>{
    const totals=orderSstTotals(net,[{qty:1,unit_price_foreign:net}],{...state,ready:false,status:'UNVERIFIED',rate:0},true);
    const r=orderSstReconciliation({status:'MISMATCH',expected_foreign_total:gross,requires_review:true},totals,true);
    assert.equal(totals.tax,0);assert.equal(totals.grandTotal,net);assert.equal(r.sstDifference,true);assert.equal(r.reconciliation.requires_review,true);
  });
}
test('other variance, currency mismatch and foreign totals retain their guards',()=>{
  const totals=orderSstTotals(100,[{qty:1,unit_price_myr:100}],state,false);
  for(const [rec,domestic] of [[{status:'MISMATCH',expected_foreign_total:107},true],[{status:'MISMATCH',expected_foreign_total:106,currency_matches:false},true],[{status:'MISMATCH',expected_foreign_total:106},false]]) {
    const result=orderSstReconciliation(rec,totals,domestic);assert.equal(result.reconciliation.status,'MISMATCH');assert.equal(result.sstDifference,false);
  }
});
test('Group J keeps zero tax; missing conversion does not invent zero',()=>{
  assert.equal(orderSstTotals(100,[{qty:1,unit_price_myr:100}],{...state,status:'GROUP_J',rate:0},false).grandTotal,100);
  assert.equal(orderSstTotals(null,[],state,false),null);
});
test('tax rounds per native billable line and excludes context/deductions',()=>{
  const totals=orderSstTotals(100,[{qty:1,unit_price_myr:0.09},{qty:1,unit_price_myr:0.09},{category:'header',qty:1,unit_price_myr:999},{category:'deduction',qty:1,unit_price_myr:100},{qty:1,unit_price_myr:-10}],state,false);
  assert.equal(totals.tax,0.02);
});
