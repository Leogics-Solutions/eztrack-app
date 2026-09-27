import test from 'node:test';
import assert from 'node:assert/strict';
import {sstSaveBlocker} from '../utils/orderSstValidation.ts';
test('checked Group J still explains missing evidence',()=>{
 assert.match(sstSaveBlocker(false,false,'','2026-09-10','GROUP_J',true),/必填/);
 assert.equal(sstSaveBlocker(false,false,'MySST checked','2026-09-10','GROUP_J',true),null);
});
test('other blockers remain explicit',()=>{
 assert.match(sstSaveBlocker(false,false,'note','2026-09-10','GROUP_J',false),/勾选/);
 assert.match(sstSaveBlocker(true,false,'note','2026-09-10','GROUP_J',true),/不能修改/);
});
