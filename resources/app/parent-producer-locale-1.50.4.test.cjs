'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const currency=require('./currency-locale-1.50.4.js'),notices=require('./notification-center.js');
for(const language of ['en','ar','fa'])for(const code of ['USD','SAR','IRT'])test(`due amounts: ${language}/${code} retain configured four decimals and preserve existing notes`,()=>{
 const old=global.state;
 try{
  global.state={settings:{language,currency:code,currencyDecimals:4,defaultDueWarningDays:30,notificationHistory:[{id:'old',type:'update',title:'Saved title',message:'یادداشت واقعی $ تومان',createdAt:'2020-01-01'}]},checks:[{id:'check',number:'چک شخصی',dueDate:'2026-10-12',status:'unpaid',amount:12.3456}],installments:[{id:'part',party:'نام واقعی',parts:[{id:'one',dueDate:'2026-10-12',status:'unpaid',amount:1.2345}]}]};
  const records=JSON.stringify([state.checks,state.installments]);
  state.checks[0].alertLeadDays=30;
  const recordsWithLead=JSON.stringify([state.checks,state.installments]);
  notices.recordDue(new Date('2026-10-11T12:00:00Z'));
  const due=state.settings.notificationHistory.filter(x=>x.type==='check'||x.type==='installment');
  assert.equal(due.length,2);assert.ok(due[0].message.includes(currency.amount(12.3456)));assert.ok(due[1].message.includes(currency.amount(1.2345)));
  assert.equal(state.settings.notificationHistory.find(x=>x.id==='old').message,'یادداشت واقعی $ تومان');
  assert.equal(JSON.stringify([state.checks,state.installments]),recordsWithLead);
 }finally{global.state=old}
});
let playwright;try{playwright=require(process.env.TAMESHK_PLAYWRIGHT_CORE||'playwright-core')}catch{}
test('browser: inventory synthetic unit, warehouse option values and rendered pagination digits remain independent of monetary precision',{skip:!playwright},async t=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
 try{for(const language of ['en','ar','fa'])await t.test(language,async()=>{
  const page=await browser.newPage();page.setDefaultTimeout(8000);
  try{
   await page.addInitScript(()=>{class Storage{constructor(){this.map=new Map}getItem(k){return this.map.get(k)??null}setItem(k,v){this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}clear(){this.map.clear()}}Object.defineProperty(window,'localStorage',{value:new Storage});Object.defineProperty(window,'sessionStorage',{value:new Storage})});
   await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
   await page.waitForFunction(()=>window.TameshkInventoryEntryEnhancements&&window.TameshkWorkflow&&window.TameshkServices);
   await page.evaluate(language=>{closeModal();document.getElementById('profileOverlay')?.remove();setUiLanguage(language);state.settings.currency='USD';state.settings.currencyDecimals=4;state.categories=['دسته شخصی'];state.products=[];state.warehouses=[{id:'wh-test',name:'انتخاب انبار',sectionCount:12,shelvesPerSection:13}];TameshkInventoryManagement.openEntry()},language);
   const unit=page.locator('.er-unit');
   assert.equal(await unit.inputValue(),{en:'Piece',ar:'قطعة',fa:'عدد'}[language]);
   await page.waitForSelector('.wme-wh',{state:'attached'});
   await page.locator('.wm-optional > summary').click();
   await page.locator('.wme-wh').selectOption('wh-test');
   const fmt=n=>new Intl.NumberFormat({en:'en-US',ar:'ar-SA',fa:'fa-IR'}[language],{maximumFractionDigits:6}).format(n);
   const section=await page.locator('.wme-section option[value="12"]').textContent();assert.ok(section.endsWith(fmt(12)));assert.equal(await page.locator('.wme-section option[value="12"]').getAttribute('value'),'12');
   assert.equal(await page.locator('.wme-wh option[value="wh-test"]').textContent(),'انتخاب انبار','real warehouse name is not translated');
   await page.locator('.er-name').fill('Fixture product');
   await page.locator('.er-qty').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))});
   await page.locator('.wme-wh').selectOption('');
   await page.evaluate(()=>tameshkSaveEntries());
   assert.equal(await page.evaluate(()=>state.products.at(-1).unit),'عدد','untouched translated synthetic unit saves original canonical value');
   await page.evaluate(()=>{state.services=Array.from({length:25},(_,i)=>({id:'page-'+i,name:'Fixture '+i,serviceNumber:'S-'+i,active:true,stockUnlimited:true,price:1,ancillaryPrice:0,unit:'custom',category:'custom',history:[]}));go('inventory')});
   await page.waitForSelector('[data-tp-controls-for="services-inventory"] .tp-count');
   const nav=page.locator('[data-tp-controls-for="services-inventory"]');assert.ok((await nav.locator('.tp-count').textContent()).startsWith(fmt(25)));assert.equal(await nav.locator('.tp-page').first().textContent(),fmt(1));
  }finally{await page.close()}
 })}finally{await browser.close()}
});
test('browser: actual first-run language initializes currency once and later language changes preserve money and records',{skip:!playwright},async t=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
 try{for(const language of ['en','ar','fa'])await t.test(language,async()=>{
  const page=await browser.newPage();
  try{
   await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
   await page.waitForSelector('#firstRunContinue');
   await page.locator(`input[name="firstRunLanguage"][value="${language}"]`).check();
   await page.locator('#firstRunContinue').click();
   assert.deepEqual(await page.evaluate(()=>TameshkCurrency.config()),{currency:{en:'USD',ar:'SAR',fa:'IRT'}[language],currencyDecimals:language==='en'?2:0});
   const result=await page.evaluate(()=>{
    TameshkCurrency.setConfig('SAR',4);state.expenses=[{id:'preserve',title:'یادداشت کاربر',amount:1.2345,date:'2026-10-11',category:'custom'}];save();render();
    const before=JSON.stringify(state.expenses);setUiLanguage('en');setUiLanguage('ar');setUiLanguage('fa');save();
    return {config:TameshkCurrency.config(),same:before===JSON.stringify(state.expenses),stored:JSON.parse(localStorage.getItem('tameshk-state')).settings};
   });
   assert.deepEqual(result.config,{currency:'SAR',currencyDecimals:4});assert.equal(result.same,true);
   assert.equal(result.stored.currency,'SAR');assert.equal(result.stored.currencyDecimals,4);
  }finally{await page.close()}
 })}finally{await browser.close()}
});
