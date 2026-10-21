import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceAmountPrecisionWarnings as warnings } from '../utils/sourceAmountPrecision.ts';

test('May and June commission amounts warn before verification, preserving raw values', () => {
 const data={lines:[{amount_foreign:10204.48},{name:'May',amount_foreign:9221.695},{name:'Jun',amount_foreign:14522.475}]};
 const before=JSON.stringify(data);const rows=warnings(data);
 assert.deepEqual(rows.map(r=>[r.line,r.amount]),[[2,'9221.695'],[3,'14522.475']]);
 assert.equal(JSON.stringify(data),before);
});

test('ordinary cents, trailing zeros and precise unit prices do not trigger amount warnings', () => {
 assert.deepEqual(warnings({lines:[{amount_foreign:1.01,unit_price_foreign:0.123},{amount_foreign:'9221.6900'},{amount_foreign:1004.56},{amount_foreign:0},{}]}),[]);
});

test('negative amounts, MYR fallback and exponent values are detected without treating zero as missing', () => {
 assert.equal(warnings({lines:[{amount_foreign:-0.005},{amount_myr:1e-3}]}).length,2);
 assert.deepEqual(warnings({lines:[{amount_foreign:0,amount_myr:1.005}]}),[]);
 assert.deepEqual(warnings({lines:[{category:'header',amount_foreign:1.005}]}),[]);
});
