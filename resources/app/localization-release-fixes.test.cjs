'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const appDir = __dirname;

test('requested release localization keys include English and Arabic copy', () => {
  const source = fs.readFileSync(path.join(appDir, 'localization.js'), 'utf8');
  const required = [
    "'درآمد خالص منهای هزینه‌های ثبت‌شده':['Net income minus recorded expenses','صافي الدخل بعد خصم المصروفات المسجلة']",
    "'ویرایش و صدور فاکتور':['Edit and issue invoice','تحرير الفاتورة وإصدارها']",
    "'ذخیره تغییرات فاکتور':['Save invoice changes','حفظ تعديلات الفاتورة']",
    "'بازپرداخت واقعاً نقدی است؛ از کیف پول کسر شود':['The refund is paid in cash; deduct it from the wallet','تم دفع الاسترداد نقداً فعلياً؛ اخصمه من المحفظة']",
    "'دریافت الگو':['Download template','تنزيل القالب']",
    "'لوگوی پروفایل جداگانه ذخیره شد.':['Profile logo saved separately.','تم حفظ شعار الملف الشخصي بشكل منفصل.']",
    "'عنوان و مبلغ معتبر وارد کنید.':['Enter a valid title and amount.','أدخل عنواناً ومبلغاً صالحين.']",
    "'تراکنش ثبت شد.':['Transaction recorded.','تم تسجيل المعاملة.']"
  ];
  for (const entry of required) assert.ok(source.includes(entry), `missing localization entry: ${entry}`);
  assert.match(source, /html\[dir="ltr"\] \.toast\{left:auto;right:22px;direction:ltr;text-align:left\}/);
  assert.match(source, /html\[dir="rtl"\] \.toast\{left:22px;right:auto;direction:rtl;text-align:right\}/);
  assert.match(source, /titlebar\.textContent!==document\.title/);
});

test('English USD amounts put the dollar sign before the number without changing numeric values', () => {
  const source = fs.readFileSync(path.join(appDir, 'currency-locale-1.50.4.js'), 'utf8');
  const context = { state: { settings: { language: 'en', currency: 'USD', currencyDecimals: 2 } }, Intl, Math, Number, Object };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(context.TameshkCurrency.amount(12.345), '$12.35');
  assert.equal(context.TameshkCurrency.format(12.345), '12.35');
  context.state.settings.currency = 'IRT';
  assert.equal(context.TameshkCurrency.amount(12.345), '12.35 toman');
});
