import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultOutsourceBody, outsourceSupplierContent, savedOutsourceBody, outsourceRequestDate } from '../utils/outsourceRequestMessage.ts';

const caption = 'INV&DO\nJET *R.ACC\nV SIGNATURE to CARNAUBA AUTOSPA SDN BHD - 2 sets\nDate: 19/10/2026\nDesc & qty may refer to previous invoice';
const run = { source_caption: caption, source_file_s3_key: null, output_refs: { source_transaction_count: 2 } };
const data = { customer: 'CARNAUBA AUTOSPA SDN BHD', inv_date: '2026-10-19', issuing_entity: { legal_name: 'V SIGNATURE', outbound_channel: 'WHATSAPP' }, lines: [{ name: 'INTERNAL ITEM NOTES' }] };
const summary = 'V SIGNATURE to CARNAUBA AUTOSPA SDN BHD - 2 sets\nDate: 19/10/2026';

test('WhatsApp uses only structured request fields, even without a source attachment', () => {
  assert.equal(outsourceSupplierContent(run, data), summary);
  assert.equal(defaultOutsourceBody(run, data), `Hi, please help arrange open invoice\n\n${summary}\n\nPlease help to issue DO also,\nThanks`);
});

test('email matches the requested wording and derives its opening count', () => {
  const email = { ...data, issuing_entity: { ...data.issuing_entity, outbound_channel: 'EMAIL' } };
  assert.equal(defaultOutsourceBody(run, email), `Dear,\n\nPlease prepare 2 set Delivery Order and Sales Invoice for the attached purchase order.\n\n${summary}\n\nThank you.\n\nRegards,\nBryan`);
  for (const count of [1, 4]) {
    assert.match(defaultOutsourceBody({ ...run, output_refs: { source_transaction_count: count } }, email), new RegExp(`Please prepare ${count} set Delivery Order`));
  }
});

test('PO comes only from its field; reviewer date takes precedence over source date', () => {
  assert.equal(outsourceSupplierContent(run, { ...data, inv_date: '2026-06-30', order_date: '2026-10-19', po_number: 'PO-91', source_reference: 'JET * R.ACC' }), 'V SIGNATURE to CARNAUBA AUTOSPA SDN BHD - 2 sets\nDate: 30/06/2026\nPO No: PO-91');
  assert.equal(outsourceRequestDate({ inv_date: '2026-02-30' }), '');
  assert.equal(outsourceRequestDate({ inv_date: '9/10/2026' }), '09/10/2026');
});

test('old generated drafts are refreshed; deliberate operator text and sent history stay intact', () => {
  const oldBody = `Hi, please help arrange open invoice\n\n${caption}\n\nThanks`;
  const old = { ...data, outsource_message_draft: { body: oldBody } };
  assert.equal(savedOutsourceBody(run, old), null);
  assert.equal(defaultOutsourceBody(run, old), defaultOutsourceBody(run, data));
  assert.equal(savedOutsourceBody(run, { ...data, outsource_message_draft: { body: 'My reviewed message' } }), 'My reviewed message');
  assert.equal(savedOutsourceBody({ ...run, output_refs: { outsourced_whatsapp: { status: 'sent' } } }, old), oldBody);
});

test('old editable email Review appendix is not retained as a new default', () => {
  const old = { ...data, outsource_message_draft: { body: 'Dear,\n\nOrders in this request:\nReview #2240 | PO | internal' } };
  assert.equal(savedOutsourceBody(run, old), null);
});

test('generated saved drafts follow corrected dates and counts after reload', () => {
  const changed = { ...data, inv_date: '2026-06-30', set_count: 3, outsource_message_draft: { body: defaultOutsourceBody(run, data), body_source: 'ORDER_FIELDS' } };
  const body = defaultOutsourceBody(run, changed);
  assert.match(body, /- 3 sets\nDate: 30\/06\/2026/);
  assert.doesNotMatch(body, /19\/10\/2026/);
});

test('invoice-only requests keep the existing document selection without internal command lines', () => {
  const invoiceRun = { ...run, output_refs: { ...run.output_refs, requested_document_types: ['invoice'] } };
  assert.doesNotMatch(defaultOutsourceBody(invoiceRun, data), /issue DO also|INV&DO|JET|INTERNAL ITEM/);
});
