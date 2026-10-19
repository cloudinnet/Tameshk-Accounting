'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadApi() {
  const head = { appendChild() {} };
  const document = { head, createElement: () => ({}) };
  const window = { document };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'portable-data.js'), 'utf8'), { window, Object, JSON });
  return window.TameshkPortableData;
}

test('backup JSON complexity validator accepts normal values and rejects excessive nesting', () => {
  const api = loadApi();
  assert.deepEqual(JSON.parse(JSON.stringify(api.validateJsonComplexity({ settings: {}, transactions: [{ id: 't1' }] }))), { settings: {}, transactions: [{ id: 't1' }] });
  let deep = null;
  for (let i = 0; i < 102; i++) deep = [deep];
  assert.throws(() => api.validateJsonComplexity(deep), /معتبر نیست/);
});

test('backup JSON complexity validator rejects excessive node counts without unbounded queue growth', () => {
  const api = loadApi();
  assert.throws(() => api.validateJsonComplexity(new Array(1000001).fill(0)), /معتبر نیست/);
});
