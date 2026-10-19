 'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const appDir = __dirname;
const read = name => fs.readFileSync(path.join(appDir, name), 'utf8');

test('service worker precaches all local scripts referenced by the app shell', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
  const cacheBody = sw.match(/const APP_FILES\s*=\s*\[(.*?)\];/s)?.[1] || '';
  const cached = new Set([...cacheBody.matchAll(/["']([^"']+)["']/g)].map(m => m[1]));
  const missing = scriptSrcs.filter(src => !/^https?:|^data:/i.test(src)).map(src => './' + src.replace(/^\.\//, '')).filter(src => !cached.has(src));
  assert.deepEqual(missing, []);
  assert.match(sw, /tameshk-accounting-offline-v41/);
});

test('failed central persistence restores the last durable state and sale does not continue', () => {
  const app = read('index.html');
  assert.match(app, /state=latest;window\.TameshkStateMerge\?\.reset\(state\)/);
  assert.match(app, /state\.transactions\.push\(t\);if\(!save\(\)\)return false;/);
});

test('blank or zero-quantity invoice rows do not enter tax calculations', () => {
  const enhancements = read('enhancements-146.js');
  assert.match(enhancements, /if\(!name\|\|qty<=0\)return;const lineGross=qty\*price/);
  assert.match(enhancements, /lineDiscount\+=Math\.min\(lineGross,Math\.max\(0,n\(r\.querySelector\('\.item-line-discount'\)\?\.value\)\)\)/);
});

test('invoice edits cannot reduce quantity below return records or legacy return ledger events', () => {
  const enhancements = read('enhancements-146.js');
  assert.match(enhancements, /returnedFromRecords=priorReturns\.filter/);
  assert.match(enhancements, /returnedFromLedger=ledgerEvents\.filter/);
  assert.match(enhancements, /x\.baseQty\+1e-8<Math\.max\(returnedFromRecords\+returnedFromLedger,returnedFromLots\)/);
});

test('net COGS includes sale edit adjustments with direction-aware signs', () => {
  const ledger = read('inventory-ledger.js');
  assert.match(ledger, /e\.type==='sale_edit_adjustment' \? \(e\.direction==='out'\?num\(e\.totalCost\):-num\(e\.totalCost\)\)/);
  assert.match(ledger, /e\.type==='sale_edit_adjustment'\),e=>e\.type==='sale'\|\|e\.type==='sale_edit_adjustment'&&e\.direction==='out'/);
});

test('editing a credit settlement preloads the existing payment method', () => {
  const finance = read('finance-accounting.js');
  assert.match(finance, /wrapModal\('tameshkFinanceSettle',function\(id\)\{addPaymentSelector\(\);const r=findRecord\('credit',id\),sel=D\.getElementById\('fin_payment_method'\);if\(sel&&r\)sel\.value=r\.paymentMethod\|\|''\}\)/);
});

test('expense with dependent returns cannot be deleted leaving orphaned adjustments', () => {
  const app = read('index.html');
  assert.match(app, /const linkedReturns=\(state\.expenseReturns\|\|\[\]\)\.filter/);
  assert.match(app, /این هزینه سابقهٔ مرجوعی دارد/);
});


test('stale invoice editor refuses to overwrite a record changed by another window', () => {
  const enhancements = read('enhancements-146.js');
  assert.match(enhancements, /root\.__tameshkInvoiceEditSnapshots\[String\(id\)\]=JSON\.stringify\(opening\)/);
  assert.match(enhancements, /if\(opened&&JSON\.stringify\(t\)!==opened\)/);
  assert.match(enhancements, /پنجرهٔ دیگری تغییر کرده است/);
});


test('detached profile contexts reload the active profile before accepting edits', () => {
  const profiles = read('inventory-profiles.js');
  assert.match(profiles, /event\.key!==CATALOG_KEY/);
  assert.match(profiles, /incoming\.activeId!==catalog\?\.activeId/);
  assert.match(profiles, /state=fresh&&Array\.isArray\(fresh\.products\)\?fresh/);
  assert.match(profiles, /root\.closeModal\?\.\(\);root\.render\?\.\(\)/);
});


test('return history preserves extra decimal precision present in a stored refund amount', () => {
  const returns = read('returns-management.js');
  assert.match(returns, /storedPlaces=Math\.max\(0,Math\.min\(8,/);
  assert.match(returns, /places=Math\.max\(cfg\.currencyDecimals,storedPlaces\)/);
  assert.match(returns, /minimumFractionDigits:places,maximumFractionDigits:places/);
});


test('transaction identifiers in invoice and return actions use JSON-encoded inline arguments', () => {
  const html = read('index.html');
  const enhancements = read('enhancements-146.js');
  const templates = read('template-manager.js');
  const returns = read('returns-management.js');
  assert.match(html, /window\.TameshkInlineArg=inlineArg/);
  assert.match(enhancements, /showInvoice\(\$\{jsArg\(t\.id\)\},true\)/);
  assert.match(templates, /showInvoice\(\$\{inlineArg\(t\.id\)\},true\)/);
  assert.match(returns, /tameshkReturnInvoiceLine\(\$\{inlineArg\(t\.id\)\},\$\{i\}\)/);
  assert.doesNotMatch(enhancements, /showInvoice\('\$\{esc\(t\.id\)\}'/);
  assert.doesNotMatch(templates, /showInvoice\('\$\{esc\(t\.id\)\}'/);
});
