'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=__dirname;
const read=name=>fs.readFileSync(path.join(app,name),'utf8');
const template=read('template-manager.js');
const catalog=read('catalog-images.js');
const feature=read('feature-controls.js');
const legacy=read('index.html');
const layout=read('transaction-form-layout.js');
const enhancements=read('enhancements-146.js');
const manager=fs.readFileSync(path.join(app,'..','..','desktop','widget-manager.cjs'),'utf8');

function renderItemsWith(state){
  const match=template.match(/function renderItems\(t,label,noTranslate=false\)\{[\s\S]*?\n  \}/);
  assert.ok(match,'renderItems function is present');
  const ctx={state,money:value=>String(Math.round(Number(value)||0)),esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
  ctx.window=ctx;
  const currencyHelper=template.match(/function currencySymbol\(record\)\{[^\n]+/);
  assert.ok(currencyHelper,'record-context currency symbol dependency is present');
  vm.runInNewContext(`${currencyHelper[0]}\n${match[0]}\nwindow.renderItems=renderItems;`,ctx);
  return ctx.renderItems;
}

function saveWrapperWith(state,row){
  const source=read('enhancements-146.js');
  const match=source.match(/if\(typeof orig\.saveTransaction==='function'\)root\.saveTransaction=function\([\s\S]*?(?=\nif\(typeof orig\.showInvoice)/);
  assert.ok(match,'saveTransaction wrapper is present');
  let serial=0;
  const orig={saveTransaction(){state.transactions.push({id:`line-${++serial}`,discount:0,items:[{name:'Item',qty:2,price:100,lineDiscount:0}]})}};
  const rootApi={__suppressInvoiceAfterSave:false,closeModal(){},render(){},showToast(){},showInvoice(){throw new Error('save-only must not open invoice')}};
  const d={querySelectorAll(selector){return selector==='#items .item-row'?[row]:[]}};
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const calcTotals=t=>{const subtotal=(t.items||[]).reduce((sum,item)=>sum+n(item.qty)*n(item.price),0),lineDiscount=(t.items||[]).reduce((sum,item)=>sum+n(item.lineDiscount),0);return{subtotal,lineDiscount,discount:n(t.discount),tax:0,taxable:subtotal-lineDiscount,total:subtotal-lineDiscount}};
  vm.runInNewContext(match[0],{root:rootApi,orig,d,state,n,tr:value=>value,calcTotals,persist(){}});
  return rootApi;
}

test('transaction save wrapper preserves changing line discounts through the invoice template',()=>{
  const state={transactions:[],products:[],quickCatalog:[],settings:{}};
  let current='35';
  const input=value=>({value});
  const row={querySelector(selector){return selector==='.item-name'?input('Item'):selector==='.item-qty'?input('2'):selector==='.item-price'?input('100'):selector==='.item-line-discount'?input(current):null}};
  const save=saveWrapperWith(state,row);
  const render=renderItemsWith(state);
  for(const value of ['35','12','0']){
    current=value;save.saveTransaction(false);
    const tx=state.transactions.at(-1);
    assert.equal(tx.items[0].lineDiscount,Number(value),'the current row value is copied to the saved item');
    assert.equal(tx.exactTotals.lineDiscount,Number(value),'saved aggregate uses the same current value');
    const html=render(tx,'Items');
    if(Number(value))assert.match(html,new RegExp(`تخفیف کل قلم: ${value} تومان`));
    else assert.doesNotMatch(html,/تخفیف کل قلم:/);
  }
});

test('template invoice prints saved line discount amount without adding another table column',()=>{
  const render=renderItemsWith({settings:{invoiceImagesByDefault:false},products:[],quickCatalog:[]});
  const html=render({items:[{name:'Item',qty:2,price:100,lineDiscount:35}]},'Items');
  assert.match(html,/تخفیف کل قلم: 35 تومان/);
  assert.match(html,/<th>مبلغ ردیف \(تومان\)<\/th>/);
  assert.equal((html.match(/<th(?:\\s|>)/g)||[]).length,6,'discount is shown within the amount cell, preserving table width');
});

test('isolated item renderer uses saved currency and forwards the record for price and discount formatting',()=>{
  const state={settings:{currency:'IRT'},products:[],quickCatalog:[]};
  const record={currency:'USD',currencyDecimals:2,items:[{name:'Item',qty:2,price:12.75,lineDiscount:0.25}]};
  const match=template.match(/function renderItems\(t,label,noTranslate=false\)\{[\s\S]*?\n  \}/);
  const helper=template.match(/function currencySymbol\(record\)\{[^\n]+/)[0];
  const seen=[];const ctx={state,money:String,esc:String,TameshkCurrency:{symbol:t=>{assert.equal(t,record);return '$'},format:(value,t)=>{assert.equal(t,record);seen.push(value);return Number(value).toFixed(2)}}};ctx.window=ctx;
  vm.runInNewContext(`${helper}\n${match[0]}\nthis.render=renderItems`,ctx);
  const html=ctx.render(record,'Items');
  assert.match(html,/<th>قیمت واحد \(\$\)<\/th>/);assert.match(html,/<td>12\.75<\/td>/);assert.match(html,/تخفیف کل قلم: 0\.25 \$/);
  // All three amounts must be formatted once with the saved record; evaluation
  // order is not part of the rendered invoice contract.
  assert.deepEqual([...seen].sort((a,b)=>a-b),[0.25,12.75,25.5]);assert.doesNotMatch(html,/تومان/);
});

test('invoice image default affects newly-created checkboxes only; saved item opt-in controls rendered photos',()=>{
  const render=renderItemsWith({settings:{invoiceImagesByDefault:true},products:[],quickCatalog:[]});
  const image='data:image/png;base64,AA==';
  const html=render({items:[{name:'Legacy unset',qty:1,price:100,imageData:image},{name:'Manually off',qty:1,price:100,imageData:image,includeImage:false},{name:'Manually on',qty:1,price:100,imageData:image,includeImage:true}]},'Items');
  assert.equal((html.match(/class="catalog-thumb"/g)||[]).length,1,'only the item with explicit includeImage=true prints a photo');
  assert.equal((html.match(/class="tm-image-column"/g)||[]).length,4,'one header plus one image cell per row when at least one item opts in');
  assert.match(catalog,/function shouldInclude\(item\)\{return item\?\.includeImage===true\}/);
  assert.match(catalog,/check\.checked=includeDefault\(\)/,'global default remains the initial checkbox state for a new row');
});

test('template invoice honors a manually enabled photo even when the global default is off',()=>{
  const render=renderItemsWith({settings:{invoiceImagesByDefault:false},products:[],quickCatalog:[]});
  const image='data:image/png;base64,AA==';
  const html=render({items:[{name:'Manual photo',qty:1,price:100,imageData:image,includeImage:true},{name:'Default off',qty:1,price:100,imageData:image,includeImage:false}]},'Items');
  assert.equal((html.match(/class="catalog-thumb"/g)||[]).length,1);
  assert.match(html,/Manual photo/);
});

test('template invoice prints the exact saved line discount in the row amount cell',()=>{
  const render=renderItemsWith({settings:{invoiceImagesByDefault:false},products:[],quickCatalog:[]});
  const html=render({items:[{name:'Item',qty:2,price:100,priceAtSale:100,lineDiscount:500}]},'Items');
  assert.match(html,/تخفیف کل قلم: 500 تومان/);
  assert.match(html,/<td class="tm-line-total-cell">200<small class="tm-line-discount">/);
  assert.equal((html.match(/class="tm-image-column"/g)||[]).length,0,'no image column when no item opts in');
});

test('core transaction serialization captures the per-row discount before the post-save totals wrapper runs',()=>{
  assert.match(legacy,/priceAtSale:price,lineDiscount:Math\.max\(0,Number\(r\.querySelector\('\.item-line-discount'\)\?\.value\)\|\|0\)/);
  assert.ok(legacy.includes("photo=window.TameshkCatalogImages?.transactionFields?.(r)||{imageData:'',includeImage:false}"));
  assert.match(catalog,/function transactionFields\(row\)/);
  assert.match(catalog,/transactionFields,includeDefault/);
  assert.match(enhancements,/lineDiscount:Math\.max\(0,n\(r\.querySelector\('\.item-line-discount'\)\?\.value\)\)/);
  assert.match(enhancements,/isTemplateTable=!!paper\.querySelector\('\.tm-items table'\)/);
});

test('catalog image decoration reuses an existing template column and does not add an empty column',()=>{
  assert.match(catalog,/imageColumnIndex=\[\.\.\.head\.cells\]\.findIndex/);
  assert.match(catalog,/if\(imageColumnIndex<0&&\(!editable&&!hasIncludedPhoto\|\|editable&&!photos\.some\(Boolean\)\)\)return/);
  assert.match(catalog,/const src=photos\[i\],td=row\.cells\[columnIndex\]\|\|d\.createElement\('td'\)/);
  assert.match(catalog,/td\.replaceChildren\(box\)/);
});

test('default discount colors reach only aggregate/final discounts, not independently styled row discounts',()=>{
  const defaultDiscountCss=feature.match(/css\+=`([^`]*)`;for\(const \[k,v\] of Object\.entries\(fields\)\)/)?.[1]||'';
  assert.ok(defaultDiscountCss,'default discount CSS rule is present');
  assert.match(defaultDiscountCss,/#invoiceDiscountValue,#invoiceDiscount/);
  assert.match(defaultDiscountCss,/\.expense-total-discount,#expenseTotalDiscount/);
  assert.match(defaultDiscountCss,/\.invoice-paper \[data-tx-summary="finalDiscount"\]/);
  assert.match(defaultDiscountCss,/\.invoice-paper \.tx-invoice-discount-row/);
  assert.doesNotMatch(defaultDiscountCss,/\.item-line-discount|\.invoice-edit-line-discount|\.expense-row \.ex-discount/);
});

test('legacy editable invoice also renders the saved per-item discount',()=>{
  assert.match(legacy,/invoice-line-discount/);
  assert.match(legacy,/Math\.max\(0,Number\(i\.lineDiscount\)\|\|0\)/);
});

test('stamp area uses the requested larger dimensions and logo remains outside invoice metadata flow',()=>{
  assert.match(template,/\.tm-paper \.tm-stamp\{grid-column:2;grid-row:1;justify-self:center;width:min\(135px,100%\);max-width:100%;height:88px;min-height:88px/);
  assert.match(template,/\.tm-paper \.tm-stamp \.invoice-image-stamp\{width:100%;height:100%;max-width:100%;max-height:100%;margin:0 auto;object-fit:contain/);
  assert.match(template,/\.tm-paper \.invoice-top\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(template,/\.tm-paper \.invoice-top>\.tm-brand:has\(\.invoice-logo\)\{display:grid;grid-template-columns:96px minmax\(0,1fr\);grid-template-rows:minmax\(52px,auto\);align-items:center;gap:8px;min-width:0\}/);
  assert.match(template,/\.tm-paper \.invoice-top>\.tm-brand>\.tm-field:has\(\.invoice-logo\)\{position:static;grid-column:1;grid-row:1;width:96px;max-width:100%;margin:0\}/);
  assert.match(template,/\.tm-paper \.invoice-top>\.tm-brand \.tm-business-name\{grid-column:2;grid-row:1/);
  assert.match(template,/\.invoice-paper\.tm-paper\{padding:8px 24px 24px\}/);
  assert.match(template,/\.tm-paper \.invoice-top>\.tm-brand\{grid-area:brand;display:grid;grid-template-columns:96px minmax\(0,1fr\);grid-template-rows:minmax\(52px,auto\);align-items:center;gap:8px;min-width:0\}/,'reserve the same logo slot and row height even when no logo is configured');
  assert.match(template,/\.tm-paper \.invoice-top>\.tm-brand \.tm-business-name\{grid-column:2;grid-row:1;display:block;min-width:0/);
  assert.match(template,/\.tm-paper \.invoice-top img\.invoice-logo\{width:96px;height:44px/);
  assert.match(template,/class="tm-brand"/);
  assert.match(read('invoice-print-layout.js'),/padding:5px 0 0!important/);
  assert.match(read('invoice-print-layout.js'),/\.invoice-paper \.tm-stamp \.invoice-image-stamp\{width:100%!important;height:100%!important/);
});

test('main and widget form layouts adapt before fixed-width item fields can collide; panels retain safe native minimum sizes',()=>{
  assert.ok(layout.includes('@media(max-width:1100px){')&&layout.includes('.item-row{grid-template-columns:repeat(3,minmax(0,1fr))!important;'));
  assert.ok(layout.includes('@media(max-width:760px){')&&layout.includes('.item-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}'));
  assert.match(layout,/container-name:transaction-items/);
  assert.match(layout,/@container transaction-items \(max-width:460px\)/);
  assert.match(manager,/const minWidth=toolbar\?Math\.min\(72,area\.width\):Math\.min\(type==='invoice'\?560:480,area\.width\)/);
  assert.match(layout,/@container main-pane \(max-width:760px\)/);
  assert.match(layout,/@container widget-pane \(max-width:620px\)/);
  assert.match(layout,/@media\(max-width:640px\)\{\.widget-panel-body #content \.form-grid,\.widget-panel-body #modalInner \.form-grid/);
});

test('transaction save renders only after widget image choices and per-line discounts are persisted',()=>{
  const txEnh=read('transaction-enhancements.js');
  assert.match(catalog,/wasSuppressed=!!root\.__suppressInvoiceAfterSave/);
  assert.match(catalog,/root\.__suppressInvoiceAfterSave=true;try\{out=old\.apply\(this,arguments\)\}finally\{root\.__suppressInvoiceAfterSave=wasSuppressed\}/);
  assert.match(catalog,/item\.includeImage=!!v\.imageData&&v\.includeImage/);
  assert.match(catalog,/if\(showAfter&&!wasSuppressed\)root\.showInvoice\?\.\(tx\.id,true\)/);
  assert.match(enhancements,/persist\(\);if\(!root\.__suppressInvoiceAfterSave\)\{if\(showInvoiceAfter\)root\.showInvoice/);
  assert.match(txEnh,/if\(!root\.__suppressInvoiceAfterSave\)\{if\(showInvoiceAfter\)/);
  assert.match(layout,/root\.__suppressInvoiceAfterSave=true;const before=new Set/);
  assert.match(layout,/root\.__suppressInvoiceAfterSave=wasSuppressed\}const t=/);
  assert.match(layout,/if\(arguments\[0\]!==false&&!root\.__suppressInvoiceAfterSave\)root\.showInvoice/);
});

test('widget transaction screen receives image toggles through the shared row decorator and saves line discount',()=>{
  assert.match(catalog,/wrap\('addItemRow','addItemRow'/);
  assert.match(catalog,/class="item-include-image"/);
  assert.match(catalog,/className='item-image-control'/);
  assert.match(enhancements,/item\.lineDiscount=captured\[i\]\?\.lineDiscount\|\|0/);
});

test('invoice date stays attached when the editor groups its calendar field with time',()=>{
  const start=layout.indexOf("const dt=d.getElementById('invoiceEditDate');");
  const end=layout.indexOf("\nconst editTax=",start);
  assert.ok(start>=0&&end>start,'invoice date/time wrapper is present');
  const wrapper=layout.slice(start,end);
  const capture=wrapper.indexOf("const field=dt.closest('.field')");
  const move=wrapper.indexOf('wrap.appendChild(cal)');
  assert.ok(capture>=0&&move>capture,'the original field parent is captured before moving the calendar');
  assert.match(wrapper,/field\?\.appendChild\(wrap\)/,'the combined date/time wrapper is reattached to that original parent');
  assert.doesNotMatch(wrapper,/dt\.closest\('\.field'\)\?\.appendChild\(wrap\)/,'do not look up the parent after detaching the date field');
});
