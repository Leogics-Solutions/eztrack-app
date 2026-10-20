import test from 'node:test';
import assert from 'node:assert/strict';
import { returnedFilesEditable, returnedFilesError, returnedReplySelection } from '../utils/returnedAttachments.ts';

test('returned attachments editable before delivery, locked during verification and after send', () => {
  for (const status of ['WAITING_EXTERNAL_DOCUMENTS', 'EXTERNAL_DOCUMENTS_RECEIVED', 'VERIFICATION_PASSED', 'VERIFICATION_FAILED']) assert.equal(returnedFilesEditable(status), true);
  for (const status of ['AI_VERIFYING', 'DELIVERY_PENDING', 'COMPLETED', 'REJECTED']) assert.equal(returnedFilesEditable(status), false);
  assert.equal(returnedFilesEditable('VERIFICATION_PASSED', 'sent'), false);
  assert.equal(returnedFilesEditable('VERIFICATION_PASSED', '', true), false);
});

test('upload bounds and types match the returned-document API', () => {
  assert.equal(returnedFilesError([{name:'Invoice.pdf',size:40},{name:'DO.PNG',size:50}], 1), null);
  for (const files of [[], [{name:'bad.exe',size:1}], [{name:'empty.pdf',size:0}], [{name:'big.pdf',size:25*1024*1024+1}], Array(11).fill({name:'a.pdf',size:10})]) assert.ok(returnedFilesError(files,0));
  assert.ok(returnedFilesError([{name:'a.pdf',size:10}],20));
});

test('file checkboxes retain only this set after a two-set return is routed', () => {
  const saved=['inv45','do45','inv46','do46'];
  assert.deepEqual(returnedReplySelection([{file_key:'stored-inv45',source_file_key:'inv45'},{file_key:'stored-do45',source_file_key:'do45'}],saved),['inv45','do45']);
  assert.deepEqual(returnedReplySelection([{file_key:'stored-inv46',source_file_key:'inv46'},{file_key:'stored-do46',source_file_key:'do46'}],saved),['inv46','do46']);
  assert.deepEqual(saved,['inv45','do45','inv46','do46']);
});
