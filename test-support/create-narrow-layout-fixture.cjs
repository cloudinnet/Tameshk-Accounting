'use strict';
// Generate a disposable, top-level file:// application fixture from current assets.
// node test-support/create-narrow-layout-fixture.cjs /tmp/tameshk-narrow-fixture
// CHROMIUM_BIN=/usr/bin/chromium NARROW_LAYOUT_HARNESS=/tmp/tameshk-narrow-fixture/isolated-app.html node --test resources/app/transaction-form-layout.test.js
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const source = path.resolve(__dirname, '../resources/app');
const destination = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'tameshk-narrow-fixture-'));
if (destination === source || destination.startsWith(source + path.sep)) throw Error('Fixture output must be outside production resources/app');
fs.mkdirSync(destination, { recursive: true });
fs.cpSync(source, destination, { recursive: true });
const seed = {
  settings: { language: 'fa', currency: 'IRT', currencyDecimals: 0, business: 'آزمون مستقل چیدمان', invoiceTemplate: 'classic', invoicePrintMarginMigration: '1.5.22' },
  categories: ['کالا'], products: [], expenses: [], quickCatalog: [],
  transactions: [{
    id: 'qa-visual', no: 'QA-1504', date: '2026-10-11', createdAt: '2026-10-11T10:00:00Z',
    customer: 'مشتری آزمون', phone: '09123456789', address: 'نشانی آزمون', note: 'یادداشت آزمون بدون تغییر سوابق',
    discount: 125, taxOn: true, taxPercent: 9,
    items: [{ name: 'کالای آزمایشی', unit: 'عدد', qty: 2, price: 125000, lineDiscount: 0,
      imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1cAAAAASUVORK5CYII=', includeImage: true }],
  }],
};
const bootstrap = `<script>
// Test-only isolation: never read, clear, or write the browser's real storage.
window.__qaErrors = [];
addEventListener('error', event => { if (event.error) __qaErrors.push(String(event.error.stack || event.error)); });
addEventListener('unhandledrejection', event => __qaErrors.push(String(event.reason?.stack || event.reason)));
class QaMemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(String(key)) ?? null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
  clear() { this.values.clear(); }
}
Object.defineProperty(window, 'localStorage', { value: new QaMemoryStorage() });
Object.defineProperty(window, 'sessionStorage', { value: new QaMemoryStorage() });
localStorage.setItem('tameshk-state', ${JSON.stringify(JSON.stringify(seed))});
addEventListener('DOMContentLoaded', () => document.getElementById('profileOverlay')?.remove());
</script>`;
const index = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
if (!/<head(?:\s[^>]*)?>/i.test(index)) throw Error('Current index has no head element');
fs.writeFileSync(path.join(destination, 'isolated-app.html'), index.replace(/<head(?:\s[^>]*)?>/i, match => match + bootstrap));
console.log(path.join(destination, 'isolated-app.html'));
