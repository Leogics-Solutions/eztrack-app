import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultOutsourceBody, savedOutsourceBody, outsourceTextOrderDetails, outsourceAttachmentName } from '../utils/outsourceRequestMessage.ts';

const run = { source_file_s3_key: null, output_refs: {}, source_caption: 'Internal sender notes should not leak' };
const data = { customer: 'NJY APPAREL', inv_date: '2026-11-03', currency: 'MYR', issuing_entity: { legal_name: 'SERI MAJUJAYA', outbound_channel: 'EMAIL' }, lines: [{name:'CVC Printed Fabric',qty:2600,unit:'KG',unit_price_foreign:25,amount_foreign:65000}],totals:{amount_foreign_total:65000} };
test('2996 text-only email includes the exact item, quantity, UOM, unit cost and total',()=>{
 const body=defaultOutsourceBody(run,data);
 for(const value of ['DESC: CVC Printed Fabric','QTY: 2600','UOM: KG','UNIT PRICE: RM 25.00','TOTAL: RM 65,000.00','using the order details below'])assert.ok(body.includes(value),value);
 assert.doesNotMatch(body,/attached purchase order|Internal sender notes/);
});
test('the same text-only order details appear in WhatsApp',()=>{
 const body=defaultOutsourceBody(run,{...data,issuing_entity:{...data.issuing_entity,outbound_channel:'WHATSAPP'}});
 assert.match(body,/DESC: CVC Printed Fabric/);assert.match(body,/QTY: 2600/);
 assert.doesNotMatch(body,/attached purchase order/);
});
test('a real PO retains attachment wording and does not copy internal item rows',()=>{
 const body=defaultOutsourceBody({...run,source_file_s3_key:'original.pdf'},data);
 assert.match(body,/for the attached purchase order/);assert.doesNotMatch(body,/DESC:/);
});
test('unsent old opening is corrected while genuine operator content is retained',()=>{
 const edited={...data,outsource_message_draft:{body:'Please prepare for the attached purchase order.\nKeep my own instructions.',body_source:'OPERATOR'}};
 assert.equal(savedOutsourceBody(run,edited),'Please prepare using the order details below.\nKeep my own instructions.');
 assert.equal(savedOutsourceBody({...run,output_refs:{outsourced_email:{status:'sent'}}},edited),edited.outsource_message_draft.body);
});
test('do not fabricate numbers, units or currency for a partial description',()=>{
 const body=outsourceTextOrderDetails({lines:[{name:'Description only'}]});
 assert.equal(body,'DESC: Description only');
});
test('preserve source precision rather than rounding the unit cost',()=>{
 assert.match(outsourceTextOrderDetails({...data,lines:[{name:'Fabric',qty:1,unit_price_foreign:25.345,amount_foreign:25.345}]}),/UNIT PRICE: RM 25\.345/);
});
test('full original PDF filename is shown for an unsent split request, retaining custom names and sent history',()=>{
 const pdf={source_filename:'original-set-1-of-3.pdf',output_refs:{source_transaction_type:'pdf',source_transaction_count:3,bundle_source_filename:'original.pdf'}};
 const draft={outsource_message_draft:{filename:'original-set-1-of-3.pdf'}};
 assert.equal(outsourceAttachmentName(pdf,draft),'original.pdf');
 assert.equal(outsourceAttachmentName(pdf,{outsource_message_draft:{filename:'My reviewed file.pdf'}}),'My reviewed file.pdf');
 assert.equal(outsourceAttachmentName({...pdf,output_refs:{...pdf.output_refs,outsourced_whatsapp:{status:'sent'}}},draft),'original-set-1-of-3.pdf');
});
