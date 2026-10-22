import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

const require = createRequire(import.meta.url);
const file = new URL('../components/review/InternalCaseDelivery.tsx', import.meta.url);
const compiled = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
}}).outputText;
const module = new Module(file.pathname);
module.paths = require.resolve.paths('next/link');
module._compile(compiled, file.pathname);
const { InternalCaseDelivery } = module.exports;

test('the blocked set and its actual reason are visible before any case delivery', () => {
  const html=renderToStaticMarkup(React.createElement(InternalCaseDelivery,{state:{
    status:'waiting_sets',total:3,ready_count:2,run_ids:[1,2,3],filename:'MURNIRAYA - 3SETS.zip',
    blockers:[{run_id:2,set_index:2,label:'PO B',reason:'Review proposed SQL item GRINDER'}],
  }}));
  assert.match(html,/2 \/ 3 sets/);assert.match(html,/Set 2/);assert.match(html,/Review #2/);
  assert.match(html,/href="\/agents\/runs\/2"/);assert.match(html,/GRINDER/);
  assert.match(html,/Completed sets are held/);assert.match(html,/MURNIRAYA - 3SETS.zip/);
});

test('completed case shows one delivered archive, without stale blocker instructions', () => {
  const html=renderToStaticMarkup(React.createElement(InternalCaseDelivery,{state:{
    status:'sent',total:2,ready_count:2,run_ids:[1,2],filename:'MURNIRAYA TO MAKII SUSHI BAR - 2SETS.zip',
    blockers:[{run_id:2,reason:'old warning'}],
  }}));
  assert.match(html,/Case ZIP delivered/);assert.match(html,/no need to resend/);
  assert.doesNotMatch(html,/old warning|Resolve the blocked set/);
});

test('single-set and unrelated reviews do not show the combined-delivery panel', () => {
  assert.equal(renderToStaticMarkup(React.createElement(InternalCaseDelivery,{})),'');
});
