'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appDir = __dirname;
const index = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
const localization = fs.readFileSync(path.join(appDir, 'localization.js'), 'utf8');
const templates = fs.readFileSync(path.join(appDir, 'template-manager.js'), 'utf8');

const formerBusinessTerms = /کافی[‌\s-]*نت|internet\s+caf[eé]|cyber\s*caf[eé]|مقهى\s+الإنترنت|مقهى\s+إنترنت|مقاهي\s+الإنترنت|سايبر|انترنت كافيه|إنترنت كافيه/i;

test('dashboard copy is business-neutral and translated for Persian, English, and Arabic', () => {
  assert.match(index, /نمایی روشن از دخل‌وخرج کسب‌وکار شما/);
  assert.match(localization, /'نمایی روشن از دخل‌وخرج کسب‌وکار شما':\['A clear view of your business income, expenses, and operations','نظرة واضحة على إيرادات أعمالك ومصروفاتها وعملياتها'\]/);
  assert.doesNotMatch(index, /نمایی روشن از دخل‌وخرج و کارهای کافی‌نت شما/);
  assert.doesNotMatch(localization, /نمایی روشن از دخل‌وخرج و کارهای کافی‌نت شما|A clear view of your café|نظرة واضحة على دخل المقهى/);
});

test('fresh release keeps business catalogs and invoice preview empty', () => {
  assert.match(index, /categories:\[\],products:\[\],services:\[\],quickCatalog:\[\],transactions:\[\],expenses:\[\]/);
  assert.match(index, /services:\[\],quickCatalog:\[\]/);
  assert.match(index, /transactionReturns:\[\],expenseReturns:\[\],consolidatedInvoices:\[\]/);
  assert.match(index, /business:'',taxDefault:false,taxPercent:10,invoiceNote:''/);
  assert.match(index, /function productModal\(id\)\{const p=state\.products\.find\(x=>x\.id===id\)\|\|\{name:'',category:''/);
  assert.match(templates, /function sampleTransaction/);
  assert.match(index, /نام کسب‌وکار \/ عنوان سربرگ/);
  assert.match(localization, /'خدمات عمومی':\['General services','خدمات عامة'\]/);
  assert.match(localization, /'نام کسب‌وکار \/ عنوان سربرگ':\['Business name \/ invoice header','اسم النشاط التجاري \/ عنوان الفاتورة'\]/);
  assert.match(localization, /'خدمت عمومی':\['General service','خدمة عامة'\]/);
  assert.match(templates, /items:\[\],discount:0,taxOn:false,taxPercent:0/);
  assert.doesNotMatch(templates, /text\('خدمت عمومی'\)|text\('چاپ و کپی'\)/);
  // Historical category labels are mentioned only by the one-time state migration in index.html.
  assert.doesNotMatch(localization, formerBusinessTerms, 'localization dictionary still includes café-specific captions');
  assert.doesNotMatch(templates, formerBusinessTerms, 'invoice preview still includes café-specific captions');
  assert.doesNotMatch(index, /نمایی روشن از دخل‌وخرج و کارهای کافی‌نت شما|نام کافی‌نت \/ عنوان سربرگ/);
});

test('legacy category migration updates category references without changing transaction content or amounts', () => {
  const match = index.match(/function migrateLegacyBusinessCategory\(data\)\{[\s\S]*?\n\}/);
  assert.ok(match, 'legacy category migration function exists');
  const migrate = require('node:vm').runInNewContext(`(${match[0]})`);
  const state = {
    categories: ['خدمات کافی‌نت', 'چاپ', 'خدمات عمومی'],
    products: [{ name: 'کالا', category: 'خدمات کافی‌نت', price: 120 }],
    expenses: [{ title: 'هزینه', category: 'خدمات کافی‌نت', amount: 350 }],
    quickCatalog: [{ name: 'خدمت', category: 'خدمات کافی‌نت' }],
    transactions: [{ items: [{ name: 'خدمت کافی‌نت (نام ثبت‌شده)', category: 'خدمات کافی‌نت', qty: 2, price: 100 }] }]
  };
  assert.equal(migrate(state), true);
  assert.deepEqual(Array.from(state.categories), ['خدمات عمومی', 'چاپ']);
  assert.equal(state.products[0].category, 'خدمات عمومی');
  assert.equal(state.expenses[0].category, 'خدمات عمومی');
  assert.equal(state.quickCatalog[0].category, 'خدمات عمومی');
  assert.equal(state.transactions[0].items[0].category, 'خدمات عمومی');
  assert.equal(state.transactions[0].items[0].name, 'خدمت کافی‌نت (نام ثبت‌شده)');
  assert.equal(state.transactions[0].items[0].qty, 2);
  assert.equal(state.transactions[0].items[0].price, 100);
  assert.equal(migrate(state), false, 'migration is idempotent');
});
