'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
let playwright;try{playwright=require(process.env.TAMESHK_PLAYWRIGHT_CORE||'playwright-core')}catch{}
test('dashboard icon direction and report controls belong to their own lists in all three languages',{skip:!playwright},async t=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
 try{for(const language of ['fa','en','ar'])await t.test(language,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  try{
   await page.addInitScript(()=>{class Storage{constructor(){this.values=new Map}getItem(k){return this.values.get(k)??null}setItem(k,v){this.values.set(k,String(v))}removeItem(k){this.values.delete(k)}clear(){this.values.clear()}}Object.defineProperty(window,'localStorage',{value:new Storage});Object.defineProperty(window,'sessionStorage',{value:new Storage})});
   await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
   await page.waitForFunction(()=>window.TameshkLocaleLayout1504&&window.TameshkWorkflow);
   await page.evaluate(language=>{closeModal();document.getElementById('profileOverlay')?.remove();setUiLanguage(language);go('dashboard')},language);
   for(const width of [1440,1024]){
    await page.setViewportSize({width,height:1000});
    const icons=await page.evaluate(()=>[...document.querySelectorAll('.stat-ico')].map(icon=>{
     const card=icon.closest('.stat').getBoundingClientRect(),i=icon.getBoundingClientRect(),label=icon.closest('.stat').querySelector('.label'),range=document.createRange();range.selectNodeContents(label);const rects=[...range.getClientRects()];
     return {left:i.left-card.left,right:card.right-i.right,overlap:rects.some(r=>r.left<i.right&&r.right>i.left&&r.top<i.bottom&&r.bottom>i.top)};
    }));
    assert.equal(icons.length,4);
    for(const icon of icons){assert.ok(Math.abs((language==='en'?icon.right:icon.left)-18)<2,JSON.stringify(icon));if(language==='en')assert.equal(icon.overlap,false,'English dashboard title must not be hidden behind its icon')}
    const quick=await page.evaluate(()=>[...document.querySelectorAll('.quick button')].map(button=>{const range=document.createRange();range.selectNodeContents(button.querySelector('span'));const r=range.getBoundingClientRect(),b=button.getBoundingClientRect();return {iconCenter:(r.left+r.right)/2,buttonCenter:(b.left+b.right)/2}}));
    assert.equal(quick.length,4);for(const icon of quick)assert.equal(icon.iconCenter<icon.buttonCenter,language==='en','Quick access icons mirror only in English');
   }
   await page.setViewportSize({width:1440,height:1000});
   await page.evaluate(()=>{
    TameshkCurrency.setConfig('USD',2);
    state.transactions=Array.from({length:21},(_,i)=>({id:'sales-'+i,no:'S-'+i,date:'2026-10-11',dateCalendar:'میلادی',customer:'Customer '+i,discount:0,taxOn:false,items:[{name:'Fixture service',unit:'custom',qty:1,price:10}],exactTotals:{subtotal:10,discount:0,tax:0,total:10}}));
    state.expenses=Array.from({length:21},(_,i)=>({id:'expenses-'+i,title:'Expense '+i,category:'custom',date:'2026-10-11',dateCalendar:'میلادی',amount:5}));state.creditRecords=[];state.installments=[];state.expenseReturns=[];
    go('reports');for(const[id,iso]of[['reportFrom','2026-10-10'],['reportTo','2026-10-12']]){const e=document.getElementById(id);e.dataset.iso=iso;e.dataset.snapshot=e.value=TameshkCalendar.format(iso,e.dataset.calendar)}document.getElementById('reportView').value='table';renderReport();
   });
   for(const mode of ['table','all','table']){
    await page.selectOption('#reportView',mode);
    await page.waitForSelector('[data-tp-controls-for="report-sales"] .tp-search');
    const geometry=await page.evaluate(()=>{
     const sales=document.querySelector('#reportResult [data-tp-key="report-sales"]'),expenses=document.querySelector('#reportResult [data-tp-key="report-expenses"]'),sc=document.querySelector('[data-tp-controls-for="report-sales"]'),ec=document.querySelector('[data-tp-controls-for="report-expenses"]'),expenseHeader=expenses.previousElementSibling;
     const rect=x=>({top:x.getBoundingClientRect().top,bottom:x.getBoundingClientRect().bottom});
     return {sales:rect(sales),salesControls:rect(sc),expenseHeader:rect(expenseHeader),expenses:rect(expenses),expenseControls:rect(ec),salesNext:sales.nextElementSibling===sc,expensesNext:expenses.nextElementSibling===ec,salesSearch:!!sc.querySelector('.tp-search'),expenseSearch:!!ec.querySelector('.tp-search'),counts:[sc,ec].map(x=>x.querySelector('.tp-count').textContent),duplicateControls:document.querySelectorAll('[data-tp-controls-for="report-sales"],[data-tp-controls-for="report-expenses"]').length};
    });
    assert.equal(geometry.salesNext,true);assert.equal(geometry.expensesNext,true);assert.equal(geometry.duplicateControls,2);
    assert.ok(geometry.salesControls.top>=geometry.sales.bottom-1);assert.ok(geometry.salesControls.bottom<=geometry.expenseHeader.top+1);
    assert.ok(geometry.expenseControls.top>=geometry.expenses.bottom-1);assert.equal(geometry.salesSearch,true);assert.equal(geometry.expenseSearch,true);
    const before=await page.evaluate(()=>JSON.stringify([state.transactions,state.expenses]));
    const salesControls=page.locator('[data-tp-controls-for="report-sales"]'),expenseControls=page.locator('[data-tp-controls-for="report-expenses"]');
    await salesControls.locator('.tp-search').fill('Customer 20');assert.equal(await page.locator('[data-tp-key="report-sales"] tbody tr').count(),1);
    assert.equal(await page.locator('[data-tp-key="report-expenses"] tbody tr').count(),15);
    await salesControls.locator('.tp-search').fill('');await salesControls.locator('.tp-page').last().click();assert.equal(await page.locator('[data-tp-key="report-sales"] tbody tr').count(),6);
    await expenseControls.locator('.tp-search').fill('Expense 20');assert.equal(await page.locator('[data-tp-key="report-expenses"] tbody tr').count(),1);
    await expenseControls.locator('.tp-search').fill('');assert.equal(await page.evaluate(()=>JSON.stringify([state.transactions,state.expenses])),before);
   }
   await page.evaluate(()=>go('settings'));
   await page.locator('[data-settings-tab="defaults"]').click();
   const structure=await page.evaluate(()=>({
    parent:document.getElementById('currencySettingsPanel').parentElement.dataset.settingsPanel,
    nested:!!document.querySelector('#featureVisibilityPanel #currencyChoice'),
    choices:document.querySelectorAll('#currencyChoice').length,
    heading:document.querySelector('#currencySettingsPanel h3').textContent,
    note:document.querySelector('#currencySettingsPanel .muted').textContent
   }));
   assert.equal(structure.parent,'defaults');assert.equal(structure.nested,false);assert.equal(structure.choices,1);
   assert.equal(structure.heading,({fa:'واحد پول و اعشار مبالغ',en:'Currency and decimal places',ar:'العملة والمنازل العشرية للمبالغ'})[language]);
   assert.ok(structure.note.length>20);
   const originalRecords=await page.evaluate(()=>JSON.stringify([state.transactions,state.expenses]));
   const featureChoices=await page.evaluate(()=>JSON.stringify(state.settings.featureOptions));
   await page.selectOption('#currencyChoice','SAR');await page.selectOption('#currencyDecimalsChoice','3');
   assert.equal(await page.evaluate(()=>TameshkSettingsDirty.hasUnsaved()),true);
   await page.locator('#saveCurrencySettings').click();
   assert.deepEqual(await page.evaluate(()=>TameshkCurrency.config()),{currency:'SAR',currencyDecimals:3});
   assert.equal(await page.evaluate(()=>TameshkSettingsDirty.hasUnsaved()),false);
   assert.equal(await page.evaluate(()=>JSON.stringify(state.settings.featureOptions)),featureChoices);
   assert.equal(await page.evaluate(()=>JSON.stringify([state.transactions,state.expenses])),originalRecords);
   await page.locator('#saveFeatureOptions').click();
   assert.deepEqual(await page.evaluate(()=>TameshkCurrency.config()),{currency:'SAR',currencyDecimals:3});
   await page.selectOption('#currencyChoice','USD');await page.selectOption('#currencyDecimalsChoice','2');
   await page.evaluate(()=>go('dashboard'));
   await page.locator('#unsavedSettingsDialog [data-choice="save"]').click();
   assert.deepEqual(await page.evaluate(()=>TameshkCurrency.config()),{currency:'USD',currencyDecimals:2});
   assert.equal(await page.evaluate(()=>JSON.stringify([state.transactions,state.expenses])),originalRecords);
   await page.evaluate(()=>{go('settings');selectInvoiceTemplate('classic');duplicateInvoiceTemplate();render()});
   const custom=await page.evaluate(()=>structuredClone(state.settings.invoiceTemplates.find(t=>t.id===state.settings.invoiceTemplate)));
   assert.equal(custom.name,'نسخهٔ کلاسیک');
   for(const selector of ['#template','#tmSelect']){
    const options=await page.locator(selector+' option').evaluateAll(nodes=>nodes.map(n=>({value:n.value,label:n.textContent})));
    assert.equal(options.length,4);assert.equal(new Set(options.map(x=>x.value)).size,4);
    assert.equal(options.find(x=>x.value===custom.id).label,({fa:'نسخهٔ کلاسیک · قابل‌ویرایش',en:'Classic · editable copy',ar:'كلاسيكي · نسخة قابلة للتعديل'})[language]);
   }
   assert.deepEqual(await page.evaluate(()=>state.settings.invoiceTemplates.find(t=>t.id===state.settings.invoiceTemplate)),custom);
   await page.evaluate(()=>{state.settings.invoiceTemplates.find(t=>t.id===state.settings.invoiceTemplate).name='قالب اختصاصی من';render()});
   assert.equal(await page.locator('#template option:checked').textContent(),'قالب اختصاصی من');
  }finally{await page.close()}
 })}finally{await browser.close()}
});
