'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function fixture(){
 const state={settings:{transactionCalendar:'شمسی'},products:[],transactions:[],expenses:[
  {id:'one',itemNumber:'E-000001',title:'Rent',date:'2026-10-10',dateCalendar:'میلادی',amount:400,paymentMethod:'نقدی'},
  {id:'two',itemNumber:'E-000002',title:'Tools',date:'۱۴۰۵/۰۷/۱۸',dateCalendar:'شمسی',amount:600,paymentMethod:'کارت'}
 ]};
 const document={head:{appendChild(){}},createElement(){return{style:{},classList:{add(){},remove(){}},appendChild(){},setAttribute(){}}},querySelectorAll(){return[]},getElementById(){return null}};
 const window={document};
 const ctx={window,document,state,save(){},setTimeout,clearTimeout};
 for(const file of ['calendar-input.js','report-wallet-numbering.js','workflow-polish.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'),ctx);
 return{state,window};
}

test('numbered expense renderer follows current calendar, not entry calendar, without changing accounting data',()=>{
 const{state,window}=fixture(),host={innerHTML:''},before=JSON.stringify(state.expenses),api=window.TameshkReportWalletNumbering;
 for(const calendar of ['شمسی','میلادی','قمری']){
  state.settings.transactionCalendar=calendar;api.renderExpenseRows(host);
  const expected=window.TameshkCalendar.label('2026-10-10',calendar);
  assert.equal(host.innerHTML.split(expected).length-1,2);
  assert.match(host.innerHTML,/data-tp-key="expense-list"/);
  assert.match(host.innerHTML,/E-000001/);assert.match(host.innerHTML,/E-000002/);
 }
 assert.equal(JSON.stringify(state.expenses),before);
 assert.equal(api.walletFigures().expenses,400);
 api.renderExpenseRows(host,'E-000002');assert.doesNotMatch(host.innerHTML,/data-record-id="one"/);
 api.renderExpenseRows(host,'missing');assert.match(host.innerHTML,/data-tp-empty="true"/);
});

test('field search updates the existing numbered host and removes obsolete unnumbered tables',()=>{
 const{window}=fixture(),host={innerHTML:'',contains(){return false}},removed=[];
 const panel={querySelector(sel){return sel==='.expense-search-results'?host:null},querySelectorAll(sel){return sel.includes('controls')?[]:[{remove(){removed.push(true)}}]}};
 window.document.getElementById=id=>id==='expenseSearch'?{value:'Rent'}:id==='expenseItemSearch'?{value:''}:null;
 window.document.querySelector=()=>({parentElement:panel});
 // Workflow reads state through this shared accessor in the real app.
 const{state}=fixture();window.__tameshkGetState=()=>state;
 window.renderExpenseSearchResults();
 assert.equal(removed.length,1);assert.match(host.innerHTML,/شماره قلم/);
 assert.match(host.innerHTML,/data-record-id="one"/);assert.doesNotMatch(host.innerHTML,/data-record-id="two"/);
});

let playwright;
try{playwright=require(process.env.TAMESHK_PLAYWRIGHT_CORE||'playwright-core')}catch(_){/* Optional integration dependency. */}
test('browser: one numbered expense table on main and detached widget routes across calendars and live search',{skip:!playwright},async()=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
 try{
  for(const widget of [false,true]){
   const page=await browser.newPage();
   await page.addInitScript(()=>{
    class Storage{constructor(){this.values=new Map()}getItem(k){return this.values.get(String(k))??null}setItem(k,v){this.values.set(String(k),String(v))}removeItem(k){this.values.delete(String(k))}clear(){this.values.clear()}get length(){return this.values.size}key(i){return[...this.values.keys()][i]??null}}
    Object.defineProperty(window,'localStorage',{value:new Storage()});Object.defineProperty(window,'sessionStorage',{value:new Storage()});
   });
   await page.goto(require('node:url').pathToFileURL(path.join(__dirname,'index.html')).href+(widget?'?tameshkPanel=expense':''));
   await page.waitForFunction(()=>window.TameshkWorkflow&&window.TameshkReportWalletNumbering);
   await page.evaluate(()=>{
    closeModal();setUiLanguage('fa');state.settings.transactionCalendar='شمسی';state.expenses=[
     {id:'one',itemNumber:'E-000001',title:'Rent',category:'Office',date:'2026-10-10',dateCalendar:'میلادی',amount:400,paymentMethod:'نقدی'},
     {id:'two',itemNumber:'E-000002',title:'Tools',category:'Office',date:'2026-10-09',dateCalendar:'شمسی',amount:600,paymentMethod:'کارت'}
    ];state.settings.itemNumberCounters={P:0,E:2};
    expensesPage(document.getElementById('content'));
   });
   const table=page.locator('#content .table-wrap[data-tp-key="expense-list"]');
   await assertTable();
   async function assertTable(){assert.equal(await table.count(),1);assert.equal(await page.locator('#content .expense-search-results table').count(),1);assert.match(await table.locator('thead').innerText(),/شماره قلم/)}
   for(const calendar of ['شمسی','میلادی','قمری']){
    const expected=await page.evaluate(calendar=>{state.settings.transactionCalendar=calendar;renderExpenseSearchResults();return TameshkCalendar.label('2026-10-10',calendar)},calendar);
    await assertTable();assert.equal(await table.locator('[data-record-id="one"] td').first().innerText(),expected);
   }
   await page.locator('#expenseSearch').fill('Rent');await assertTable();assert.equal(await table.locator('tbody tr[data-record-id]').count(),1);
   await page.locator('#expenseItemSearch').fill('E-000002');assert.equal(await table.locator('tbody tr[data-record-id]').count(),0);
   await page.locator('#expenseSearch').fill('');assert.equal(await table.locator('tbody tr[data-record-id]').count(),1);
   await page.locator('#expenseItemSearch').fill('');await assertTable();assert.equal(await table.locator('tbody tr[data-record-id]').count(),2);
   if(widget){
    await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'tameshk-state',newValue:JSON.stringify(state)})));
    await assertTable();assert.equal(await table.locator('tbody tr[data-record-id]').count(),2);
   }
   await page.evaluate(()=>{state.expenses=[];expensesPage(document.getElementById('content'))});await assertTable();assert.equal(await table.locator('[data-tp-empty]').count(),1);
   await page.close();
  }
 }finally{await browser.close()}
});


test('cash wallet totals include only the selected currency and explicitly cash-paid sales refunds',()=>{
 const state={settings:{currency:'USD',currencyDecimals:2},products:[],transactions:[],expenses:[
  {id:'usd-cash',amount:10,paymentMethod:'نقدی',currency:'USD',currencyDecimals:2},
  {id:'irt-cash',amount:900,paymentMethod:'نقدی',currency:'IRT',currencyDecimals:0}
 ],transactionReturns:[
  {id:'cash-refund',refundAmount:5,refundToCash:true,currency:'USD',currencyDecimals:2},
  {id:'noncash-refund',refundAmount:7,refundToCash:false,currency:'USD',currencyDecimals:2}
 ]};
 const document={head:{appendChild(){}},createElement(){return{style:{},classList:{add(){},remove(){}},appendChild(){},setAttribute(){}}},querySelectorAll(){return[]},getElementById(){return null}};
 const TameshkCurrency={config:r=>({currency:r?.currency||state.settings.currency||'IRT',currencyDecimals:r?.currencyDecimals??state.settings.currencyDecimals??0}),sameCurrency:(a,b)=>TameshkCurrency.config(a).currency===TameshkCurrency.config(b).currency,amount:x=>String(x)};
 const window={document,TameshkCurrency};const ctx={window,document,state,save(){},setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'report-wallet-numbering.js'),'utf8'),ctx);
 const w=window.TameshkReportWalletNumbering.walletFigures({currency:'USD',currencyDecimals:2});
 assert.equal(w.expenses,15);assert.equal(w.balance,-15);
});
