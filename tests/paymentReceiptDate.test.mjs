import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../components/automation/PaymentReceiptDate.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', js)(require, mod, mod.exports);
const Component = mod.exports.default;
const slip = { slip_date: '2026-09-29', payment_date: '2026-10-01', receipt_date_policy: 1,
  payment_date_source: 'FINANCE_CONFIRMATION_DATE', payment_date_evidence: { capture_event_id: 2 } };
const render = (extra = {}) => renderToStaticMarkup(React.createElement(Component, {
  slip: {...slip, ...extra}, editable: true, index: 0, onChange() {}
}));

test('cross-month receipt displays both dates, Finance provenance and an unchecked review checkbox', () => {
  const html = render();
  assert.match(html, /Slip \/ cheque date: 2026-09-29/);
  assert.match(html, /value="2026-10-01"/);
  assert.match(html, /Different accounting months/);
  assert.match(html, /Malaysia time/);
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, /checked=""/);
});

test('acknowledgement applies only to exact dates and confirmation event', () => {
  assert.match(render({receipt_date_ack:'2026-09-29|2026-10-01|2'}), /checked=""/);
  assert.doesNotMatch(render({receipt_date_ack:'2026-09-29|2026-10-01|1'}), /checked=""/);
});

test('manual correction requires reason, existing SQL dates cannot be edited', () => {
  assert.match(render({receipt_date_edit_requested:true}), /required=""/);
  const posted = render({posted_or_date:'2026-10-01'});
  assert.match(posted, /disabled=""/);
  assert.match(posted, /Amend in SQL, then sync/);
  assert.doesNotMatch(posted, /type="checkbox"/);
});

test('same month date mismatch warns, matching dates do not warn', () => {
  assert.match(render({slip_date:'2026-10-01',payment_date:'2026-10-02'}), /OR uses the bank receipt date/);
  assert.doesNotMatch(render({slip_date:'2026-10-01'}), /accounting months|type="checkbox"/);
});
