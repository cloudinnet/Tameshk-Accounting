const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'transaction-form-layout.js'), 'utf8');
const start = source.indexOf('function moneyTotals(');
const end = source.indexOf('\nfunction currentRows()', start);
assert.ok(start >= 0 && end > start, 'production moneyTotals implementation is present');
const functionSource = source.slice(start, end);
const roundingSource = source.match(/^const monetaryRound=.*;$/m)?.[0];
assert.ok(roundingSource, 'production monetaryRound helper is present');
const currencySource = fs.readFileSync(path.join(__dirname, 'currency-locale-1.50.4.js'), 'utf8');
function createSandbox(currencyDecimals = 0) {
  const root = { state: { settings: { language: 'fa', currency: 'IRT', currencyDecimals } } };
  const context = { root, window: root, n: x => Number.isFinite(Number(x)) ? Number(x) : 0 };
  vm.createContext(context);
  vm.runInContext(currencySource, context);
  vm.runInContext(`${roundingSource}\n${functionSource}; this.moneyTotals = moneyTotals; this.linkedDiscountTotal = linkedDiscountTotal; this.itemTaxPreviewAmount = itemTaxPreviewAmount; this.ancillaryShortfall = ancillaryShortfall; this.displayedAncillaryShortfall = displayedAncillaryShortfall;`, context);
  return context;
}
const sandbox = createSandbox();

const totals = (discount, ancillary = 120) => sandbox.moneyTotals([
  { qty: 1, price: 1000, lineDiscount: 50, taxOn: true, taxPercent: 10 },
], discount, ancillary);

test('final discount cannot be below total item discounts; invoice discount does not change item tax', () => {
  const min = totals(10);
  assert.equal(min.discount, 50);
  assert.equal(min.taxable, 950);
  assert.equal(min.tax, 95);
  const more = totals(100);
  assert.equal(more.discount, 100);
  assert.equal(more.tax, 95);
  assert.equal(more.total, 1115);
});

test('single taxed item keeps its tax label amount when final discount consumes the item total', () => {
  const one = sandbox.moneyTotals([
    { qty: 1, price: 100, lineDiscount: 0, taxOn: true, taxPercent: 10 },
  ], 100, 0);
  assert.equal(one.tax, 10);
  assert.equal(one.taxLines[0].amount, 10);
  assert.equal(sandbox.itemTaxPreviewAmount(one, 0), 10);
  const two = sandbox.moneyTotals([
    { qty: 1, price: 100, lineDiscount: 0, taxOn: true, taxPercent: 10 },
    { qty: 1, price: 100, lineDiscount: 0, taxOn: true, taxPercent: 10 },
  ], 100, 0);
  assert.equal(sandbox.itemTaxPreviewAmount(two, 0), 10);
  assert.equal(sandbox.itemTaxPreviewAmount(two, 1), 10);
});

test('final total can be zero or negative after ancillary charges and full discount', () => {
  assert.equal(totals(1215).total, 0);
  assert.equal(totals(1235).total, -20);
});

test('uncovered ancillary amount is reported only when it exceeds the final total', () => {
  assert.equal(sandbox.ancillaryShortfall(120, 0), 120);
  assert.equal(sandbox.ancillaryShortfall(500, 308), 192);
  assert.equal(sandbox.ancillaryShortfall(120, 250), 0);
});

test('ancillary changes recalculate final total and refresh the shortfall display', () => {
  const items = [{ qty: 1, price: 1000, lineDiscount: 0, taxOn: false }];
  const before = sandbox.moneyTotals(items, 900, 100);
  const after = sandbox.moneyTotals(items, 900, 350);
  assert.equal(before.total, 200);
  assert.equal(after.total, 450);
  assert.notEqual(after.total, before.total);
  // The final input is inactive while an ancillary field is edited, so the
  // shortfall must use the newly recalculated final total, not stale text.
  assert.equal(sandbox.displayedAncillaryShortfall(after.ancillaryTotal, String(before.total), after.total, false), 0);
  // When the final field itself is active, its entered target remains the
  // shortfall reference used by the existing final-total editing behavior.
  assert.equal(sandbox.displayedAncillaryShortfall(after.ancillaryTotal, '100', after.total, true), 250);
  assert.match(source, /cost\.addEventListener\('input',\(\)=>\{syncAncillaryTaxFields\('transaction','cost'\);recalcAfterTransactionAncillaryChange\(\)\}\)/);
  assert.match(source, /d\.activeElement!==final\|\|transactionAncillaryRefresh/);
  assert.match(source, /id="txAncillaryLine"><span>\$\{esc\(tr\('هزینه‌ها و مالیات جانبی'/);
  assert.doesNotMatch(source, /txAncillaryTaxLine/);
  assert.match(source, /val\('txAncillaryValue',x\.ancillaryTotal\)/);
});

test('transaction totals include separately calculated ancillary tax', () => {
  const result = sandbox.moneyTotals([{ qty: 1, price: 1000, lineDiscount: 0, taxOn: false }], 0, 150, true, 10, 15);
  assert.equal(result.ancillaryCost, 150);
  assert.equal(result.ancillaryTax, 15);
  assert.equal(result.ancillaryTotal, 165);
  assert.equal(result.total, 1165);
});

test('item and ancillary taxes use configured currency precision without changing legacy zero-decimal totals', () => {
  const items = [{ qty: 1, price: 10.05, lineDiscount: 0, taxOn: true, taxPercent: 10 }];
  const legacy = sandbox.moneyTotals(items, 0, 10.05, true, 10);
  assert.equal(legacy.tax, 1);
  assert.equal(legacy.ancillaryTax, 1);
  const precise = createSandbox(2).moneyTotals(items, 0, 10.05, true, 10);
  assert.equal(precise.tax, 1.01);
  assert.equal(precise.taxLines[0].amount, 1.01);
  assert.equal(precise.ancillaryTax, 1.01);
  assert.ok(Math.abs(precise.total - 22.12) < 1e-10);
});

test('financial reports exclude pass-through ancillary totals without losing refunds or finance income',()=>{
  assert.match(source,/transactionsRevenue-n\(data\?\.transactionRefunds\)\+n\(data\?\.financeRevenue\)/);
});

test('changing item discounts both upward and downward immediately recomputes the invoice discount',()=>{
  const lineDiscounts=[200,300,100,350,0];
  assert.deepEqual(lineDiscounts.map(x=>sandbox.linkedDiscountTotal(x,0)),[200,300,100,350,0]);
  assert.equal(sandbox.linkedDiscountTotal(100,250),350,'manual invoice-only extra discount is preserved');
  assert.match(source,/function lineDiscountTotal\(\).*?function bindLineDiscountRecalculation/s);
  assert.match(source,/manualInvoiceDiscountExtra=Math\.max\(0,n\(e\.target\.value\)-lineDiscountTotal\(\)\)/);
  assert.match(source,/field\.value=linkedDiscountTotal\(total,manualInvoiceDiscountExtra\)/);
  assert.match(source,/val\('txLineDiscountValue',x\.lineDiscount\)/);
});

test('date/time controls stack within narrow form fields and reserve room for spinner digits',()=>{
  assert.match(source,/\.invoice-date-time\{grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(source,/\.time-spin-column\{min-width:46px\}/);
  assert.match(source,/\.time-spin-value\{width:44px;min-width:44px/);
});

test('invoice editor contains intrinsic table overflow without changing preview or print columns',()=>{
  assert.match(source, /if\(editableInvoice\(\)&&!table\.parentElement\.classList\.contains\('invoice-edit-table-scroll'\)\)/);
  assert.match(source, /scroll\.tabIndex=0/);
  assert.match(source, /scroll\.setAttribute\('role','region'\)/);
  assert.match(source, /@media screen\{\.invoice-edit-table-scroll\{width:100%;min-width:0;max-width:100%;overflow-x:auto\}\}/);
});

test('form grids and controls reflow below tablet widths instead of overlapping adjacent fields',()=>{
  assert.match(source,/const responsiveFormStyle=d\.createElement\('style'\)/);
  assert.match(source,/@media\(max-width:1020px\)[\s\S]*?\.form-grid>\*\{min-width:0;max-width:100%\}/);
  assert.match(source,/@media\(max-width:720px\)[\s\S]*?\.form-grid,\.settings-grid,\.cards-2\{grid-template-columns:minmax\(0,1fr\)!important\}/);
  assert.match(source,/\.field input,\.field select,\.field textarea\{width:100%;max-width:100%;min-width:0\}/);
});

// Opt-in actual-browser regression: CHROMIUM_BIN=/usr/bin/chromium
// NARROW_LAYOUT_HARNESS=/absolute/path/to/visual/isolated-app.html node --test this-file
// Uses the existing isolated fixture, never the user's live storage.
test('actual Chromium viewport contains editor overflow and preserves preview, print and totals', {
  skip: !process.env.NARROW_LAYOUT_HARNESS,
  timeout: 90000,
}, async () => {
  const { spawn } = require('node:child_process');
  const { mkdtempSync, rmSync } = fs;
  const { tmpdir } = require('node:os');
  const { pathToFileURL } = require('node:url');
  const profile = mkdtempSync(path.join(tmpdir(), 'invoice-narrow-test-'));
  const browser = spawn(process.env.CHROMIUM_BIN || 'chromium', [
    '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ]);
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let log = '';
      const timer = setTimeout(() => reject(Error('Chromium debugger startup timed out')), 15000);
      browser.once('error', error => { clearTimeout(timer); reject(error); });
      browser.stderr.on('data', chunk => {
        log += chunk;
        const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let seq = 0;
    const pending = new Map();
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      const task = pending.get(message.id);
      if (task) { pending.delete(message.id); message.error ? task.reject(Error(JSON.stringify(message.error))) : task.resolve(message.result); }
    };
    const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => call(method, params, sessionId);
    const evaluate = async expression => {
      const response = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
      return response.result.value;
    };
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    await page('Page.navigate', { url: pathToFileURL(process.env.NARROW_LAYOUT_HARNESS).href });
    for (let tries = 0; tries < 200; tries++) {
      if (await evaluate("document.readyState==='complete'&&typeof showInvoice==='function'&&!!window.TameshkTransactionFormLayout")) break;
      await pause(200);
    }
    assert.equal(await evaluate("typeof showInvoice==='function'"), true);
    const snapshot = () => evaluate('JSON.stringify(state.transactions)');
    const before = await snapshot();
    await evaluate("showInvoice('qa-visual',true)");
    await pause(300);
    // Record wide geometry without the scroll wrapper, then restore it. This
    // directly checks that containment is neutral at desktop width.
    await page('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1050, deviceScaleFactor: 1, mobile: false });
    const wide = await evaluate(`(()=>{const wrap=document.querySelector('.invoice-edit-table-scroll'),table=wrap.querySelector('table');const width=table.getBoundingClientRect().width;wrap.before(table);const original=table.getBoundingClientRect().width;wrap.appendChild(table);return {width,original}})()`);
    assert.ok(Math.abs(wide.width-wide.original)<1, JSON.stringify(wide));
    const metrics = [];
    for (const width of [1280, 1024, 900, 760, 640, 560, 480, 360, 480, 760, 1280]) {
      await page('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
      await pause(100);
      const result = await evaluate(`(()=>{const wrap=document.querySelector('.invoice-edit-table-scroll'),paper=document.querySelector('.invoice-paper'),r=wrap.getBoundingClientRect(),p=paper.getBoundingClientRect();const clipped=[...document.querySelectorAll('#modalInner input,#modalInner select,#modalInner textarea,#modalInner button')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&b.height&&!e.closest('.invoice-edit-table-scroll')&&(b.left< -1||b.right>innerWidth+1)}).map(e=>e.id||e.className);return {width:innerWidth,client:document.documentElement.clientWidth,body:document.body.scrollWidth,wrap:{left:r.left,right:r.right,client:wrap.clientWidth,scroll:wrap.scrollWidth},paper:{left:p.left,right:p.right},clipped,documentOverflow:[...document.querySelectorAll('body *')].filter(e=>!e.closest('.invoice-edit-table-scroll')).map(e=>({element:e.id||e.className||e.tagName,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+1||e.left< -1).slice(0,12),errors:__qaErrors}})()`);
      assert.equal(result.width, width, 'measures top-level viewport, not iframe');
      assert.ok(result.wrap.left>=-1 && result.wrap.right<=width+1, JSON.stringify(result));
      // The unrelated dashboard/header behind the modal already overflows at
      // 360px. Still require editor containment there; do not hide that overflow.
      if (width>=480) assert.ok(result.body<=width+1, JSON.stringify(result));
      assert.deepEqual(result.clipped, [], JSON.stringify(result));
      assert.deepEqual(result.errors, []);
      metrics.push({width:result.width,body:result.body,tableViewport:result.wrap.client,tableContent:result.wrap.scroll,clipped:result.clipped.length});
    }
    await page('Emulation.setDeviceMetricsOverride', { width: 480, height: 1050, deviceScaleFactor: 1, mobile: false });
    const baseline = await evaluate(`(()=>{const wrap=document.querySelector('.invoice-edit-table-scroll'),table=wrap.querySelector('table'),paper=document.querySelector('.invoice-paper');wrap.before(table);const r=table.getBoundingClientRect(),p=paper.getBoundingClientRect(),input=table.querySelector('.invoice-include-image').getBoundingClientRect();const result={tableLeft:r.left,paperLeft:p.left,tableWidth:r.width,paperWidth:p.width,imageLeft:input.left};wrap.appendChild(table);return result})()`);
    assert.ok(baseline.tableLeft<baseline.paperLeft-1 && baseline.tableWidth>baseline.paperWidth, 'uncontained original editor reproduces overflow');
    assert.ok(baseline.imageLeft<0, JSON.stringify(baseline));
    console.log('480px original uncontained editor:', JSON.stringify(baseline));
    const reachable = await evaluate(`(()=>{const wrap=document.querySelector('.invoice-edit-table-scroll');wrap.scrollLeft=-wrap.scrollWidth;const box=wrap.getBoundingClientRect(),input=wrap.querySelector('.invoice-include-image'),r=input.getBoundingClientRect();input.focus();return {visible:r.left>=box.left-1&&r.right<=box.right+1,focused:document.activeElement===input,scroll:wrap.scrollWidth>wrap.clientWidth}})()`);
    assert.equal(reachable.scroll, true);
    assert.equal(reachable.visible, true, JSON.stringify(reachable));
    assert.equal(reachable.focused, true);
    await page('Emulation.setEmulatedMedia', { media: 'print' });
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.invoice-edit-table-scroll')).overflowX"), 'visible');
    await page('Emulation.setEmulatedMedia', { media: 'screen' });
    assert.equal(await snapshot(), before, 'resize/focus never changes accounting or saved items');
    await evaluate("closeModal();showInvoice('qa-visual',false)");
    assert.equal(await evaluate("document.querySelectorAll('.invoice-edit-table-scroll').length"), 0, 'preview is not wrapped');
    await evaluate("closeModal();document.querySelector('#nav [data-page=\"new\"]').click()");
    for (const width of [1280, 760, 480, 360, 1280]) {
      await page('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
      await pause(100);
      const form = await evaluate(`({width:innerWidth,body:document.body.scrollWidth,rows:document.querySelectorAll('#items .item-row').length,errors:__qaErrors})`);
      assert.ok(form.rows>0, 'transaction form rendered');
      if (width>=480) assert.ok(form.body<=width+1, JSON.stringify(form));
      assert.deepEqual(form.errors, []);
    }
    console.log('Actual Chromium invoice metrics:', JSON.stringify(metrics));
  } finally {
    socket?.close();
    browser.kill('SIGTERM');
    await new Promise(resolve => { if (browser.exitCode!==null) resolve(); else { browser.once('exit', resolve); setTimeout(resolve, 3000); } });
    rmSync(profile, { recursive: true, force: true });
  }
});
