import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import ts from 'typescript';

const filename = path.resolve('components/automation/AutomationStatus.tsx');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = new Module(filename);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);
const {resolveAutomationStatus, AUTOMATION_STATUS_LEGEND} = loaded.exports;

test('pending delivery has its own status across Review and Inbox', () => {
  const status = resolveAutomationStatus('DELIVERY_PENDING');
  assert.equal(status.key, 'DELIVERY_PENDING');
  assert.equal(status.label, 'Delivery pending');
  assert.match(status.meaning, /do not post/);
  assert.ok(AUTOMATION_STATUS_LEGEND.some(item => item.key === status.key));
});

test('actual failure and completion keep their distinct labels', () => {
  for (const status of ['FAILED', 'OUTPUT_FAILED', 'ERROR']) {
    assert.equal(resolveAutomationStatus(status).key, 'FAILED');
  }
  assert.equal(resolveAutomationStatus('COMPLETED').key, 'COMPLETED');
});
