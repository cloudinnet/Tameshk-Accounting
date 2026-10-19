'use strict';
// NODE_PATH=/tmp/tameshk-current/node_modules node --test currency-recovered-1506.test.cjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http');
const inApp=fs.existsSync(path.join(__dirname,'index.html'));
const app=process.env.TAMESHK_APP_DIR||(inApp?__dirname:path.resolve(__dirname,'../project/resources/app'));
const artifacts=process.env.TAMESHK_CURRENCY_ARTIFACTS||(inApp?path.join(require('node:os').tmpdir(),'currency-recovered-1506'):__dirname);
function boot(settings){const c={state:{settings},Intl,console,save(){},render(){}};c.window=c;vm.createContext(c);for(const name of ['currency-locale-1.50.4.js','currency-records-1.50.6.js'])vm.runInContext(fs.readFileSync(path.join(app,name),'utf8'),c,{filename:name});return c;}
test('migration uses the target profile, including untagged/partially tagged linked sources, not the active profile',()=>{
 const c=boot({currency:'SAR',currencyDecimals:0,language:'ar'});
 const target={settings:{currency:'USD',currencyDecimals:4},expenses:[{id:'e',amount:1.234567,financeSource:'charity',financeRecordId:'c'}],charityRecords:[{id:'c',amount:1.234567}],transactions:[{id:'t',items:[{price:2.345678,qty:1}]}],installments:[{id:'i',total:1.2345,parts:[{amount:1.2345}]}]};
 assert.equal(c.TameshkCurrencyRecords1506.migrate(target),true);
 for(const r of [target.expenses[0],target.charityRecords[0],target.transactions[0],target.transactions[0].items[0],target.installments[0].parts[0]]){assert.equal(r.currency,'USD');assert.equal(r.currencyDecimals,4)}
 assert.equal(target.expenses[0].amount,1.234567);const before=JSON.stringify(target);assert.equal(c.TameshkCurrencyRecords1506.migrate(target),false);assert.equal(JSON.stringify(target),before);
 const partial={settings:{currency:'IRT',currencyDecimals:3},expenses:[{id:'e',financeSource:'charity',financeRecordId:'c'}],charityRecords:[{id:'c',currency:'USD'}]};c.TameshkCurrencyRecords1506.migrate(partial);assert.equal(partial.expenses[0].currency,'USD');assert.equal(partial.expenses[0].currencyDecimals,3);
 const reordered={settings:{currency:'USD',currencyDecimals:4},expenses:[{id:'adjustment',amount:-0.1,returnRecordId:'r'},{id:'original',amount:1.2345}],expenseReturns:[{id:'r',expenseId:'original',amount:0.1}]};c.TameshkCurrencyRecords1506.migrate(reordered);assert.equal(reordered.expenses[0].currency,'USD');assert.equal(reordered.expenses[0].currencyDecimals,4);
});
test('record amounts, precision, grouping and localized currency names stay independent of UI configuration',()=>{
 const c=boot({currency:'USD',currencyDecimals:2,language:'en'}),C=c.TameshkCurrency;
 const rows=[C.snapshot({amount:1.2345}),C.snapshot({amount:200},{currency:'IRT',currencyDecimals:0}),C.snapshot({amount:3.125},{currency:'SAR',currencyDecimals:3}),C.snapshot({amount:0.0001},{currency:'USD',currencyDecimals:4})],before=JSON.stringify(rows);
 for(const lang of ['fa','en','ar'])for(const currency of ['USD','IRT','SAR'])for(const d of [0,2,4]){c.state.settings.language=lang;assert.ok(C.setConfig(currency,d));assert.equal(C.config(rows[0]).currency,'USD');assert.equal(C.format(rows[0].amount,rows[0]),new Intl.NumberFormat({fa:'fa-IR',en:'en-US',ar:'ar-SA'}[lang],{minimumFractionDigits:2,maximumFractionDigits:2}).format(1.23));assert.equal(JSON.stringify(rows),before)}
 const groups=C.groupTotals(rows);assert.equal(groups.length,3);assert.equal(groups.find(g=>g.currency==='USD').total,1.2346);assert.equal(groups.find(g=>g.currency==='USD').currencyDecimals,4);
 assert.match(C.label('USD','fa'),/دلار/);assert.match(C.label('SAR','en'),/Saudi/);assert.match(C.label('SAR','ar'),/ريال سعودي/);assert.equal(C.round(1.005,rows[0]),1.01);assert.equal(C.setConfig('EUR',2),false);
});
test('recovered runtime: profile migration, mixed entry persistence, refunds, reports, CSV and archive',{timeout:120000},async t=>{
 const {chromium}=require('playwright-core');fs.mkdirSync(artifacts,{recursive:true});
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]),p=path.resolve(app,'.'+(name==='/'?'/index.html':name));if(!p.startsWith(app+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(b)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 try{
 await page.addInitScript(()=>{if(localStorage.getItem('currency-test-seeded'))return;const base=(currency,currencyDecimals)=>({categories:['USER_CATEGORY'],products:[],transactions:[{id:'legacy',no:'LEGACY',date:'2026-10-01',items:[{name:'LEGACY_ITEM',qty:1,price:1.234567}],discount:0}],expenses:[{id:'legacy-expense',title:'LEGACY_EXPENSE',category:'USER_CATEGORY',date:'2026-10-01',amount:0.1234567}],settings:{currency,currencyDecimals,language:'en',transactionCalendar:'میلادی',reportCalendar:'میلادی',dateMode:'میلادی',business:'USER_BUSINESS',invoicePrintMarginMigration:'1.5.22'}});const a=base('USD',2),b=base('SAR',3);localStorage.setItem('tameshk-state',JSON.stringify(a));localStorage.setItem('tameshk-profile-usd',JSON.stringify(a));localStorage.setItem('tameshk-profile-sar',JSON.stringify(b));localStorage.setItem('tameshk-profiles-v1',JSON.stringify({version:1,activeId:'usd',defaultId:'usd',startupPicker:false,profiles:[{id:'usd',name:'USD_USER'},{id:'sar',name:'SAR_USER'}]}));localStorage.setItem('currency-test-seeded','1')});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.TameshkCurrencyRecords1506&&window.TameshkPortableData);await page.evaluate(()=>{TameshkStartup1506?.desktopReady();document.getElementById('profileOverlay')?.remove()});
 await t.test('each profile freezes its own legacy data without guessing or rounding',async()=>{
  const result=await page.evaluate(()=>{const a=structuredClone(state);tameshkSwitchProfile('sar');const b=structuredClone(state);tameshkSwitchProfile('usd');return{a,b,persisted:JSON.parse(localStorage.getItem('tameshk-profile-sar'))}});
  for(const [s,code,d]of [[result.a,'USD',2],[result.b,'SAR',3],[result.persisted,'SAR',3]]){assert.equal(s.transactions[0].currency,code);assert.equal(s.transactions[0].items[0].currencyDecimals,d);assert.equal(s.expenses[0].currency,code);assert.equal(s.transactions[0].items[0].price,1.234567);assert.equal(s.expenses[0].amount,0.1234567)}
 });
 const created=[];
 for(const [currency,decimals,price]of [['USD',2,12.3456],['IRT',0,2001],['SAR',3,31.2345]])await t.test(`${currency}: create sale, expense, charity, installment, check; refund after UI switch`,async()=>{
  const result=await page.evaluate(({currency,decimals,price})=>{
   TameshkCurrency.setConfig(currency,decimals);save();go('new');
   const set=(id,value)=>{const el=document.getElementById(id);if(!el)throw Error('Missing field '+id);el.value=String(value)},row=document.querySelector('.item-row');row.querySelector('.item-name').value='USER_'+currency;row.querySelector('.item-price').value=price;row.querySelector('.item-qty').value=2;saveTransaction(false);const tx=state.transactions.at(-1);
   expenseModal();document.querySelector('.ex-title').value='EXPENSE_'+currency;document.querySelector('.ex-price').value=price;saveExpense();const ex=state.expenses.at(-1);
   tameshkFinanceCharityEdit('');set('fin_charityBeneficiary','CHARITY_'+currency);set('fin_charityAmount',price);tameshkFinanceCharitySave('');const charity=state.charityRecords.at(-1);
   tameshkFinanceEdit('installment','sale','');set('fin_party','BUYER_'+currency);set('fin_total',price*2);set('fin_count',2);set('fin_start','2026-10-01');tameshkFinanceSaveInstallment('sale','');const plan=state.installments.at(-1);
   tameshkFinanceEdit('check','received','');for(const [id,v]of Object.entries({number:'CHECK_'+currency,amount:price,drawer:'DRAWER',drawerId:'ID1',payee:'PAYEE',payeeId:'ID2',lead:1,dueDate:'2026-10-20'}))set('fin_'+id,v);tameshkFinanceSaveCheck('received','');const check=state.checks.at(-1);
   TameshkCurrency.setConfig(currency==='USD'?'IRT':'USD',4);save();tameshkReturnInvoiceLine(tx.id,0);set('rmQty',1);set('rmAmount',1);tameshkSubmitTransactionReturn(tx.id,0);const refund=state.transactionReturns.at(-1);
   tameshkExpenseReturn(ex.id);set('erAmount',0.1);tameshkCreateExpenseReturn();const exReturn=state.expenseReturns.at(-1),adjustment=state.expenses.find(e=>e.returnRecordId===exReturn.id);
   save();return{tx,ex,charity,plan,check,refund,exReturn,adjustment,persisted:JSON.parse(localStorage.getItem('tameshk-profile-usd'))};
  },{currency,decimals,price});
  for(const name of ['tx','ex','charity','plan','check','refund','exReturn','adjustment']){assert.ok(result[name],name);assert.equal(result[name].currency,currency,name);assert.equal(result[name].currencyDecimals,decimals,name)}
  for(const part of result.plan.parts){assert.equal(part.currency,currency);assert.equal(part.currencyDecimals,decimals)}
  assert.equal(result.tx.items[0].price,price);assert.equal(result.ex.amount,price);assert.equal(result.adjustment.amount,-0.1);assert.equal(result.refund.refundAmount,1);
  assert.equal(result.persisted.transactions.find(x=>x.id===result.tx.id).currency,currency);created.push({currency,decimals,price,txId:result.tx.id,exId:result.ex.id,planId:result.plan.id});
 });
 await t.test('FA/EN/AR report scopes, rows and CSV exclude incompatible currencies and preserve history',async()=>{
  assert.equal(created.length,3,'mixed entries must have been created');const before=await page.evaluate(()=>JSON.stringify({tx:state.transactions,ex:state.expenses,plans:state.installments,returns:state.transactionReturns}));
  for(const language of ['fa','en','ar'])for(const entry of created){const result=await page.evaluate(({language,currency})=>{setUiLanguage(language);TameshkCurrency.setConfig('SAR',0);save();go('reports');document.getElementById('reportFrom').value='2000-01-01';document.getElementById('reportTo').value='2099-12-31';document.getElementById('reportCurrency').value=currency;renderReport();const d=reportData();let csv='';const prior=window.download;window.download=(contents)=>{csv=contents};exportCSV();window.download=prior;return{d,html:document.getElementById('reportResult').innerHTML,summary:document.querySelector('.selected-period-summary')?.textContent,csv,symbol:TameshkCurrency.symbol({currency}),labels:[...document.getElementById('reportCurrency').options].map(x=>x.textContent)}},{language,currency:entry.currency});assert.ok(result.d.tx.length);assert.ok(result.d.tx.every(x=>x.currency===entry.currency));assert.ok(result.d.ex.every(x=>x.currency===entry.currency));assert.ok(result.html.includes(result.symbol));assert.ok(result.summary.includes(result.symbol));assert.ok(result.csv.includes(entry.currency));for(const other of created.filter(x=>x.currency!==entry.currency))assert.ok(!result.csv.includes('USER_'+other.currency));assert.ok(result.labels.every(x=>x.includes('(')))}
  assert.equal(await page.evaluate(()=>JSON.stringify({tx:state.transactions,ex:state.expenses,plans:state.installments,returns:state.transactionReturns})),before);
 });
 await t.test('reload retains exact historical data',async()=>{
  const before=await page.evaluate(()=>JSON.stringify({tx:state.transactions,ex:state.expenses,plans:state.installments,returns:state.transactionReturns}));
  await page.reload();await page.waitForFunction(()=>window.TameshkCurrencyRecords1506);await page.evaluate(()=>{TameshkStartup1506?.desktopReady();document.getElementById('profileOverlay')?.remove();go('settings')});
  assert.equal(await page.evaluate(()=>JSON.stringify({tx:state.transactions,ex:state.expenses,plans:state.installments,returns:state.transactionReturns})),before);
 });
 await t.test('settings-only import accepts native saved non-product sale lines',async()=>{
  const before=await page.evaluate(()=>JSON.stringify({tx:state.transactions,ex:state.expenses,plans:state.installments,returns:state.transactionReturns}));
  const input=page.locator('input[onchange="tameshkImportSettings(this)"]');assert.equal(await input.count(),1);
  await page.evaluate(()=>{window.__currencyToasts=[];const prior=showToast;window.showToast=function(s){__currencyToasts.push(s);return prior.apply(this,arguments)}});
  const settings=await page.evaluate(()=>({...structuredClone(state.settings),language:'en',currency:'IRT',currencyDecimals:0}));await input.setInputFiles({name:'settings.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:'tameshk.settings',version:1,settings}))});
  await page.waitForFunction(()=>__currencyToasts.length>0);assert.equal(await page.evaluate(()=>state.settings.currency),'IRT',await page.evaluate(()=>__currencyToasts.join('\n')));
  assert.equal(await page.evaluate(()=>JSON.stringify({tx:state.transactions,ex:state.expenses,plans:state.installments,returns:state.transactionReturns})),before);
 });
 await t.test('legacy backup validator accepts legitimate expense-return adjustments',async()=>{
  const result=await page.evaluate(()=>{const candidate=structuredClone(state);for(const tx of candidate.transactions)for(const line of tx.items||[])if(line.productId===null)delete line.productId;try{validateBackupState(candidate);return{error:null}}catch(e){return{error:e.message}}});fs.writeFileSync(path.join(artifacts,'negative-adjustment-backup-reproduction.json'),JSON.stringify(result,null,2));assert.equal(result.error,null);
 });
 await t.test('backup validation rejects malformed or unlinked negative adjustments without mutating records',async()=>{
  const result=await page.evaluate(()=>{
   const baseline=structuredClone(state),adjustmentId=baseline.expenses.find(e=>e.amount<0).id;
   const cases=[],probe=(name,change)=>{const data=structuredClone(baseline),a=data.expenses.find(e=>e.id===adjustmentId),r=data.expenseReturns.find(r=>r.id===a.returnRecordId),original=data.expenses.find(e=>e.id===r.expenseId);change(data,a,r,original);const before=JSON.stringify(data);try{validateBackupState(data);cases.push({name,rejected:false,unchanged:JSON.stringify(data)===before})}catch(e){cases.push({name,rejected:true,unchanged:JSON.stringify(data)===before,error:e.message})}};
   probe('missing relationship',(d,a)=>delete a.returnRecordId);
   probe('unknown return',(d,a)=>a.returnRecordId='unknown');
   probe('return array absent',d=>delete d.expenseReturns);
   probe('unknown original',(d,a,r)=>r.expenseId='unknown');
   probe('wrong category',(d,a)=>a.category='OTHER');
   probe('mismatched adjustment',(d,a)=>a.amount-=1);
   probe('positive adjustment',(d,a)=>a.amount=-a.amount);
   probe('wrong date',(d,a)=>a.date='2026-01-01');
   probe('invalid return date',(d,a,r)=>{a.date=r.returnDate='2026-02-30'});
   probe('return amount string',(d,a,r)=>r.amount=String(r.amount));
   probe('negative return amount',(d,a,r)=>r.amount=-r.amount);
   probe('nonfinite adjustment',(d,a)=>a.amount=-Infinity);
   probe('different return currency',(d,a,r)=>r.currency=r.currency==='USD'?'IRT':'USD');
   probe('different adjustment precision',(d,a)=>a.currencyDecimals=a.currencyDecimals===4?0:4);
   probe('duplicate adjustment',d=>d.expenses.push({...d.expenses.find(e=>e.id===adjustmentId),id:'duplicate-adjustment'}));
   probe('duplicate return',(d,a,r)=>d.expenseReturns.push({...r}));
   probe('duplicate original',(d,a,r,o)=>d.expenses.push({...o}));
   probe('over-refunded original',(d,a,r,o)=>{a.amount=-(o.amount+1);r.amount=o.amount+1});
   const before=JSON.stringify(baseline),validated=validateBackupState(baseline),multi=structuredClone(baseline),first=multi.expenses.find(e=>e.id===adjustmentId),returned=multi.expenseReturns.find(r=>r.id===first.returnRecordId);multi.expenseReturns.push({...returned,id:'second-valid-return',amount:0.2});multi.expenses.push({...first,id:'second-valid-adjustment',returnRecordId:'second-valid-return',amount:-0.2});const multiple=validateBackupState(multi);return{cases,unchanged:JSON.stringify(baseline)===before,amounts:validated.expenses.map(e=>e.amount),originalAmounts:baseline.expenses.map(e=>e.amount),multipleAmount:multiple.expenses.find(e=>e.id==='second-valid-adjustment').amount};
  });
  fs.writeFileSync(path.join(artifacts,'negative-adjustment-validation.json'),JSON.stringify(result,null,2));for(const c of result.cases){assert.equal(c.rejected,true,c.name);assert.equal(c.unchanged,true,c.name)}assert.equal(result.unchanged,true);assert.deepEqual(result.amounts,result.originalAmounts);assert.equal(result.multipleAmount,-0.2);
 });
 await t.test('settings-only import on valid legacy profile preserves record currency and exact amount',async()=>{
  await page.evaluate(()=>{tameshkSwitchProfile('sar');go('settings');window.__currencyToasts=[]});const before=await page.evaluate(()=>JSON.stringify([state.transactions,state.expenses])),settings=await page.evaluate(()=>({...structuredClone(state.settings),language:'fa',currency:'IRT',currencyDecimals:0}));await page.locator('input[onchange="tameshkImportSettings(this)"]').setInputFiles({name:'settings.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:'tameshk.settings',version:1,settings}))});await page.waitForFunction(()=>__currencyToasts.length>0);assert.equal(await page.evaluate(()=>state.settings.currency),'IRT',await page.evaluate(()=>__currencyToasts.join('\n')));assert.equal(await page.evaluate(()=>JSON.stringify([state.transactions,state.expenses])),before);await page.evaluate(()=>tameshkSwitchProfile('usd'));
 });
 await t.test('entrustment create/edit snapshots currency before persistence',async()=>{
  const result=await page.evaluate(()=>{const set=(id,v)=>document.getElementById('fin_'+id).value=String(v);TameshkCurrency.setConfig('USD',2);save();tameshkFinanceEdit('entrust','received','');set('name','ENTRUST_USER');set('value',1.2345);set('at','2026-10-01T12:00');tameshkFinanceSaveEntrust('received','');const r=state.entrustments.at(-1),created=structuredClone(r),persisted=JSON.parse(localStorage.getItem('tameshk-profile-usd')).entrustments.find(x=>x.id===r.id);TameshkCurrencyRecords1506.persistMigration();TameshkCurrency.setConfig('IRT',0);save();tameshkFinanceEdit('entrust','received',r.id);set('name','ENTRUST_USER_EDITED');tameshkFinanceSaveEntrust('received',r.id);const edited=structuredClone(state.entrustments.find(x=>x.id===r.id));render();const afterRender=structuredClone(state.entrustments.find(x=>x.id===r.id));return{created,persisted,edited,afterRender}});
  fs.writeFileSync(path.join(artifacts,'entrustment-reproduction.json'),JSON.stringify(result,null,2));for(const name of ['created','persisted','edited','afterRender']){assert.equal(result[name].currency,'USD',name);assert.equal(result[name].currencyDecimals,2,name)}
 });
 await t.test('report precision includes finance-only synthetic sales',async()=>{
  const result=await page.evaluate(()=>{reportsPage(document.getElementById('content'));document.getElementById('reportFrom').value='2000-01-01';document.getElementById('reportTo').value='2099-12-31';document.getElementById('reportCurrency').value='USD';const prior=state.creditRecords;state.creditRecords=[...(prior||[]),{id:'tiny-finance',kind:'sale',party:'PRECISION_USER',total:0.0001,currency:'USD',currencyDecimals:4,createdAt:'2026-10-01T12:00:00Z',lines:[]}];const d=reportData();state.creditRecords=prior;return{precision:d.currencyRecord.currencyDecimals,financeSales:d.financeSales,formatted:TameshkCurrency.amount(0.0001,d.currencyRecord)}});fs.writeFileSync(path.join(artifacts,'finance-precision-reproduction.json'),JSON.stringify(result,null,2));assert.equal(result.precision,4);
 });
 await t.test('consolidated same-currency invoice keeps maximum source precision',async()=>{
  const result=await page.evaluate(()=>{const base={customer:'SAME_USER',date:'2026-10-01',createdAt:'2026-10-01T12:00:00Z',discount:0,currency:'USD',items:[{name:'ITEM',qty:1,price:1}]};const a={...base,id:'ca',no:'CA',currencyDecimals:0},b={...base,id:'cb',no:'CB',currencyDecimals:4,items:[{name:'FRACTION',qty:1,price:0.0001}]},before=JSON.stringify([a,b]);const inv=buildConsolidatedInvoice([a,b]);let mixedRejected=false;try{buildConsolidatedInvoice([a,{...b,currency:'SAR'}])}catch{mixedRejected=true}return{precision:inv.currencyDecimals,total:inv.exactTotals.total,mixedRejected,unchanged:JSON.stringify([a,b])===before}});assert.equal(result.total,1.0001);assert.equal(result.precision,4);assert.equal(result.mixedRejected,true);assert.equal(result.unchanged,true);
 });
 await t.test('full archive preserves both profiles and explicit tags',async()=>{
  const download=page.waitForEvent('download');await page.evaluate(()=>TameshkPortableData.exportFull());const file=await download;const dest=path.join(artifacts,'mixed-currency-full-archive.json');await file.saveAs(dest);const archive=JSON.parse(fs.readFileSync(dest,'utf8'));assert.equal(archive.schema,'tameshk.full-data');assert.equal(archive.profiles.length,2);assert.equal(archive.profiles.find(p=>p.id==='sar').state.transactions[0].currency,'SAR');for(const e of created)assert.equal(archive.profiles.find(p=>p.id==='usd').state.transactions.find(x=>x.id===e.txId).currency,e.currency);
  await page.evaluate(()=>go('settings'));const reloaded=page.waitForEvent('load');await page.locator('input[onchange="tameshkImportFullData(this)"]').setInputFiles(dest);await reloaded;await page.waitForFunction(()=>window.TameshkCurrencyRecords1506);assert.deepEqual(await page.evaluate(()=>state.transactions.map(x=>[x.id,x.currency,x.currencyDecimals])),archive.profiles.find(p=>p.id==='usd').state.transactions.map(x=>[x.id,x.currency,x.currencyDecimals]));
 });
 fs.writeFileSync(path.join(artifacts,'runtime-state.json'),await page.evaluate(()=>JSON.stringify(state,null,2)));assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
});
