import test from 'node:test';
import assert from 'node:assert/strict';
import { supplierVerificationRows } from '../utils/supplierVerificationRows.ts';

test('each quantity and price stays on its own document and item line', () => {
  const rows=supplierVerificationRows({documents:[{document_number:'INV45',checks:[
    {code:'DESCRIPTION',line:1,expected:'TH-106',actual:'TH-106',status:'PASSED'},
    {code:'QUANTITY',line:1,expected:600,actual:600,status:'PASSED'},
    {code:'QUANTITY',line:2,expected:432,actual:400,status:'FAILED'}]},
    {document_number:'DO46',checks:[{code:'QUANTITY',line:1,expected:110,actual:110,status:'PASSED'}]}]});
  assert.equal(rows.length,4);
  assert.equal(rows[1].expected,600);
  assert.equal(rows[2].expected,432);
  assert.equal(rows[2].label,'Quantity · line 2');
  assert.equal(rows[3].document,'DO46');
});

test('original PO failures stay visible even when Review checks pass', () => {
  const rows=supplierVerificationRows({documents:[{checks:[{code:'DOCUMENT_DATE',expected:'2026-10-20',actual:'2026-10-20',status:'PASSED'}]}],
    original_source_comparisons:[{filename:'INV45.pdf',checks:[{category:'DATE',status:'FAILED',original_evidence:'Excel H1: 19/10',returned_evidence:'PDF: 20/10',reason:'Date differs'}]}]});
  assert.equal(rows.filter(r=>!r.match).length,1);
  assert.equal(rows[1].expected,'Excel H1: 19/10');
  assert.equal(rows[1].note,'Date differs');
});

test('unavailable evidence never renders as a match', () => {
  const rows=supplierVerificationRows({documents:[{checks:[{code:'AI_EXTRACTION',actual:'Unavailable'}]}],original_source_comparisons:[{filename:'bad.pdf',reason:'Missing source'}]});
  assert.equal(rows.length,2);
  assert.equal(rows.filter(r=>r.match).length,0);
});


test('a system read error is explicit and never rendered as a document mismatch', () => {
 const rows=supplierVerificationRows({documents:[{filename:'inv.pdf',checks:[{code:'VERIFICATION_SYSTEM_ERROR',label:'Verification system error',status:'FAILED',actual:'Binding unavailable'}]}]});
 assert.equal(rows[0].systemError,true);assert.equal(rows[0].match,false);
});

test('the same DO and INV number remains distinguishable and unpriced DO money is not a difference', () => {
 const rows=supplierVerificationRows({documents:[
  {document_number:'SM19',kind:'DELIVERY_ORDER',checks:[{code:'UNIT_PRICE',status:'NOT_APPLICABLE',actual:'Not printed'}]},
  {document_number:'SM19',document_type:'INVOICE',checks:[{code:'UNIT_PRICE',status:'FAILED',expected:58.75,actual:59}]}]});
 assert.equal(rows[0].document,'DO · SM19');assert.equal(rows[0].match,true);
 assert.equal(rows[0].status,'NOT_APPLICABLE');
 assert.equal(rows[1].document,'INV · SM19');assert.equal(rows[1].match,false);
});
