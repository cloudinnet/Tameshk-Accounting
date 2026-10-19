'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');

test('clearing the item picker allows a fresh full product/service search',()=>{
  const html=read('index.html');
  assert.match(html,/class="item-name" list="\$\{catalogId\}" autocomplete="off"/);
  assert.match(html,/onfocus="refreshItemCatalog\(this\)"/);
  assert.match(html,/function refreshItemCatalog\(inp\)[\s\S]*?state\.products[\s\S]*?state\.services/);
});

test('register-only mode suppresses invoice opening throughout save wrappers',()=>{
  const html=read('enhancements-146.js');
  const layout=read('transaction-form-layout.js');
  const images=read('catalog-images.js');
  const appearance=read('record-appearance.js');
  const appIndex=read('index.html');
  assert.match(html,/data-save-only[\s\S]*?saveTransaction\(false\)/);
  assert.match(appIndex,/arguments\[0\]!==false&&!window\.__suppressInvoiceAfterSave/);
  assert.match(layout,/arguments\[0\]!==false&&!root\.__suppressInvoiceAfterSave/);
  assert.match(images,/wasSuppressed=!!root\.__suppressInvoiceAfterSave,showAfter=arguments\[0\]!==false/);
  assert.match(images,/root\.__suppressInvoiceAfterSave=true;try\{out=old\.apply\(this,arguments\)\}finally\{root\.__suppressInvoiceAfterSave=wasSuppressed\}/);
  assert.match(images,/if\(showAfter&&!wasSuppressed\)root\.showInvoice\?\.\(tx\.id,true\)/);
  assert.match(appearance,/arguments\[0\]!==false&&!root\.__suppressInvoiceAfterSave/);
});

test('sales return history displays most recently entered return first',()=>{
  assert.match(read('returns-management.js'),/state\.transactionReturns\.slice\(\)\.reverse\(\)/);
});
