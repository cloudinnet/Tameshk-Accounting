'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appDir = __dirname;
const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
const sourceLine = (source, name) => {
  const line = source.split(/\r?\n/).find(x => x.trimStart().startsWith(`function ${name}(`));
  assert.ok(line, `function ${name} is present`);
  return line.trim();
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);

test('a deleted category remains deleted through startup migration while legacy categories still migrate', () => {
  const ensure = sourceLine(html, 'ensureInventoryData');
  const run = initial => {
    const ctx = { state: initial, todayISO: () => '2026-10-18', Number, String, Array, Set, Object };
    vm.createContext(ctx);
    vm.runInContext(`${ensure}; ensureInventoryData();`, ctx);
    return ctx.state;
  };
  const deleted = run({
    categories: ['-'], products: [{ id:'p1', category:'Retired', stock:1, price:10, cost:2 }],
    settings: { deletedCategories:['Retired'], categorySelectionOptional:true, categoryDefaultInitialized:true }
  });
  assert.deepEqual(Array.from(deleted.categories), ['-']);
  assert.deepEqual(Array.from(deleted.settings.deletedCategories), ['Retired']);
  assert.equal(deleted.products[0].category, 'Retired', 'existing product keeps its historical label');

  const legacy = run({
    categories: ['-'], products: [{ id:'p1', category:'Legacy', stock:1, price:10, cost:2 }],
    settings: { categorySelectionOptional:true, categoryDefaultInitialized:true }
  });
  assert.deepEqual(Array.from(legacy.categories), ['-', 'Legacy'], 'old profiles without deletion markers still recover legacy categories');
});

test('editing a product keeps its deleted category selected as history-only and does not silently clear it', () => {
  const p = { id:'p1', name:'Item', category:'Retired', baseUnit:'each', unit:'each', stock:2, cost:3, price:7, packUnits:[], history:[] };
  const state = { categories:['-'], products:[p], settings:{ categorySelectionOptional:true, deletedCategories:['Retired'] } };
  const nodes = new Map();
  const events = { modal:'', toasts:[], saves:0 };
  const window = { uiText:s=>s, TameshkCurrency:{ inputStep:()=>1, snapshot:x=>x, config:()=>({}) } };
  const ctx = {
    state, window, esc, qtyFmt: n=>String(n), openModal: html=>{events.modal=html},
    document:{getElementById:id=>nodes.get(id)||null},
    showToast:m=>events.toasts.push(String(m)), save:()=>{events.saves++;return true}, closeModal(){}, render(){},
    Number, String, Array, Set, Object, Math, Date, structuredClone
  };
  vm.createContext(ctx);
  vm.runInContext(sourceLine(html,'productModal')+'\n'+sourceLine(html,'saveProduct'),ctx);
  ctx.productModal('p1');
  assert.match(events.modal, /data-history-only="1"/);
  assert.match(events.modal, /disabled data-history-only="1"/);
  assert.doesNotMatch(events.modal, /<option value="Retired"(?![^>]*disabled)/);

  const field = (value, dataset={}) => ({ value:String(value), dataset });
  for (const [id,value] of Object.entries({
    pName:'Updated item', pUnit:'each', pStock:'2', pCat:'Retired', pPack1:'', pPack1Qty:'',
    pPack2:'', pPack2Qty:'', pCost:'3', pPrice:'7'
  })) nodes.set(id, field(value, id==='pCat'?{}:{}));
  ctx.saveProduct('p1');
  assert.equal(p.category, 'Retired', 'editing other product fields must preserve the historical category');
  assert.equal(events.saves, 1);

  nodes.get('pCat').value=''; nodes.get('pCat').dataset.userChanged='1';
  ctx.saveProduct('p1');
  assert.equal(p.category, '', 'in optional-category mode, an explicit blank choice can clear the catalog item category');
});

test('credit-record editor renders old category as disabled history-only and persists it without making it active', () => {
  const financeSource = fs.readFileSync(path.join(appDir, 'financial-modules.js'), 'utf8');
  const line = values => ({
    dataset:{ originalCategory:values.originalCategory||'', categoryChanged:values.categoryChanged?'1':'' },
    querySelector(selector){
      const key={'.fl-name':'name','.fl-category':'category','.fl-qty':'qty','.fl-unit':'unit','.fl-price':'price','.fl-discount':'discount','.fl-profit':'profit'}[selector];
      return { value:String(values[key]??'') };
    }
  });
  const oldLine={name:'Historical item',category:'Retired',qty:1,unit:'each',price:50,discount:0,profit:0};
  const state={settings:{language:'fa',categorySelectionOptional:true,deletedCategories:['Retired']},categories:['-'],creditRecords:[{id:'cr1',kind:'sale',party:'Buyer',lines:[oldLine],subtotal:50,tax:0,total:50}]};
  const rows=[line({name:'Historical item',category:'Retired',originalCategory:'Retired',qty:1,unit:'each',price:50,discount:0,profit:0})];
  const fields={fin_party:{value:'Buyer'},fin_phone:{value:''},fin_address:{value:''},fin_promised:{value:''},fin_settled:{value:''},fin_freq:{value:'daily'},fin_penalty:{value:'0'},fin_taxOn:{checked:false},fin_taxPercent:{value:'0'}};
  const doc={
    head:{appendChild(){}}, createElement(){return {style:{},appendChild(){},click(){},remove(){}}},
    getElementById:id=>fields[id]||null,
    querySelectorAll:selector=>selector==='#fin_lines .fin-line'?rows:[]
  };
  const ctx={window:null,document:doc,state,console:{warn(){},error(){}},Intl,Date,Math,Number,String,JSON,Array,Object,Set,Map,Promise,
    uiText:s=>s,save(){},showToast(){},closeModal(){},openModal(html){ctx.modal=html},localStorage:{setItem(){}},
  };
  ctx.window=ctx;ctx.globalThis=ctx;
  vm.createContext(ctx);vm.runInContext(financeSource,ctx,{filename:'financial-modules.js'});
  ctx.tameshkFinanceEdit('credit','sale','cr1');
  assert.match(ctx.modal,/data-history-only="1"/);
  assert.match(ctx.modal,/disabled data-history-only="1"/);
  ctx.tameshkFinanceSaveCredit('sale','cr1');
  assert.equal(state.creditRecords[0].lines[0].category,'Retired');
  assert.equal(Object.hasOwn(state.creditRecords[0].lines[0],'originalCategory'),false,'editor-only metadata is not persisted');
  assert.deepEqual(Array.from(state.categories),['-'],'historical category does not return to selectable categories');
});

test('barcode expense scan does not append a deleted category to the selectable dropdown', () => {
  const barcodeSource=fs.readFileSync(path.join(appDir,'barcode.js'),'utf8');
  const nodes={exTitle:{value:''},exAmount:{value:'0',focus(){}},exCat:{value:'-',options:[]}};
  const toasts=[];
  const state={categories:['-'],products:[],quickCatalog:[{id:'q1',kind:'expense',name:'Old utility bill',category:'Retired',price:75,barcode:'EXP-1'}],settings:{categorySelectionOptional:true,deletedCategories:['Retired']}};
  const document={head:{appendChild(){}},createElement(){return {style:{},set textContent(_){},appendChild(){}}},getElementById:id=>nodes[id]||null};
  const ctx={window:null,state,document,uiText:s=>`EN:${s}`,showToast:s=>toasts.push(String(s)),save(){},esc,Number,String,Array,Set,Math,Date,RegExp,Object};ctx.window=ctx;
  vm.createContext(ctx);vm.runInContext(barcodeSource,ctx,{filename:'barcode.js'});
  ctx.TameshkBarcode.scanExpense('EXP-1');
  assert.equal(nodes.exTitle.value,'Old utility bill');
  assert.equal(nodes.exAmount.value,75);
  assert.equal(nodes.exCat.value,'','deleted category is not selected for new expenses');
  assert.equal(nodes.exCat.options.length,0,'a removed category is never recreated as a dropdown option');
  assert.match(toasts.at(-1),/EN:دستهٔ این مورد قبلاً حذف شده است/);
});

test('service migration keeps a removed category historical instead of reactivating it', () => {
  const serviceSource=fs.readFileSync(path.join(appDir,'service-management.js'),'utf8');
  const state={categories:['-'],products:[],services:[{id:'s1',name:'Retired service',category:'Retired',price:20,stockUnlimited:true}],quickCatalog:[{id:'s1',kind:'service',name:'Retired service',category:'Retired',price:20}],settings:{deletedCategories:['Retired'],categorySelectionOptional:true}};
  const document={head:{appendChild(){}},createElement(){return {style:{}}}};
  const ctx={state,document,window:null,console,Number,Date,Math,Object,Array,String,Set,Map,RegExp,JSON,localStorage:{setItem(){}},showToast(){},esc};ctx.window=ctx;
  vm.createContext(ctx);vm.runInContext(serviceSource,ctx,{filename:'service-management.js'});
  ctx.TameshkServices.migrate();
  assert.deepEqual(Array.from(state.categories),['-'],'migration must not reactivate a tombstoned service category');
  assert.deepEqual(Array.from(state.settings.deletedCategories),['Retired']);
  assert.equal(state.services[0].category,'Retired','old service keeps the historical category string');
});

test('backup validation permits historically uncategorized catalog records and preserves tombstoned labels', () => {
  const validator=sourceLine(html,'validateBackupState');
  const ctx={
    structuredClone, Object, Array, Set, String, Number, Date, RegExp, Error,
    validateRecordCurrencies(){}, validateExpenseReturnAdjustments(){return new Set()}, validateImageDataUrl(){},
    window:{},
  };
  vm.createContext(ctx);vm.runInContext(validator,ctx);
  const uncategorized=ctx.validateBackupState({
    categories:['-'], products:[{id:'p1',name:'Uncategorized item',category:'',stock:0,price:0,cost:0}],
    transactions:[], expenses:[], settings:{categorySelectionOptional:false,deletedCategories:[]},
    quickCatalog:[{id:'q1',name:'Uncategorized expense',category:'',kind:'expense',price:10,barcode:'EXP-1'}]
  });
  assert.equal(uncategorized.products[0].category,'','backup restore must not reject old uncategorized products after policy changes');
  assert.equal(uncategorized.quickCatalog[0].category,'','backup restore permits historical uncategorized quick entries');
  const historical=ctx.validateBackupState({
    categories:['-'],products:[{id:'p2',name:'Old item',category:'Retired',stock:1,price:10,cost:2}],
    transactions:[],expenses:[],settings:{categorySelectionOptional:true,deletedCategories:['Retired']},quickCatalog:[]
  });
  assert.deepEqual(Array.from(historical.categories),['-'],'deleted category is not re-added as selectable');
  assert.deepEqual(Array.from(historical.settings.deletedCategories),['Retired']);
  assert.equal(historical.products[0].category,'Retired','historic category label survives backup restore');
});
