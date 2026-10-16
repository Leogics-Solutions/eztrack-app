import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceOrderHeadings } from '../utils/orderSourceHeadings.ts';

const heading = { text: 'Excavator Rental Charges (Invoice issue date 30.06.2026)',
  source: 'EXCEL_DESCRIPTION_ROW', scoped_row: 2, column: 3 };
const lines = [{ name: 'Rental of 1 unit Excavator 300 without diesel - Date: 30.05.2026 to 30.06.2026',
  qty: 27, unit: 'DAY', amount_foreign: 31050, unit_price_foreign: 1150 }];

test('2146 displays its unpriced source title without adding a billable line', () => {
  const original = JSON.stringify(lines);
  assert.deepEqual(sourceOrderHeadings([heading], lines), [heading.text]);
  assert.equal(JSON.stringify(lines), original);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].qty, 27);
});

test('source title already present in description or continuation is shown once', () => {
  assert.deepEqual(sourceOrderHeadings([heading], [{ name: heading.text }]), []);
  assert.deepEqual(sourceOrderHeadings([heading], [{ more_description: 'Context\n'+heading.text }]), []);
  assert.deepEqual(sourceOrderHeadings([heading, { ...heading, text: ' '+heading.text+' ' }], []), [heading.text]);
});

test('unverified metadata, missing coordinates and blank titles are excluded', () => {
  assert.deepEqual(sourceOrderHeadings([{ ...heading, source: 'AI_GUESS' },
    { text: heading.text }, { ...heading, scoped_row: 0 }, { ...heading, column: '3' },
    { ...heading, text: ' ' }, null], lines), []);
  assert.deepEqual(sourceOrderHeadings(undefined, lines), []);
});
