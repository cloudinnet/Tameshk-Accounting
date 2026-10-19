const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

const layout = read('transaction-form-layout.js');
const appearance = read('record-appearance.js');
const enhancement = read('enhancements-146.js');
const bulk = read('bulk-price-import.js');
const invoice = read('transaction-invoice-output.js');
const appHtml = read('index.html');

test('transaction notes are part of the formatter and are included in the transaction style editor', () => {
  assert.match(appearance, /transactionNote:\['توضیحات تراکنش'/);
  assert.match(appearance, /'transactionNote','ancillaryCost'\]/);
  assert.match(appearance, /transactionNote:scope\.querySelectorAll\('#txnote'\)/);
  assert.match(appearance, /\['transactions','transactionNote','#txnote'\]/);
});

test('zero defaults are placeholders rather than stored editable values', () => {
  assert.match(layout, /id="invoiceDiscountValue"[^>]*placeholder="۰" value="\$\{[^}]*\|\|''\}"/);
  assert.match(layout, /id="txFinalTotal"[^>]*placeholder="۰" value=""/);
  assert.match(enhancement, /class="item-line-discount"[^>]*placeholder="۰" value="\$\{[^}]*\|\|''\}"/);
  assert.match(layout, /id="txAncillaryCost" type="number"[^>]*placeholder="۰"/);
  assert.doesNotMatch(layout, /id="txAncillaryCost"[^>]*value="0"/);
  assert.doesNotMatch(bulk, /id="(?:tx|invoice)AncillaryCost"/);
});


test('ancillary tax percentage and amount participate in transaction font formatting', () => {
  assert.match(layout, /#txAncillaryTaxPercent,#txAncillaryTaxAmount,#invoiceAncillaryTaxPercent,#invoiceAncillaryTaxAmount/);
  assert.match(layout, /installAncillaryTaxFormatterBridge/);
  assert.match(layout, /selector==='#txAncillaryCost,#invoiceAncillaryCost'/);
  assert.match(layout, /applyAncillaryTaxFieldStyle/);
});

test('ancillary cost is one editable field with placeholder-only zeroes and formatter support', () => {
  assert.match(layout, /id="txAncillaryCost"[^>]*placeholder="۰"/);
  assert.match(layout, /id="txAncillaryTaxPercent"[^>]*step="0\.0001" placeholder="۰"/);
  assert.match(layout, /id="txAncillaryTaxAmount"[^>]*placeholder="۰"/);
  assert.match(layout, /id="invoiceAncillaryCost"[^>]*value="\$\{base\|\|''\}"/);
  assert.match(layout, /id="invoiceAncillaryTaxPercent"[^>]*placeholder="۰"/);
  assert.match(layout, /id="invoiceAncillaryTaxAmount"[^>]*placeholder="۰"/);
  assert.match(appearance, /ancillaryCost:\['هزینه‌های جانبی'/);
  assert.match(appearance, /'transactionNote','ancillaryCost'/);
  assert.match(appearance, /ancillaryCost:styledTargets\(scope,'#txAncillaryCost,#invoiceAncillaryCost,#txAncillaryTaxPercent,#txAncillaryTaxAmount,#invoiceAncillaryTaxPercent,#invoiceAncillaryTaxAmount'\)/);
  assert.match(appearance, /\['transactions','ancillaryCost','#txAncillaryCost,#invoiceAncillaryCost,#txAncillaryTaxPercent,#txAncillaryTaxAmount,#invoiceAncillaryTaxPercent,#invoiceAncillaryTaxAmount'\]/);
});

test('tax synchronization keeps empty zero values as placeholders and recalculates manually entered tax percentages', () => {
  const start = layout.indexOf('function syncAncillaryTaxFields(');
  const end = layout.indexOf('function calcSaved(', start);
  assert.ok(start >= 0 && end > start);
  const fn = layout.slice(start, end).trim();
  const mk = (value='') => ({value, disabled:false, dataset:{}, closest:()=>({classList:{toggle(){}}})});
  const fields = {txAncillaryCost:mk(''),txAncillaryTaxOn:{checked:true},txAncillaryTaxPercent:mk(''),txAncillaryTaxAmount:mk('')};
  const sandbox = {d:{getElementById:id=>fields[id]||null},n:x=>Number(x)||0,root:{}};
  const sync = require('node:vm').runInNewContext(`${fn}; syncAncillaryTaxFields`, sandbox);
  sync('transaction','init');
  assert.equal(fields.txAncillaryTaxPercent.value,'');
  assert.equal(fields.txAncillaryTaxAmount.value,'');
  fields.txAncillaryCost.value='150';
  fields.txAncillaryTaxAmount.value='15';
  sync('transaction','amount');
  assert.equal(fields.txAncillaryTaxPercent.value,'10');
});

test('the transaction form has a combined ancillary total and red, unlabelled shortfall display', () => {
  assert.match(layout, /id="txAncillaryLine"><span>\$\{esc\(tr\('هزینه‌ها و مالیات جانبی'/);
  assert.doesNotMatch(layout, /txAncillaryTaxLine/);
  assert.match(layout, /id="txAncillaryShortfall" class="tx-ancillary-shortfall"/);
  assert.match(layout, /shortfall\.textContent=uncovered>0\?`-\$\{money\(uncovered\)\}`:''/);
  assert.match(layout, /\.tx-ancillary-shortfall[^}]*color:#ef4444/);
});

test('invoice has an independent print toggle and keeps ancillary amount positive when highlighted', () => {
  assert.match(invoice, /id="invoiceShowAncillaryShortfall"/);
  assert.match(invoice, /applyAncillaryShortfall\(current,currentPaper,shortbox\.checked\)/);
  assert.match(invoice, /row\.style\.setProperty\('color','#ef4444','important'\)/);
  assert.match(invoice, /value\.textContent=currencyAmount\(ancillary,t\)/);
  assert.doesNotMatch(invoice, /value\.textContent=show\?`−/);

  const applied = {};
  const label = { textContent: '' };
  const value = { textContent: '' };
  const row = { hidden: true, style: { setProperty: (k,v) => applied[k]=v, removeProperty: k => delete applied[k] }, querySelector: sel => sel === '.tm-label' ? label : value };
  const paper = { querySelector: () => row };
  const doc = { head: { appendChild(){} }, createElement: () => ({}), getElementById: id => id === 'invoiceAncillaryCost' ? {value:'500'} : id === 'invoiceAncillaryTaxOn' ? {checked:true} : id === 'invoiceAncillaryTaxAmount' ? {value:'15'} : id === 'invoiceFinalTotal' ? {value:'308'} : null };
  const root = { document: doc, money: x => String(x), TameshkTransactionFormLayout: { calcSaved: () => ({ancillaryCost:500,total:308}), ancillaryShortfall: (a,f) => Math.max(0,a-f) } };
  vm.runInNewContext(invoice, { window: root, document: doc, state: {settings:{language:'fa'}} });
  root.TameshkInvoiceOutput.applyAncillaryShortfall({ancillaryCost:500}, paper, true);
  assert.equal(value.textContent, '515 تومان');
  assert.equal(label.textContent, 'هزینه‌ها و مالیات جانبی');
  assert.equal(applied.color, '#ef4444');
  for (const symbol of ['تومان', 'ريال', '$']) {
    let received,receivedRecord;
    const record={ancillaryCost:500,currency:symbol==='$'?'USD':symbol==='ريال'?'SAR':'IRT',currencyDecimals:2};
    root.TameshkCurrency = { amount: (amount,context) => { received = amount;receivedRecord=context; return amount.toFixed(2) + ' ' + symbol; } };
    root.TameshkInvoiceOutput.applyAncillaryShortfall(record, paper, true);
    assert.equal(receivedRecord,record,'saved record context is forwarded rather than using current settings');
    assert.equal(received, 515, 'the positive charge, not the uncovered difference, is formatted');
    assert.equal(value.textContent, '515.00 ' + symbol, 'configured currency and precision are respected');
    assert.equal(applied.color, '#ef4444', 'highlighting remains independently enabled');
  }
  assert.doesNotMatch(invoice, /line\('ancillaryTax'/);
  assert.equal(row.hidden, false);
});

test('open popups have an explicit wheel-to-modal scroll path', () => {
  assert.match(appHtml, /max-height:calc\(100dvh - 24px\);min-height:0;overflow-x:hidden;overflow-y:auto/);
  assert.match(appHtml, /document\.addEventListener\('wheel',[\s\S]*?inner\.scrollTop=[\s\S]*?\{capture:true,passive:false\}\)/);
  assert.match(appHtml, /inner\.scrollTop=0;inner\.scrollLeft=0/);
  assert.doesNotMatch(enhancement, /max-height:none;overflow:visible/);
  assert.match(enhancement, /max-height:calc\(100dvh - 24px\);overflow-y:auto/);
});

test('item-discount summary is replaced with a textless spacer', () => {
  assert.match(invoice, /tx-invoice-line-discount-spacer/);
  assert.match(invoice, /spacerLabel\.textContent='';if\(spacerValue\)spacerValue\.textContent=''/);
  assert.doesNotMatch(invoice, /tr\('تخفیف ردیف‌ها','Item discounts','خصومات البنود'\)/);
});

test('each transaction row owns a unique product/service datalist and clearing it resets selection state',()=>{
  assert.match(appHtml,/catalogId='catalog-'\+id/);
  assert.match(appHtml,/list="\$\{catalogId\}"[^>]*autocomplete="off"[^>]*onfocus="refreshItemCatalog\(this\)"[^>]*oninput="syncItem\(this\);if\(!this\.value\)refreshItemCatalog\(this\)" onchange="syncItem\(this\)"><datalist id="\$\{catalogId\}"/);
  assert.match(appHtml,/row\.dataset\.productId='';row\.dataset\.catalogType=name\?'custom':'';row\.dataset\.serviceId='';row\.dataset\.unit='';row\.dataset\.factor='1'/);
  assert.match(appHtml,/if\(!name&&price\)\{price\.value='';delete price\.dataset\.serviceBound\}/);
});
