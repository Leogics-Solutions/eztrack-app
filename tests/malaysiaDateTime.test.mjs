import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMalaysiaDateTime } from '../lib/malaysiaDateTime.ts';

test('naive UTC, Z and offset timestamps all show the same Malaysia time', () => {
  for (const tz of ['UTC', 'Asia/Kuala_Lumpur', 'America/New_York']) {
    process.env.TZ = tz;
    const expected = formatMalaysiaDateTime('2026-10-07T09:56:39Z');
    assert.match(expected, /17:56:39/);
    for (const input of ['2026-10-07T09:56:39', '2026-10-07 09:56:39', '2026-10-07T17:56:39+08:00']) {
      assert.equal(formatMalaysiaDateTime(input), expected);
    }
  }
});
test('missing or invalid timestamps do not break the Inbox', () => {
  assert.equal(formatMalaysiaDateTime(null), null);
  assert.equal(formatMalaysiaDateTime('bad date'), null);
});
