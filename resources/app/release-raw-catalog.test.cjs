'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appDir = __dirname;

test('release UI describes user data, not bundled demo data, in all three languages', () => {
  const localization = fs.readFileSync(path.join(appDir, 'localization.js'), 'utf8');
  assert.ok(localization.includes("اطلاعات کسب‌وکار شما روی همین دستگاه ذخیره می‌شود؛ به‌طور منظم فایل پشتیبان بگیرید"));
  assert.match(localization, /Your business data is stored on this device\. Back up regularly\./);
  assert.match(localization, /تُحفظ بيانات نشاطك على هذا الجهاز؛ أنشئ نسخاً احتياطية بانتظام/);
  assert.match(localization, /پاک‌سازی همهٔ اطلاعات.*Clear all data.*مسح جميع البيانات/);
  assert.doesNotMatch(localization, /A copy of this demo data is stored in the browser|Reset demo data|بازنشانی داده‌های نمونه/);
});

test('CSV templates are headers only and do not seed example products or services', () => {
  const source = fs.readFileSync(path.join(appDir, 'tabular-locale-1.50.4.js'), 'utf8');
  const window = { state: { settings: { language: 'en' } }, document: { documentElement: { lang: 'en' } } };
  vm.runInNewContext(source, { window, console });
  for (const lang of ['fa', 'en', 'ar']) {
    const rows = window.TameshkTabular.rateRows(lang);
    assert.equal(rows.length, 1, `${lang} must contain only a header row`);
  }
  const bulk = fs.readFileSync(path.join(appDir, 'bulk-price-import.js'), 'utf8');
  assert.match(bulk, /function buildPlan\(/);
  assert.ok(bulk.includes('برای ساخت مورد جدید، دسته‌بندی لازم است'));
  assert.doesNotMatch(bulk, /category\s*\|\|\s*['"]سایر['"]/);
});
