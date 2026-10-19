'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let playwright;
try{playwright=require(process.env.TAMESHK_PLAYWRIGHT_CORE||'playwright-core')}catch(_){}
const faNumber=n=>new Intl.NumberFormat('fa').format(n);
const faCountPattern=n=>new RegExp(`^${faNumber(n)}\\s`);

test('browser: expense reports render each record once across report modes, date filtering and pagination',{skip:!playwright},async()=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
 try{
  // There is no native reports widget route: exercise the shared reportsPage
  // renderer in an actual detached expense window as well as the main route.
  for(const widget of [false,true]){
   const page=await browser.newPage();
   await page.addInitScript(()=>{
    class Storage{constructor(){this.values=new Map()}getItem(k){return this.values.get(String(k))??null}setItem(k,v){this.values.set(String(k),String(v))}removeItem(k){this.values.delete(String(k))}clear(){this.values.clear()}get length(){return this.values.size}key(i){return[...this.values.keys()][i]??null}}
    Object.defineProperty(window,'localStorage',{value:new Storage()});Object.defineProperty(window,'sessionStorage',{value:new Storage()});
   });
   await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href+(widget?'?tameshkPanel=expense':''));
   await page.waitForFunction(()=>window.TameshkReportWalletNumbering&&window.TameshkWorkflow);
   await page.evaluate(widget=>{
    closeModal();document.getElementById('profileOverlay')?.remove();state.transactions=[];state.creditRecords=[];state.installments=[];state.expenseReturns=[];setUiLanguage('fa');state.settings.transactionCalendar='شمسی';state.settings.reportCalendar='شمسی';
    state.expenses=Array.from({length:17},(_,i)=>({id:`report-exp-${i}`,itemNumber:`E-${String(i+1).padStart(6,'0')}`,title:`UniqueReportExpense-${String(i).padStart(2,'0')}`,category:'Office',date:i===16?'2026-10-09':'2026-10-10',dateCalendar:'میلادی',amount:i+1,paymentMethod:'نقدی'}));
    // Legacy/imported purchases with incomplete source metadata previously
    // appeared once in the base report and again in finance augmentation.
    Object.assign(state.expenses[0],{financeSource:'purchase'});
    Object.assign(state.expenses[1],{financeSource:'purchase',financeKind:'credit'});
    Object.assign(state.expenses[2],{financeSource:'purchase',financeRecordId:'legacy-purchase'});
    Object.assign(state.expenses[3],{financeSource:'purchase',financeKind:'credit',financeRecordId:'complete-purchase'});
    if(widget)reportsPage(document.getElementById('content'));else go('reports');
    for(const[id,iso]of[['reportFrom','2026-10-09'],['reportTo','2026-10-10']]){const e=document.getElementById(id);e.dataset.iso=iso;e.dataset.snapshot=e.value=TameshkCalendar.format(iso,e.dataset.calendar)}
    document.getElementById('reportView').value='table';renderReport();
   },widget);
   const storedExpenses=await page.evaluate(()=>JSON.stringify(state.expenses));
   const table=page.locator('#reportResult [data-tp-key="report-expenses"]');
   const controls=page.locator('[data-tp-controls-for="report-expenses"]');
   async function checkCount(expected){
    assert.equal(await table.count(),1);
    await page.waitForFunction(()=>!!document.querySelector('[data-tp-controls-for="report-expenses"]'));
    const titles=await table.locator('tbody tr:not([data-tp-empty]) td:nth-child(2)').allTextContents();
    assert.equal(titles.length,expected);assert.equal(new Set(titles).size,expected);
    // Count expense titles across the entire report, not just a chosen table:
    // this catches a second table/section even with a different pagination key.
    const all=await page.locator('#reportResult').textContent();
    for(const title of titles)assert.equal(all.split(title).length-1,1);
   }
   await checkCount(15);
   assert.match(await controls.locator('.tp-count').textContent(),faCountPattern(17));
   assert.equal(await page.evaluate(()=>reportData().expenses),153);
   await controls.locator('.tp-page').filter({hasText:new RegExp(`^${faNumber(2)}$`)}).click();await checkCount(2);
   await controls.locator('.tp-search').fill('UniqueReportExpense-16');await checkCount(1);
   await controls.locator('.tp-search').fill('');await checkCount(15);
   await page.selectOption('#reportView','all');await checkCount(15);
   assert.equal((await page.locator('.report-kpis .stat').nth(1).locator('.value').textContent()).trim().split(/\s/)[0],await page.evaluate(()=>money(153)));
   for(const mode of ['stats','text','graphic']){await page.selectOption('#reportView',mode);assert.equal(await table.count(),0)}
   await page.selectOption('#reportView','table');await checkCount(15);
   for(const calendar of ['میلادی','قمری','شمسی']){
    await page.evaluate(()=>TameshkCalendar.openPicker('reportFrom'));
    await page.selectOption('#calendarPickerType',calendar);
    await page.evaluate(()=>{TameshkCalendar.closePicker();renderReport()});
    await checkCount(15);
    assert.match(await controls.locator('.tp-count').textContent(),faCountPattern(17));
    assert.deepEqual(await page.evaluate(()=>({count:reportData().ex.length,amount:reportData().expenses,from:document.getElementById('reportFrom').dataset.iso,to:document.getElementById('reportTo').dataset.iso})),{count:17,amount:153,from:'2026-10-09',to:'2026-10-10'});
   }
   await page.evaluate(()=>{const e=document.getElementById('reportFrom');e.dataset.iso='2026-10-10';e.dataset.snapshot=e.value=TameshkCalendar.format('2026-10-10',e.dataset.calendar);renderReport()});
   await checkCount(15);assert.equal(await page.evaluate(()=>reportData().ex.length),16);assert.equal(await page.evaluate(()=>reportData().expenses),136);
   assert.match(await controls.locator('.tp-count').textContent(),faCountPattern(16));
   assert.equal(await page.evaluate(()=>JSON.stringify(state.expenses)),storedExpenses);
   // Equal-looking purchases are separate records, even with equal provenance.
   await page.evaluate(()=>{state.expenses=['equal-one','equal-two'].map(id=>({id,title:'Equal legitimate expense',category:'Office',date:'2026-10-10',dateCalendar:'میلادی',amount:100,financeSource:'purchase',financeKind:'credit',financeRecordId:'shared-source'}));document.getElementById('reportView').value='all';renderReport()});
   assert.equal(await table.locator('tbody tr:not([data-tp-empty])').count(),2);
   assert.match(await controls.locator('.tp-count').textContent(),faCountPattern(2));
   assert.equal(await page.evaluate(()=>reportData().expenses),200);
   assert.equal((await page.locator('.report-kpis .stat').nth(1).locator('.value').textContent()).trim().split(/\s/)[0],await page.evaluate(()=>money(200)));
   await page.evaluate(()=>{state.expenses=[];renderReport()});assert.equal(await table.count(),0);assert.equal(await page.evaluate(()=>reportData().expenses),0);
   await page.close();
  }
 }finally{await browser.close()}
});
