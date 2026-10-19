const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const state={products:[{id:'p1',name:'چاپ A4',price:100,cost:40,ancillaryPrice:15,stock:5,history:[]},{id:'p2',name:'عنوان مبهم',price:9,cost:4,ancillaryPrice:1},{id:'p3',name:'عنوان مبهم',price:8,cost:3,ancillaryPrice:0}],quickCatalog:[{id:'s1',kind:'service',name:'اسکن رنگی',price:200,cost:70,ancillaryPrice:25},{id:'s2',kind:'expense',name:'هزینهٔ آبونمان',price:500},{id:'s3',kind:'service',name:'قیمت نامعتبر',price:120,cost:50,ancillaryPrice:0}]};
const document={head:{appendChild(){}},createElement(){return{style:{},appendChild(){}}}};
const context={state,document,window:null,console,Intl,Number,Date,TextDecoder,Blob,Uint8Array,DataView,Map,Set,Math,Object,Array,String,RegExp,Error,JSON};context.window=context;context.document=document;context.localStorage={setItem(){}};
vm.runInNewContext(fs.readFileSync(__dirname+'/bulk-price-import.js','utf8'),context,{filename:'bulk-price-import.js'});
const api=context.TameshkBulkPrices;
assert.ok(api,'module API registered');
assert.deepEqual(JSON.parse(JSON.stringify(api.parseAmount('۰'))),{kind:'keep'});
assert.deepEqual(JSON.parse(JSON.stringify(api.parseAmount(''))),{kind:'keep'});
assert.deepEqual(JSON.parse(JSON.stringify(api.parseAmount('-'))),{kind:'set',value:0});
assert.deepEqual(JSON.parse(JSON.stringify(api.parseAmount('/'))),{kind:'set',value:0});
assert.deepEqual(JSON.parse(JSON.stringify(api.parseAmount('۱۲٬۳۴۵'))),{kind:'set',value:12345});
assert.deepEqual(JSON.parse(JSON.stringify(api.addAncillary({total:1000,tax:80},250))),{total:1250,tax:80,ancillaryCost:250});
const rows=[['عنوان کالا/خدمت','قیمت فروش','قیمت هزینه‌شده','هزینه‌های جانبی'],['چاپ A4','250','','/'],['اسکن رنگی','0','-','40'],['عنوان مبهم','20','20','20'],['گمشده','10','10','10'],['چاپ A4','300','50','50'],['قیمت نامعتبر','abc','','']];
const result=api.buildPlan(rows),summary=JSON.parse(JSON.stringify(result.summary));
assert.equal(summary.updated,2);assert.equal(summary.ambiguous,1);assert.equal(summary.unmatched,1);assert.equal(summary.duplicate,1);assert.equal(summary.invalid,1);
const applied=api.applyPlan(result);assert.equal(applied,2);
assert.deepEqual([state.products[0].price,state.products[0].cost,state.products[0].ancillaryPrice],[250,40,0]);
assert.deepEqual([state.quickCatalog[0].price,state.quickCatalog[0].cost,state.quickCatalog[0].ancillaryPrice],[200,0,40]);
state.settings={featureOptions:{cost:true,ancillary:true}};
const disabledFields=api.buildPlan([['عنوان کالا/خدمت','قیمت فروش','قیمت هزینه‌شده','هزینه‌های جانبی'],['چاپ A4','275','999','888']]);
assert.deepEqual(JSON.parse(JSON.stringify(disabledFields.plan[0].changes)),{price:275},'Hidden cost and ancillary controls must not be modified through bulk import');
// Canonical services, upsert creation, stable-code matching, and safe stock behavior.
const state2={categories:['عمومی'],products:[{id:'p-existing',name:'کالای قبلی',itemNumber:'P-1',price:100,cost:40,ancillaryPrice:9,stock:8,history:[]}],services:[{id:'svc-existing',name:'خدمت قبلی',serviceNumber:'S-1',category:'خدمات',price:200,cost:80,ancillaryPrice:12,stock:2,stockUnlimited:false,history:[]}],quickCatalog:[]};
const document2={head:{appendChild(){}},createElement(){return{style:{},appendChild(){}}}};
const context2={state:state2,document:document2,window:null,console,Intl,Number,Date,TextDecoder,Blob,Uint8Array,DataView,Map,Set,Math,Object,Array,String,RegExp,Error,JSON};context2.window=context2;context2.localStorage={setItem(){}};
vm.runInNewContext(fs.readFileSync(__dirname+'/bulk-price-import.js','utf8'),context2,{filename:'bulk-price-import.js'});
const api2=context2.TameshkBulkPrices;
assert.equal(typeof api2.handleFile,'function');assert.equal(typeof api2.template,'function');assert.equal(typeof api2.injectImporter,'function');
const upsert=api2.buildPlan([
  ['نوع','شناسه/کد','عنوان کالا/خدمت','دسته','قیمت فروش','قیمت هزینه‌شده','هزینه‌های جانبی','موجودی'],
  ['کالا','P-1','کالای قبلی','','0','','','0'], // zero preserves existing values, including stock
  ['خدمت','S-1','خدمت قبلی','خدمات نو','250','90','-','4'],
  ['کالا','P-NEW','کالای جدید','کاغذ','300','120','5','7'],
  ['service','S-NEW','خدمت جدید','خدمات','500','200','10','3']
]);
assert.equal(upsert.summary.created,2);assert.equal(upsert.summary.blocked,0);
assert.deepEqual(JSON.parse(JSON.stringify(upsert.plan[0].changes)),{},'blank/zero values preserve existing values');
// Existing product stock edit is blocked without changing its safe non-stock fields.
const blocked=api2.buildPlan([['نوع','شناسه','عنوان کالا/خدمت','قیمت فروش','موجودی'],['کالا','P-1','کالای قبلی','110','99']]);
assert.equal(blocked.summary.blocked,1);assert.equal(blocked.plan[0].stockBlocked,true);assert.deepEqual(JSON.parse(JSON.stringify(blocked.plan[0].changes)),{price:110});
const blockedOnly=api2.buildPlan([['نوع','شناسه','عنوان کالا/خدمت','موجودی'],['کالا','P-1','کالای قبلی','99']]);
assert.equal(blockedOnly.plan[0].statusCode,'blocked');assert.equal(api2.applyPlan(blockedOnly),0);assert.equal(state2.products[0].stock,8);
assert.equal(api2.applyPlan(upsert),3);
state2.settings={categorySelectionOptional:false};const missingCategory=api2.buildPlan([['نوع','شناسه/کد','عنوان کالا/خدمت','قیمت فروش'],['خدمت','S-EMPTY','خدمت بدون قیمت','']]);
assert.equal(missingCategory.summary.created,0,'a category is still required when the policy is disabled');
assert.equal(missingCategory.summary.invalid,1);assert.equal(api2.applyPlan(missingCategory),0);
const blankNew=api2.buildPlan([['نوع','شناسه/کد','عنوان کالا/خدمت','دسته','قیمت فروش'],['خدمت','S-EMPTY','خدمت بدون قیمت','خدمات تازه','']]);
assert.equal(blankNew.summary.created,1,'new catalog rows with all optional numeric fields blank remain creatable when a category is supplied');
assert.equal(api2.applyPlan(blankNew),1);
assert.ok(state2.services.some(x=>x.serviceNumber==='S-EMPTY'));assert.ok(state2.categories.includes('خدمات تازه'),'a user-supplied import category is added to the category list');
assert.equal(state2.products[0].stock,8);assert.equal(state2.products[0].price,100);
assert.equal(state2.services[0].stock,4);assert.equal(state2.services[0].price,250);assert.equal(state2.services[0].ancillaryPrice,0);
assert.equal(state2.products.length,2);assert.equal(state2.products[1].stock,7);assert.equal(state2.services.length,3);
// The same importer permits category-less catalog records only when the policy is enabled.
const state3={categories:['-'],products:[],services:[],quickCatalog:[],settings:{categorySelectionOptional:true}};
const document3={head:{appendChild(){}},createElement(){return{style:{},appendChild(){}}}};
const context3={state:state3,document:document3,window:null,console,Intl,Number,Date,TextDecoder,Blob,Uint8Array,DataView,Map,Set,Math,Object,Array,String,RegExp,Error,JSON};context3.window=context3;context3.localStorage={setItem(){}};
vm.runInNewContext(fs.readFileSync(__dirname+'/bulk-price-import.js','utf8'),context3,{filename:'bulk-price-import.js'});
const api3=context3.TameshkBulkPrices;
const optionalImport=api3.buildPlan([['نوع','شناسه/کد','عنوان کالا/خدمت','قیمت فروش'],['خدمت','S-OPTIONAL','خدمت بدون دسته','']]);
assert.equal(optionalImport.summary.created,1);assert.equal(api3.applyPlan(optionalImport),1);assert.equal(state3.services[0].category,'','no hidden catch-all category is assigned when category selection is optional');
state3.settings.categorySelectionOptional=false;
const requiredImport=api3.buildPlan([['نوع','شناسه/کد','عنوان کالا/خدمت','قیمت فروش'],['خدمت','S-MUST','خدمت نیازمند دسته','']]);
assert.equal(requiredImport.summary.invalid,1);assert.equal(api3.applyPlan(requiredImport),0);
assert.equal(state2.services[1].stock,3);
assert.equal(state2.quickCatalog.find(x=>x.id==='svc-existing').price,250,'canonical service is mirrored for legacy consumers');
context2.InventoryLedger={setStockFromBulkImport(id,stock,opts){const p=state2.products.find(x=>x.id===id);p.stock=stock;return{ok:true,changed:true,stock,sourceId:opts.sourceId}}};
const stockPlan=api2.buildPlan([['نوع','شناسه/کد','عنوان کالا/خدمت','موجودی'],['کالا','P-1','کالای قبلی','6']]);
assert.equal(stockPlan.summary.blocked,0);assert.equal(stockPlan.plan[0].statusCode,'ready');assert.equal(api2.applyPlan(stockPlan),1);assert.equal(state2.products[0].stock,6,'existing product stock updates pass through the inventory ledger API');
// Inventory UI uses one compact header action; it must not append the former long panel.
class FakeNode{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.listeners={};this.className='';this.id='';this.textContent='';}
  appendChild(node){if(node){node.parentNode=this;this.children.push(node)}return node}
  insertAdjacentElement(_,node){return this.appendChild(node)}
  querySelector(selector){return this.children.find(node=>node.matches?.(selector))||this.children.map(node=>node.querySelector?.(selector)).find(Boolean)||null}
  matches(selector){return selector.startsWith('#')?this.id===selector.slice(1):selector.startsWith('.')?this.className.split(/\\s+/).includes(selector.slice(1)):false}
  addEventListener(type,fn){this.listeners[type]=fn}
  click(){this.listeners.click?.({target:this})}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this)}
}
const uiNodes=new Map(),uiDocument={head:new FakeNode('head'),createElement(tag){const node=new FakeNode(tag);return node},getElementById(id){return uiNodes.get(id)||null}};
const uiState={products:[],quickCatalog:[]},uiContext={state:uiState,document:uiDocument,window:null,console,Intl,Number,Date,TextDecoder,Blob,Uint8Array,DataView,Map,Set,Math,Object,Array,String,RegExp,Error,JSON,openModal(html){this.modalHtml=html}};uiContext.window=uiContext;uiDocument.body=new FakeNode('body');
vm.runInNewContext(fs.readFileSync(__dirname+'/bulk-price-import.js','utf8'),uiContext,{filename:'bulk-price-import.js'});
const uiHost=new FakeNode('main'),uiHead=new FakeNode('div');uiHead.className='page-head';const oldPanel=new FakeNode('section');oldPanel.id='inventoryBulkPriceImportPanel';uiHead.appendChild(oldPanel);uiHost.appendChild(uiHead);
uiContext.TameshkBulkPrices.injectInventoryImporter(uiHost);
const importButton=uiHead.querySelector('#inventoryBulkPriceImportButton');assert.ok(importButton,'inventory importer header button is present');assert.equal(importButton.textContent,'به‌روزرسانی دسته‌ای قیمت کالا و خدمت');assert.equal(uiHead.querySelector('#inventoryBulkPriceImportPanel'),null,'legacy bottom importer panel is removed');importButton.click();assert.match(uiContext.modalHtml,/به‌روزرسانی دسته‌ای قیمت کالا و خدمت/,'header action opens compact importer modal');
console.log('bulk price import rules: OK');
