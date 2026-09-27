import test from 'node:test';
import assert from 'node:assert/strict';
import { appendPaymentEvidence, paymentFilesForMessage } from '../utils/paymentEvidenceFiles.ts';

test('history previews use exact message identity and deduplicate merged evidence', () => {
  const linked = {file_key:'agent-runs/943/slip.jpg',capture_event_id:2502};
  const files = [linked, {...linked}, {file_key:'agent-runs/959/slip.jpg',capture_event_id:2539},
    {file_key:'agent-runs/944/reviewer-upload.jpg'}];
  assert.deepEqual(paymentFilesForMessage(files,2502),[linked]);
  assert.deepEqual(paymentFilesForMessage(files,2503),[]);
  assert.deepEqual(paymentFilesForMessage(files,undefined),[]);
});

const photo = (index) => ({ name: `photo-${index}.jpg`, size: 100 + index, lastModified: 1, type: 'image/jpeg' });
test('successive drops accumulate, duplicate selection is skipped, removal allows readding', () => {
  const first = appendPaymentEvidence([], [photo(1)]);
  const next = appendPaymentEvidence(first.files, [photo(2), photo(3), photo(1)]);
  assert.equal(next.files.length, 3);
  assert.match(next.message, /Already selected/);
  const removed = next.files.filter((file) => file.name !== 'photo-2.jpg');
  assert.equal(appendPaymentEvidence(removed, [photo(2)]).files.length, 3);
});
test('twenty-file limit applies across drops and preserves existing selections', () => {
  const existing = Array.from({length: 19}, (_, index) => photo(index));
  const result = appendPaymentEvidence(existing, [photo(19), photo(20)]);
  assert.equal(result.files.length, 20);
  assert.deepEqual(result.files.slice(0, 19), existing);
  assert.match(result.message, /up to 20/);
});
test('frontend formats agree with the backend upload allowlist', () => {
  assert.equal(appendPaymentEvidence([], [{...photo(0), name: 'scan.tiff'}]).files.length, 1);
  assert.equal(appendPaymentEvidence([], [{...photo(0), name: 'scan.heic'}]).files.length, 0);
});
