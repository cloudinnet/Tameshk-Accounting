'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let playwright;
try{playwright=require(process.env.TAMESHK_PLAYWRIGHT_CORE||process.env.TAMESHK_PLAYWRIGHT||'playwright-core')}catch(_){}
const url=pathToFileURL(path.join(__dirname,'index.html')).href;
async function isolated(browser,query=''){
 const page=await browser.newPage();page.setDefaultTimeout(8000);
 await page.addInitScript(()=>{
  class Storage{constructor(){this.values=new Map()}getItem(k){return this.values.get(String(k))??null}setItem(k,v){this.values.set(String(k),String(v))}removeItem(k){this.values.delete(String(k))}clear(){this.values.clear()}get length(){return this.values.size}key(i){return [...this.values.keys()][i]??null}}
  Object.defineProperty(window,'localStorage',{value:new Storage});Object.defineProperty(window,'sessionStorage',{value:new Storage});
  window.__pdfCalls=[];window.tameshkDesktop={saveInvoicePdf:async payload=>{window.__pdfCalls.push(payload);return {success:true,filename:'isolated-fixture.pdf'}},log(){}};
 });
 await page.goto(url+query);await page.waitForFunction(()=>window.TameshkDesktopWidget&&window.downloadInvoicePdf);
 // The fake desktop bridge has no titlebar mount to signal startup readiness.
 await page.evaluate(()=>window.TameshkStartup1506?.desktopReady());
 await page.waitForFunction(()=>!document.documentElement.classList.contains('tameshk-starting'));
 await page.evaluate(()=>{closeModal();document.getElementById('profileOverlay')?.remove()});
 return page;
}
test('browser: release localization protects saved data, observes attributes, and keeps main/widget print controls functional',{skip:!playwright},async t=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
 try{
  for(const language of ['en','ar'])for(const widget of [false,true])await t.test(`${language} ${widget?'actual invoice widget':'main invoice'} A5 landscape margin and PDF bridge`,async()=>{
   const page=await isolated(browser,widget?'?tameshkPanel=invoice&record=localization-fixture':'');
   await page.evaluate(language=>{
    state.settings.language=language;
    state.settings.business='داشبورد';state.settings.invoiceNote='گزارش‌ها';
    state.transactions=[{id:'localization-fixture',no:'TEST-1',date:'2026-10-11',customer:'ثبت هزینه',note:'گزارش‌ها',discount:0,tax:0,items:[{name:'خدمت',unit:'تومان',qty:1,price:12500}]}];
    setUiLanguage(language);showInvoice('localization-fixture',false);applyUiLanguage();
   },language);
   if(widget)assert.equal(await page.evaluate(()=>window.__tameshkWidgetRoute),'invoice');
   const orientation=page.locator('#modalInner [data-invoice-control="orientation"]');
   const size=page.locator('#modalInner [data-invoice-control="size"]');
   const margin=page.locator('#modalInner input.localized-number-entry:has(+ input[data-invoice-control="margin"])');
   assert.equal(await orientation.getAttribute('aria-label'),language==='en'?'Print orientation':'اتجاه الطباعة');
   await orientation.selectOption('landscape');await size.selectOption('A5');await margin.fill('8');await margin.blur();
   assert.deepEqual(await page.evaluate(()=>state.settings.invoicePrintOptions),{orientation:'landscape',size:'A5',marginMm:8});
   // Actually force the detached route's fallback controls to be recreated,
   // rather than testing only the main template toolbar in a widget window.
   if(widget){await page.evaluate(()=>{const original=window.showInvoice;window.showInvoice=function(...args){original(...args);document.querySelector('#modalInner .invoice-options')?.remove()};render();window.showInvoice=original;applyUiLanguage()});assert.equal(await page.locator('.widget-invoice-options').count(),1);await orientation.selectOption('portrait');await orientation.selectOption('landscape');await size.selectOption('A5');await margin.fill('8');await margin.blur()}
   await page.locator('#modalInner .invoice-download-button').click();
   await page.waitForFunction(()=>window.__pdfCalls.length===1);
   const payload=await page.evaluate(()=>window.__pdfCalls[0]);
   assert.equal(payload.orientation,'landscape');assert.equal(payload.size,'A5');assert.equal(payload.marginMm,8);assert.equal(payload.language,language);assert.equal(payload.invoiceNumber,'TEST-1');
   assert.equal(await page.locator('.tm-business-name').textContent(),'داشبورد');
   assert.equal(await page.locator('#invoiceNoteEdit').inputValue(),'گزارش‌ها');
   assert.ok((await page.locator('.tm-items').textContent()).includes('خدمت'));
   assert.ok((await page.locator('.tm-items').textContent()).includes('تومان'));
   await page.close();
  });
  await t.test('synthetic template preview localizes EN/AR/FA without rewriting real settings or transactions',async()=>{
   const page=await isolated(browser);
   for(const language of ['en','ar','fa']){
    await page.evaluate(language=>{state.transactions=[];delete state.settings.invoiceNote;setUiLanguage(language);go('settings')},language);
    const synthetic=await page.locator('#tmPreview').textContent();
    assert.equal(await page.evaluate(()=>state.categories.length),0,'fresh catalog must remain empty');
    assert.equal(await page.locator('#tmPreview .tm-items tbody tr').count(),0,'template preview must not seed example item rows');
    assert.doesNotMatch(synthetic,/General service|خدمة عامة|خدمت عمومی|چاپ و کپی|Printing and copying|الطباعة والنسخ|120,000|120000|15000|10,000/);
    assert.equal(await page.locator('#tmPreview .tm-note > div:last-child').textContent(),'—');
    assert.equal(await page.evaluate(()=>Object.hasOwn(state.settings,'invoiceNote')),false);
    for(const note of ['','از اعتماد شما سپاسگزاریم.']){
     await page.evaluate(note=>{state.settings.invoiceNote=note;go('settings')},note);
     assert.equal(await page.evaluate(()=>state.settings.invoiceNote),note);
     const displayed=await page.locator('#tmPreview .tm-note > div:last-child').textContent();assert.equal(displayed,note||'—');
    }
    await page.evaluate(()=>{state.settings.invoiceNote='تنظیم واقعی';state.transactions=[{id:'real-preview',no:'REAL',date:'2026-10-11',customer:'ثبت هزینه',note:'گزارش‌ها',items:[{name:'چاپ و کپی',unit:'تومان',qty:1,price:100}]}];window.__previewBefore=JSON.stringify(state.transactions);go('settings')});
    assert.ok((await page.locator('#tmPreview .tm-items').textContent()).includes('چاپ و کپی'));
    assert.equal(await page.locator('#tmPreview .tm-note > div:last-child').textContent(),'گزارش‌ها');
    assert.equal(await page.evaluate(()=>JSON.stringify(state.transactions)),await page.evaluate(()=>window.__previewBefore));
    assert.equal(await page.evaluate(()=>state.settings.invoiceNote),'تنظیم واقعی');
    await page.evaluate(()=>{state.transactions[0].note='';go('settings')});assert.equal(await page.locator('#tmPreview .tm-note > div:last-child').textContent(),'—');
    assert.equal(await page.evaluate(()=>state.transactions[0].note),'');
   }
   await page.close();
  });
  await t.test('actual history widget translates only unnamed fallback and preserves customer/note collisions',async()=>{
   const page=await isolated(browser,'?tameshkPanel=history');
   for(const language of ['en','ar','fa']){
    await page.evaluate(language=>{state.transactions=[{id:'history-empty',no:'EMPTY',date:'2026-10-11',customer:'',items:[]},{id:'history-user',no:'USER',date:'2026-10-11',customer:'ثبت هزینه',note:'گزارش‌ها',items:[]}];setUiLanguage(language);render();applyUiLanguage()},language);
    assert.equal(await page.locator('[data-history-record="history-empty"]').textContent(),`EMPTY · ${language==='en'?'Unnamed':language==='ar'?'بلا اسم':'بدون نام'}`);
    assert.equal(await page.locator('[data-history-record="history-user"]').textContent(),'USER · ثبت هزینه');
    assert.ok((await page.locator('#widgetHistoryRows').textContent()).includes('گزارش‌ها'));
    assert.equal(await page.evaluate(()=>state.transactions.find(x=>x.id==='history-user').customer),'ثبت هزینه');
   }
   await page.close();
  });
  await t.test('observer changes, reversibility, implicit values and exact dictionary collisions',async()=>{
   const page=await isolated(browser);
   await page.evaluate(()=>{setUiLanguage('en');const fixture=document.createElement('section');fixture.id='localizationSafetyFixture';fixture.innerHTML=`<label id="fixedCaption">ثبت هزینه</label><input id="observedCaption" placeholder="عنوان هزینه" aria-label="جهت چاپ"><input id="savedInput" value="ثبت هزینه"><textarea id="savedNote">گزارش‌ها</textarea><div contenteditable="true">داشبورد</div><div data-no-i18n>هزینه‌ها</div><div class="tm-business-name">داشبورد</div><article class="widget-history-row"><button>ثبت هزینه</button><span class="sub">گزارش‌ها</span></article><table><tr><td><b>داشبورد</b></td></tr></table><select id="storedDateMode"><option>شمسی</option><option>میلادی</option></select><select id="svCategory"><option>ثبت هزینه</option></select><select class="er-category"><option>گزارش‌ها</option></select><select class="pack-level-parent"><option value="custom">تومان</option></select><select onchange="setInvoiceTemplateForInvoice('fixture',this.value)"><option value="custom">داشبورد</option></select><img class="catalog-thumb" alt="ثبت هزینه">`;document.body.appendChild(fixture)});
   await page.waitForFunction(()=>document.getElementById('fixedCaption').textContent==='Add expense');
   assert.deepEqual(await page.locator('#storedDateMode option').evaluateAll(es=>es.map(e=>e.value)),['شمسی','میلادی']);
   for(const [selector,expected]of [['#savedInput','ثبت هزینه'],['#savedNote','گزارش‌ها']])assert.equal(await page.locator(selector).inputValue(),expected);
   assert.equal(await page.locator('#svCategory option').textContent(),'ثبت هزینه');assert.equal(await page.locator('.er-category option').textContent(),'گزارش‌ها');
   assert.equal(await page.locator('#localizationSafetyFixture .widget-history-row button').textContent(),'ثبت هزینه');assert.equal(await page.locator('#localizationSafetyFixture img').getAttribute('alt'),'ثبت هزینه');
   await page.evaluate(()=>{document.getElementById('observedCaption').placeholder='نام خدمت';document.getElementById('fixedCaption').firstChild.nodeValue='شماره فاکتور'});
   await page.waitForFunction(()=>document.getElementById('observedCaption').placeholder==='Service name');
   assert.equal(await page.locator('#fixedCaption').textContent(),'Invoice number');
   await page.evaluate(()=>setUiLanguage('ar'));assert.equal(await page.locator('#observedCaption').getAttribute('placeholder'),'اسم الخدمة');
   await page.evaluate(()=>setUiLanguage('fa'));assert.equal(await page.locator('#observedCaption').getAttribute('placeholder'),'نام خدمت');assert.equal(await page.locator('#fixedCaption').textContent(),'شماره فاکتور');
   assert.deepEqual(await page.locator('#storedDateMode option').allTextContents(),['شمسی','میلادی']);
   await page.evaluate(()=>{setUiLanguage('en');go('finance');tameshkFinanceEdit('credit','sale')});
   const spinnerLabels=await page.locator('#modalInner .calendar-time-spinner').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
   assert.ok(spinnerLabels.length>0);assert.ok(spinnerLabels.every(label=>label.endsWith('Choose hour, minute, and second')));
   await page.close();
  });
 }finally{await browser.close()}
});
