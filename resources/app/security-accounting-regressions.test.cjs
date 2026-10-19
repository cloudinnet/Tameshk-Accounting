'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const ledger = fs.readFileSync(path.join(__dirname, 'inventory-ledger.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, 'template-manager.js'), 'utf8');
const financial = fs.readFileSync(path.join(__dirname, 'financial-modules.js'), 'utf8');

test('transaction IDs are encoded as a JavaScript string and HTML-escaped before inline use', () => {
  assert.match(app, /function inlineArg\(value\)/);
  assert.match(app, /showInvoice\(\$\{inlineArg\(t\.id\)\},true\)/);
  assert.doesNotMatch(app, /showInvoice\('\$\{t\.id\}',true\)/);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ctx = {esc, JSON, String}; vm.createContext(ctx);
  const fnText = app.match(/function inlineArg\(value\)\{[^\n]+\}/)[0];
  vm.runInContext(fnText, ctx);
  const malicious = `x');alert(1);//\"<button>`;
  const output = ctx.inlineArg(malicious);
  assert.doesNotMatch(output, /<button>/i);
  assert.match(output, /&quot;/);
});

test('failed durable save returns false and surfaces an explicit storage failure', () => {
  assert.match(app, /window\.__tameshkLastSaveSucceeded=false/);
  assert.match(app, /state=latest;window\.TameshkStateMerge\?\.reset\(state\)/);
  assert.match(app, /تغییرها هنوز به‌صورت پایدار ثبت نشده‌اند/);
});

test('inventory cost updates use the live merged state after the central save replaces it', () => {
  assert.match(ledger, /s = getState\(\);\s*const added = \(s\?\.transactions/);
  assert.match(ledger, /root\.__tameshkLastSaveSucceeded === false/);
});

test('invoice seller details are applied to the current merged transaction, not a stale reference', () => {
  assert.match(template, /const current=state\.transactions\.find\(x=>x\.id===id\);if\(!current\)return;current\.sellerDetails=details;if\(save\(\)\)window\.showInvoice/);
});

test('charity amount cannot be edited below already recorded returns', () => {
  assert.match(financial, /مبلغ کمک را نمی‌توان از مجموع مرجوعی ثبت‌شده کمتر کرد/);
});
