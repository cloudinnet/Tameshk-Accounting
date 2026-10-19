'use strict';
// Browser-native DOM regression. Uses the installed system Chromium through the
// Playwright runtime bundled with the Python Playwright package; no linkedom/npm
// dependency is needed. Browser pages use setContent to respect this runner's
// managed URL-navigation restrictions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const source = fs.readFileSync(path.join(__dirname, 'transaction-form-layout.js'), 'utf8');
const start = source.indexOf('function applyInvoiceTotals(');
const end = source.indexOf('\nfunction updateEditedTaxPreview(', start);
assert.ok(start >= 0 && end > start, 'invoice totals implementation is present');
let browser;
test.before(async () => { browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); });
test.after(async () => { await browser?.close(); });

async function boot(language, markup, editable = false) {
  const page = await browser.newPage();
  await page.setContent(`<html><body>${editable ? '<input id="invoiceNumber" value="1">' : ''}<section class="invoice-paper"><div class="totals">${markup}</div></section></body></html>`);
  await page.evaluate(({ code, language, editable }) => {
    window.d = document;
    window.root = window;
    window.n = Number;
    window.calcSaved = () => ({ lineDiscount: 0, tax: 0, ancillaryTotal: 0, total: 9.5 });
    window.editableInvoice = () => editable;
    window.tr = (fa, en, ar) => language === 'ar' ? ar : language === 'en' ? en : fa;
    window.esc = String;
    window.money = String;
    window.currencyAmount = (x, record) => `${x} ${record.currency === 'USD' ? '$' : ''}`.trim();
    window.monetaryRound = x => x;
    window.updateEditedTaxPreview = () => {};
    window.setTimeout = () => 0;
    (0, eval)(code);
  }, { code: source.slice(start, end), language, editable });
  return {
    page,
    close: () => page.close(),
    render: () => page.evaluate(() => window.applyInvoiceTotals({ currency: 'USD', currencyDecimals: 2, discount: 0.5, items: [] }, document.querySelector('.invoice-paper'))),
    html: () => page.content(),
    eval: (fn, arg) => page.evaluate(fn, arg),
  };
}

const final = '<div class="total-line final"><span>Total</span><b>9.5</b></div>';
for (const [language, label] of [['fa', 'تخفیف'], ['en', 'Discount'], ['ar', 'الخصم']]) test(`existing ${language} discount row is reused without invoice crash`, async () => {
  const app = await boot(language, `<div class="total-line original"><span>${label}</span><b>0.5</b></div>${final}`);
  try {
    await assert.doesNotReject(app.render); await assert.doesNotReject(app.render);
    const result = await app.eval(() => ({ same: document.querySelector('.tx-invoice-discount-row') === document.querySelector('.original'), count: document.querySelectorAll('.tx-invoice-discount-row').length, label: document.querySelector('.original span')?.textContent, amount: document.querySelector('.original b')?.textContent }));
    assert.equal(result.same, true); assert.equal(result.count, 1); assert.ok(result.label); assert.equal(result.amount, '0.5 $');
  } finally { await app.close(); }
});
for (const withFinal of [true, false]) test(`missing discount row initializes children and inserts into totals (final=${withFinal})`, async () => {
  const app = await boot('ar', withFinal ? final : '');
  try {
    await assert.doesNotReject(app.render); await assert.doesNotReject(app.render);
    const result = await app.eval(() => { const row = document.querySelector('.tx-invoice-discount-row'); return { exists: !!row, parent: row?.parentNode === document.querySelector('.totals'), label: row?.querySelector('span')?.textContent, bold: !!row?.querySelector('b'), count: document.querySelectorAll('.tx-invoice-discount-row').length, index: [...document.querySelector('.totals').children].indexOf(row), finalIndex: [...document.querySelector('.totals').children].indexOf(document.querySelector('.final')) }; });
    assert.equal(result.exists, true); assert.equal(result.parent, true); assert.equal(result.label, 'الخصم النهائي للفاتورة'); assert.equal(result.bold, true); assert.equal(result.count, 1);
    if (withFinal) assert.ok(result.index < result.finalIndex);
  } finally { await app.close(); }
});
for (const language of ['fa', 'en', 'ar']) test(`repeated ${language} editable renders preserve the same discount input after span becomes label`, async () => {
  const app = await boot(language, `<div class="total-line"><span>${language === 'ar' ? 'الخصم' : 'Discount'}</span><b><input id="invoiceDiscount" value="0.1234"></b></div>${final}`, true);
  try {
    const before = await app.eval(() => { const input = document.getElementById('invoiceDiscount'); input.dataset.marker = 'preserved'; return input; });
    for (let i = 0; i < 3; i++) await app.render();
    const result = await app.eval(() => { const input = document.getElementById('invoiceDiscount'), row = document.querySelector('.tx-invoice-discount-row'); return { value: input?.value, marker: input?.dataset.marker, rowCount: document.querySelectorAll('.tx-invoice-discount-row').length, labelFor: row?.querySelector('label')?.htmlFor, label: row?.querySelector('label')?.textContent, inputInRow: input?.parentNode === row, hasSpan: !!row?.querySelector('span') }; });
    assert.equal(result.value, '0.1234'); assert.equal(result.marker, 'preserved'); assert.equal(result.rowCount, 1); assert.equal(result.labelFor, 'invoiceDiscount'); assert.ok(result.label); assert.equal(result.inputInRow, true); assert.equal(result.hasSpan, false); assert.ok(before);
  } finally { await app.close(); }
});
