'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('fresh release starts with empty business catalogs and no demo records', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const match = html.match(/const defaultState=(\{[^\n]+\});\nfunction loadSavedState\(/);
  assert.ok(match, 'fresh default state declaration must be found');
  const defaults = vm.runInNewContext(`(${match[1]})`);
  assert.deepEqual(Array.from(defaults.products), []);
  assert.deepEqual(Array.from(defaults.services), []);
  assert.deepEqual(Array.from(defaults.quickCatalog), []);
  assert.deepEqual(Array.from(defaults.transactionReturns), []);
  assert.deepEqual(Array.from(defaults.expenseReturns), []);
  assert.deepEqual(Array.from(defaults.consolidatedInvoices), []);
  assert.deepEqual(Array.from(defaults.transactions), []);
  assert.deepEqual(Array.from(defaults.expenses), []);
  assert.deepEqual(Array.from(defaults.categories), []);
  assert.equal(defaults.settings.business, '');
  assert.equal(defaults.settings.invoiceNote, '');
  assert.equal(defaults.settings.taxDefault, false);
  assert.equal(Array.from(defaults.categories).includes('خدمات کافی‌نت'), false);
  assert.equal(defaults.products.some(p => ['کاغذ A4', 'خودکار آبی', 'بسته دستمال کاغذی'].includes(p.name)), false);
});
