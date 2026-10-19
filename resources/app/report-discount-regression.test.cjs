'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'enhancements-146.js'), 'utf8');
const helper = source.match(/function reportDiscount\(t\)\{[^\n]*\}/)?.[0];
assert.ok(helper, 'reportDiscount helper must exist');
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const lineDiscountSum = t => (t?.items || t?.lines || []).reduce((sum, item) => sum + Math.max(0, n(item.lineDiscount)), 0);
const gross = t => (t?.items || t?.lines || []).reduce((sum, item) => sum + n(item.qty) * n(item.priceAtSale ?? item.price), 0);
const reportDiscount = vm.runInNewContext(`(${helper})`, { n, lineDiscountSum, gross, root: { taxTx: () => 0 } });

test('report uses canonical total when saved transaction total already includes line discount', () => {
  const t = { discount: 10, items: [{ name: 'Service', qty: 1, price: 100, lineDiscount: 10 }], exactTotals: { subtotal: 100, lineDiscount: 10, discount: 10, taxable: 90, tax: 0, total: 90 } };
  assert.equal(reportDiscount(t), 10);
});

test('report preserves additive line and invoice discounts for legacy records whose saved total proves both were applied', () => {
  const t = { discount: 10, items: [{ name: 'Service', qty: 1, price: 100, lineDiscount: 10 }], exactTotals: { subtotal: 100, lineDiscount: 10, discount: 10, taxable: 80, tax: 0, total: 80 } };
  assert.equal(reportDiscount(t), 20);
});

test('report falls back to additive discounts when a transaction has no reliable exact total', () => {
  const t = { discount: 10, items: [{ name: 'Service', qty: 1, price: 100, lineDiscount: 10 }] };
  assert.equal(reportDiscount(t), 20);
});

test('reportData aggregates each transaction through reportDiscount', () => {
  assert.match(source, /discount:tx\.reduce\(\(s,t\)=>s\+reportDiscount\(t\),0\)/);
});
