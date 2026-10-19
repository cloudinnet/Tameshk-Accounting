const test = require('node:test');
const assert = require('node:assert/strict');
const pagination = require('./table-pagination.js');

test('page sizes 5, 10 and 15 split rows into the expected pages', () => {
  for (const size of [5, 10, 15]) {
    const rows = Array.from({length: size * 2 + 1}, (_, i) => `row ${i + 1}`);
    const first = pagination.paginateItems(rows, size, 1);
    const second = pagination.paginateItems(rows, size, 2);
    const third = pagination.paginateItems(rows, size, 3);
    assert.equal(first.visible.length, size);
    assert.equal(second.visible.length, size);
    assert.deepEqual(third.visible, [`row ${size * 2 + 1}`]);
    assert.equal(third.pageCount, 3);
  }
});

test('page number window uses first/last pages near bounds and a centered window in the middle', () => {
  assert.deepEqual(pagination.pageWindow(1, 1), [1]);
  assert.deepEqual(pagination.pageWindow(5, 4), [1, 2, 3, 4, 5]);
  assert.deepEqual(pagination.pageWindow(226, 1), [1, 2, 3, '…', 225, 226]);
  assert.deepEqual(pagination.pageWindow(226, 5), [1, '…', 4, 5, 6, '…', 226]);
  assert.deepEqual(pagination.pageWindow(226, 226), [1, 2, 3, '…', 225, 226]);
});

test('invalid page numbers are clamped and filtered results are re-paginated', () => {
  const rows = Array.from({length: 40}, (_, i) => ({name: i % 2 ? `فروش ${i}` : `هزینه ${i}`}));
  const page = pagination.paginateItems(rows, 5, 9, 'فروش', row => row.name);
  assert.equal(page.filtered.length, 20);
  assert.equal(page.pageCount, 4);
  assert.equal(page.page, 4);
  assert.equal(page.visible.length, 5);
  assert.equal(pagination.paginateItems([], 10, 88).page, 1);
});

test('separate panels keep independent search and page state', () => {
  const store = pagination.createStateStore();
  const a = store.get('sales'); a.page = 3; a.query = 'ali';
  const b = store.get('expenses');
  assert.deepEqual(b, {page: 1, query: ''});
  assert.equal(store.get('sales'), a);
});

test('each requested history, financial, inventory and report family is explicitly assigned its page size', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
  const expected = {
    'index.html': ['transactions-main', 'aggregate-invoice-history', 'expense-list', 'products-inventory', 'price-change-history', 'price-period-sales', 'report-expenses'],
    'returns-management.js': ['sales-returns-pending', 'sales-returns-history', 'expense-returns-pending', 'expense-returns-history'],
    'financial-modules.js': ['finance-credit-', 'finance-installment-', 'finance-checks-', 'finance-entrust-', 'finance-charity'],
    'inventory-management.js': ['warehouse-product-records', 'warehouse-physical-returns', 'warehouses-list'],
    'inventory-profiles.js': ['inventory-lots', 'expiry-lots'],
    'inventory-ledger.js': ['weighted-inventory-value', 'inventory-ledger-events', 'price-period-sales-ledger']
  };
  for (const [file, keys] of Object.entries(expected)) {
    const text = source(file);
    for (const key of keys) assert.ok(text.includes(key), `${file} should mark ${key}`);
  }
  assert.match(source('assets-module.js'), /activeTab === 'franchise' \|\| activeTab === 'other' \? 15 : 10/);
  assert.match(source('inventory-profiles.js'), /expiry-lots" data-tp-size="15/);
  assert.match(source('index.html'), /report-expenses" data-tp-size="15/);
});

test('search normalization supports Persian/Arabic letter variants and digits', () => {
  assert.equal(pagination.normalize('كالا ۱۲۳'), pagination.normalize('کالا 123'));
  assert.equal(pagination.normalize('ي'), pagination.normalize('ی'));
});
