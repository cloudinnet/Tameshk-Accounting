'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
let playwright;
try{playwright=require(process.env.TAMESHK_PLAYWRIGHT_CORE||process.env.TAMESHK_PLAYWRIGHT||'playwright-core')}catch(_){}
const audit=[];
async function isolated(browser,query=''){
 const page=await browser.newPage();page.setDefaultTimeout(10000);
 await page.addInitScript(()=>{
  class Storage{constructor(){this.values=new Map()}getItem(k){return this.values.get(String(k))??null}setItem(k,v){this.values.set(String(k),String(v))}removeItem(k){this.values.delete(String(k))}clear(){this.values.clear()}get length(){return this.values.size}key(i){return [...this.values.keys()][i]??null}}
  Object.defineProperty(window,'localStorage',{value:new Storage});Object.defineProperty(window,'sessionStorage',{value:new Storage});
 });
 await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href+query,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.TameshkDesktopWidget&&window.TameshkReturnsManagement&&window.tameshkFinanceTab);
 await page.evaluate(()=>{window.tameshkDesktop={log(){},saveInvoicePdf:async()=>({success:true})}});
 await page.evaluate(()=>{closeModal();document.getElementById('profileOverlay')?.remove()});
 return page;
}
async function seed(page,language){await page.evaluate(language=>{
 state.settings.language=language;state.settings.currency='IRT';state.settings.currencyDecimals=0;
 for(const key of Object.keys(state.settings.featureOptions||{}))state.settings.featureOptions[key]=false;
 state.settings.invoiceNote='هزینه خالص';state.settings.business='هزینهٔ جانبی';
 state.categories=['دسته','هزینه خالص'];
 state.products=[{id:'loc-product',name:'هزینهٔ جانبی',category:'دسته',unit:'تومان',baseUnit:'تومان',stock:24,price:12.25,cost:5.5,packUnits:[{id:'loc-pack',name:'بستهٔ بدون نام',parentId:'base',qtyInParent:6,baseQty:6}],history:[],locations:[]}];
 state.services=[{id:'loc-service',name:'نرخ خدمت',serviceNumber:'S-000001',catalogType:'service',serviceType:'خدمت',category:'دسته',unit:'تومان',price:12.25,cost:1,ancillaryPrice:2,stock:10,stockUnlimited:false,active:true,history:[]}];
 state.transactions=[{id:'loc-tx',no:'LOC-1',date:'2026-10-11',customer:'هزینه خالص',note:'نسخهٔ بایگانی',discount:0,tax:0,items:[{name:'هزینهٔ جانبی',productId:'loc-product',unit:'تومان',qty:1,price:12.25}]}];
 state.expenses=[{id:'loc-expense',title:'هزینه خالص',name:'هزینه خالص',date:'2026-10-11',category:'دسته',amount:20.25,note:'ثبت برگشت'}];
 state.expenseReturns=[{id:'loc-expense-return',expenseId:'loc-expense',amount:2,date:'2026-10-11',note:'هزینه خالص',expectedAt:'2026-10-12T12:00:00.000Z',receivedAt:'',cash:false}];
 state.warehouses=[{id:'loc-warehouse',code:'LOC',name:'انتخاب انبار',sections:2,shelves:2}];state.inventoryReturns=[];
 state.installments=[{id:'loc-active',chainId:'loc-chain',kind:'sale',party:'نسخهٔ بایگانی',total:40,version:2,active:true,createdAt:'2026-10-11T12:00:00.000Z',startDate:'2026-10-11',cadence:'monthly',parts:[{id:'loc-part',amount:20,due:'2026-11-11',status:'unpaid'},{id:'loc-paid',amount:20,due:'2026-10-11',status:'paid',paidAt:'2026-10-11T12:00:00.000Z'}]},{id:'loc-archived',chainId:'loc-chain',kind:'sale',party:'نسخهٔ بایگانی',total:40,version:1,active:false,archived:true,parts:[{id:'loc-old-part',amount:40,due:'2026-11-11',status:'unpaid'}]},{id:'loc-purchase',chainId:'loc-purchase-chain',kind:'purchase',party:'هزینه خالص',total:20,version:1,active:true,parts:[{id:'loc-purchase-part',amount:20,due:'2026-11-11',status:'unpaid'}]}];
 state.creditRecords=[{id:'loc-credit',party:'تسویه',kind:'sale',total:20,lines:[]}];
 state.entrustments=[{id:'loc-entrust',direction:'deposited',name:'سپرده‌شده',value:20,recipients:'انتخاب انبار',at:'2026-10-11T12:00:00.000Z'}];
 window.__localizationFixtureSnapshot=JSON.stringify({products:state.products,services:state.services,transactions:state.transactions,expenses:state.expenses,expenseReturns:state.expenseReturns,warehouses:state.warehouses});
 setUiLanguage(language);
 },language)}
async function capture(page,language,route,root='#content'){
 await page.evaluate(()=>applyUiLanguage());await page.waitForTimeout(40);
 const result=await page.evaluate(root=>{
  const host=document.querySelector(root);if(!host)return {missing:root};
  const persian=/[پچژگکی]/;const fixed=[];
  for(const el of host.querySelectorAll('label,button,th,h1,h2,h3,.notice,.fin-note,input[placeholder],select option')){
   if(el.closest('[data-no-i18n],.tm-value,.tm-business-name,.widget-history-row'))continue;
   let text=el.matches('input')?el.placeholder:el.textContent.trim();
   if(el.matches('option')&&el.closest('select')?.matches('#pCat,#svCategory,#stockUnit,.item-cat,.item-unit,.ex-cat,.er-category,.er-cat,.er-warehouse,.wh-slot-warehouse,.pack-level-parent,#erExpense,#tmDefaultFont,[onchange*="updateInvoiceFieldStyle"]'))continue;
   if(persian.test(text))fixed.push({tag:el.tagName,id:el.id,cls:el.className,text});
  }
  return {residual:fixed};
 },root);assert.ok(!result.missing,`${route}: actual root must exist`);if(root==='#modalInner')assert.ok(await page.locator('#modalInner h2').count(),`${route}: actual modal title must exist`);audit.push({language,route,...result});
 // User-owned values and the language's native name are deliberately Persian.
 // The fixture deliberately collides with dictionary keys; these are not leaks.
 if(language!=='fa')assert.deepEqual(result.residual.filter(x=>!['هزینه خالص','تمشک سبز','(Persian) پارسی','پارسی'].includes(x.text)&&!x.text.includes('نسخهٔ بایگانی')&&!x.text.startsWith('هزینه خالص · ')),[],`${language} ${route}: untranslated producer captions`);
 return result;
}
test('populated release 1.50.4 localization: actual forms, dialogs, selectors, widgets, and data collisions',{skip:!playwright},async t=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
 try{
  for(const language of ['en','ar','fa'])await t.test(`${language} populated main routes and modal captions`,async()=>{
   const page=await isolated(browser);await seed(page,language);
   for(const route of ['new','transactions','expenses','inventory','finance','settings']){await page.evaluate(route=>{closeModal();go(route)},route);await capture(page,language,route);}
   for(const sub of ['sales','purchases']){await page.evaluate(sub=>{go('finance');tameshkFinanceTab('installments');tameshkFinanceSub(sub)},sub);await capture(page,language,`finance-installments-${sub}`);assert.ok(await page.locator('table[data-tp-key^="finance-installment-"] tbody tr').count()>0,await page.locator('#content').innerText());}
   await page.evaluate(()=>{tameshkFinanceTab('entrust');tameshkFinanceSub('deposited')});await capture(page,language,'finance-entrusted-deposited');
   await page.evaluate(()=>go('new'));
   assert.equal(await page.locator('#txPaymentMethod option').nth(1).textContent(),language==='en'?'Cash':language==='ar'?'نقداً':'نقدی');
   assert.equal(await page.locator('#txPaymentMethod option').nth(1).evaluate(option=>option.value),'نقدی');
   await page.locator('.item-name').first().fill('هزینهٔ جانبی');await page.locator('.item-name').first().dispatchEvent('change');
   await page.waitForTimeout(40);
   assert.match(await page.locator('.item-stock').first().textContent(),language==='en'?/^Stock: .*تومان · equivalent .*تومان$/:language==='ar'?/^المخزون: .*تومان · يعادل .*تومان$/:/^موجودی: .*تومان · معادل .*تومان$/);
   assert.match(await page.locator('.item-unit option').first().textContent(),language==='en'?/^تومان · .* تومان per unit$/:language==='ar'?/^تومان · .* تومان لكل وحدة$/:/^تومان · .* تومان در هر واحد$/);
   assert.equal(await page.locator('.item-unit option').first().getAttribute('value'),'تومان');
   await page.evaluate(()=>go('transactions'));
   assert.ok((await page.locator('.search-field-picker option').allTextContents()).includes(language==='en'?'Add search field…':language==='ar'?'إضافة حقل بحث…':'افزودن فیلد جست‌وجو…'));
   const modals=[['product',()=>productModal('loc-product')],['stock',()=>stockModal('loc-product')],['service',()=>TameshkServices.edit('loc-service')],['expense-return',()=>tameshkExpenseReturn('loc-expense')],['warehouse',()=>tameshkWarehouseForm()],['inventory-return',()=>{go('inventory');document.querySelector('[data-return="loc-product"]').click()}],['inventory-locations',()=>{go('inventory');document.querySelector('[data-slots="loc-product"]').click()}],['inventory-batch',()=>TameshkInventoryManagement.openEntry()],['installment-new',()=>tameshkFinanceEdit('installment','sale')],['installment-version',()=>tameshkFinanceEdit('installment','sale','loc-active')],['installment-archived',()=>tameshkFinanceViewInstallment('loc-archived')],['installment-edit-part',()=>tameshkFinanceEditPart('loc-active',0)],['installment-settle',()=>tameshkFinancePay('loc-active',0)],['entrusted-deposited',()=>tameshkFinanceEdit('entrust','deposited','loc-entrust')]];
   for(const [name,fn] of modals){
    await page.evaluate(()=>{closeModal();document.getElementById('modalInner').innerHTML=''});
    try{await page.evaluate(fn);await capture(page,language,name,'#modalInner')}
    catch(error){audit.push({language,route:name,error:error.message});throw error}
   }
   await page.evaluate(()=>productModal('loc-product'));
   assert.equal(await page.locator('.pack-level-name').first().inputValue(),'بستهٔ بدون نام');
   assert.equal(await page.locator('.pack-level-parent option[value="base"]').first().textContent(),language==='en'?'Base unit (تومان)':language==='ar'?'الوحدة الأساسية (تومان)':'واحد پایه (تومان)');
   assert.equal(await page.locator('#pName').inputValue(),'هزینهٔ جانبی');assert.equal(await page.locator('#pCat').inputValue(),'دسته');
   await page.evaluate(()=>TameshkServices.edit('loc-service'));
   assert.equal(await page.locator('#svType').inputValue(),'خدمت');assert.equal(await page.locator('#svUnit').inputValue(),'تومان');
   assert.equal(await page.locator('#svCategory option').first().textContent(),'دسته');
   await page.evaluate(()=>{closeModal();go('settings')});
   assert.ok((await page.locator('#tmPreview').textContent()).includes('هزینهٔ جانبی'));
   assert.equal(await page.evaluate(()=>state.transactions[0].customer),'هزینه خالص');
   assert.equal(await page.evaluate(()=>state.settings.invoiceNote),'هزینه خالص');
   // Rendering may normalize optional product metadata; assert every real string
   // separately rather than treating producer normalization as a translation.
   assert.deepEqual(await page.evaluate(()=>[state.products[0].name,state.products[0].unit,state.products[0].packUnits[0].name,state.services[0].name,state.services[0].serviceType,state.expenses[0].title,state.warehouses[0].name]),['هزینهٔ جانبی','تومان','بستهٔ بدون نام','نرخ خدمت','خدمت','هزینه خالص','انتخاب انبار']);
   await page.close();
  });
  for(const language of ['en','ar','fa'])for(const route of ['invoice','history','transaction'])await t.test(`${language} actual ${route} widget retains collisions`,async()=>{
   const page=await isolated(browser,`?tameshkPanel=${route}&record=loc-tx`);await seed(page,language);await page.evaluate(()=>render());
   if(route==='invoice')await page.evaluate(()=>showInvoice('loc-tx',false));
   await capture(page,language,`widget-${route}`,route==='invoice'?'#modalInner':'body');
   assert.equal(await page.evaluate(()=>state.transactions[0].customer),'هزینه خالص');
   assert.equal(await page.evaluate(()=>state.products[0].unit),'تومان');await page.close();
  });
  await t.test('selected currency is independent of language; canonical observer caches refresh and data stays exact',async()=>{
   const page=await isolated(browser);await seed(page,'en');
   // The helper is mocked here to isolate localization from currency formatting
   // and state migration tests owned by the monetary worker.
   await page.evaluate(()=>{window.__fixtureSymbol='تومان';window.__savedCurrencyHelper=window.TameshkCurrency;const format=n=>new Intl.NumberFormat(state.settings.language==='fa'?'fa-IR':state.settings.language==='ar'?'ar-SA':'en-US').format(Number(n)||0);window.TameshkCurrency={format,amount:format,round:n=>Number(n)||0,...window.TameshkCurrency,symbol:()=>window.__fixtureSymbol};const el=document.createElement('section');el.id='currencyLocalizationFixture';el.innerHTML='<label>فی (تومان)</label><b>12.25 تومان</b><input placeholder="قیمت فروش (تومان)" value="تومان"><span data-no-i18n>تومان</span><textarea>هزینه 12.25 تومان</textarea>';document.body.appendChild(el);applyUiLanguage()});
   assert.equal(await page.locator('#currencyLocalizationFixture b').textContent(),'12.25 تومان');
   for(const [language,symbol] of [['en','تومان'],['fa','$'],['ar','$'],['en','ريال'],['fa','تومان']]){
    await page.evaluate(([language,symbol])=>{window.__fixtureSymbol=symbol;setUiLanguage(language);applyUiLanguage()},[language,symbol]);
    assert.equal(await page.locator('#currencyLocalizationFixture label').textContent(),`${language==='en'?'Unit price':language==='ar'?'سعر الوحدة':'فی'} (${symbol})`);
    assert.equal(await page.locator('#currencyLocalizationFixture b').textContent(),`12.25 ${symbol}`);
    assert.equal(await page.locator('#currencyLocalizationFixture input').inputValue(),'تومان');assert.equal(await page.locator('#currencyLocalizationFixture textarea').inputValue(),'هزینه 12.25 تومان');assert.equal(await page.locator('#currencyLocalizationFixture [data-no-i18n]').textContent(),'تومان');
   }
   await page.close();
  });
 }finally{await browser.close();if(process.env.TAMESHK_LOCALIZATION_AUDIT)fs.writeFileSync(process.env.TAMESHK_LOCALIZATION_AUDIT,JSON.stringify(audit,null,2));}
});
