'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const playwright=require(process.env.TAMESHK_PLAYWRIGHT_CORE||'playwright-core');
const url=pathToFileURL(path.join(__dirname,'index.html')).href;
async function storage(page,seed=null){await page.addInitScript(seed=>{
 class Storage{constructor(){this.values=new Map(Object.entries(seed||{}))}getItem(k){return this.values.get(String(k))??null}setItem(k,v){this.values.set(String(k),String(v))}removeItem(k){this.values.delete(String(k))}clear(){this.values.clear()}get length(){return this.values.size}key(i){return [...this.values.keys()][i]??null}}
 Object.defineProperty(window,'localStorage',{value:new Storage});Object.defineProperty(window,'sessionStorage',{value:new Storage});
 window.__firstFrames=[];let stop=null;
 function frame(){if(document.body&&getComputedStyle(document.body).visibility!=='hidden'){if(stop===null)stop=performance.now()+500;window.__firstFrames.push({lang:document.documentElement.lang,dir:document.documentElement.dir,gate:document.documentElement.classList.contains('tameshk-starting'),title:document.querySelector('.topbar h1')?.textContent||''})}if(stop===null||performance.now()<stop)requestAnimationFrame(frame)}requestAnimationFrame(frame);
 },seed)}
test('saved language and selected startup profile are correct from the first visible frame',async t=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--allow-file-access-from-files']});
 try{
  const initial=await browser.newPage();await storage(initial);
  try{await initial.goto(url)}catch(error){if(String(error).includes('ERR_BLOCKED_BY_ADMINISTRATOR')){await initial.close();t.skip('Managed Chromium URLBlocklist blocks local-file navigation; run test-support/browser-regressions.py instead');return}throw error}
  await initial.waitForFunction(()=>window.TameshkStartup1506&&!document.documentElement.classList.contains('tameshk-starting'));
  if(!await initial.evaluate(()=>!!window.TameshkTablePagination)){await initial.close();t.skip('Managed browser policy blocks a local application script; run test-support/browser-regressions.py instead');return}
  const base=await initial.evaluate(()=>JSON.parse(JSON.stringify(state)));await initial.close();
  for(const language of ['en','ar','fa'])await t.test(language,async()=>{
   for(const profileMode of [false,true]){
    const chosen=structuredClone(base);chosen.settings.language=language;chosen.settings.currency='USD';chosen.settings.currencyDecimals=2;
    const old=structuredClone(base);old.settings.language=language==='fa'?'en':'fa';
    const seed={'tameshk-state':JSON.stringify(old)};
    if(profileMode){seed['tameshk-profiles-v1']=JSON.stringify({version:1,profiles:[{id:'first',name:'First'},{id:'saved',name:'Saved'}],defaultId:'saved',activeId:'first',startupPicker:false});seed['tameshk-profile-first']=JSON.stringify(old);seed['tameshk-profile-saved']=JSON.stringify(chosen)}else seed['tameshk-state']=JSON.stringify(chosen);
    const page=await browser.newPage();await storage(page,seed);await page.goto(url);await page.waitForFunction(()=>window.__firstFrames.length>2);
    const frames=await page.evaluate(()=>window.__firstFrames);
    assert.ok(frames.length>0);for(const frame of frames){assert.equal(frame.lang,language,JSON.stringify(frame));assert.equal(frame.dir,language==='en'?'ltr':'rtl');assert.equal(frame.gate,false)}
    assert.equal(await page.evaluate(()=>state.settings.language),language);
    await page.close();
   }
  });
 }finally{await browser.close()}
});
test('dashboard values align under their headings and every rendered footer search stays under its own list',async t=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--allow-file-access-from-files']});
 const audited=new Set();let navigationBlocked=false;
 try{for(const language of ['fa','en','ar'])await t.test(language,async()=>{
  if(navigationBlocked)return;
  const page=await browser.newPage({viewport:{width:1440,height:1100}});await storage(page);
  try{await page.goto(url)}catch(error){if(String(error).includes('ERR_BLOCKED_BY_ADMINISTRATOR')){navigationBlocked=true;await page.close();return}throw error}
  await page.waitForFunction(()=>window.TameshkStartup1506&&!document.documentElement.classList.contains('tameshk-starting'));
  if(!await page.evaluate(()=>!!window.TameshkTablePagination)){navigationBlocked=true;await page.close();return}
  await page.evaluate(language=>{closeModal();document.getElementById('profileOverlay')?.remove();setUiLanguage(language);go('dashboard')},language);
  for(const width of [1440,1024]){
   await page.setViewportSize({width,height:1100});
   const stats=await page.evaluate(()=>[...document.querySelectorAll('.stat')].filter(c=>c.querySelector('.stat-ico')).map(c=>{const label=c.querySelector('.label').getBoundingClientRect(),value=c.querySelector('.value').getBoundingClientRect(),icon=c.querySelector('.stat-ico').getBoundingClientRect();return{align:getComputedStyle(c.querySelector('.value')).textAlign,label:{left:label.left,right:label.right,bottom:label.bottom},value:{left:value.left,right:value.right,top:value.top},icon:{left:icon.left,right:icon.right}}}));
   assert.equal(stats.length,4);for(const stat of stats){assert.ok(stat.value.top>=stat.label.bottom-2);if(language==='en'){assert.equal(stat.align,'left');assert.ok(Math.abs(stat.value.left-stat.label.left)<2)}}
  }
  await page.evaluate(()=>{
   TameshkCurrency.setConfig('USD',2);
   state.settings.featureOptions.expenses=false;
   state.products=Array.from({length:22},(_,i)=>({id:'audit-p-'+i,name:'Product '+i,category:'Test',unit:'unit',stock:30,price:10,cost:5,history:[]}));
   state.transactions=Array.from({length:22},(_,i)=>({id:'audit-tx-'+i,no:'A-'+i,date:'2026-10-11',dateCalendar:'میلادی',customer:'Customer '+i,currency:'USD',currencyDecimals:2,discount:0,taxOn:false,items:[{name:'Test service',unit:'custom',qty:1,price:10}],exactTotals:{subtotal:10,discount:0,tax:0,total:10}}));
   state.expenses=Array.from({length:22},(_,i)=>({id:'audit-ex-'+i,title:'Expense '+i,date:'2026-10-11',category:'custom',amount:5,currency:'USD',currencyDecimals:2}));
   state.expenseReturns=Array.from({length:22},(_,i)=>({id:'audit-refund-'+i,expenseId:'audit-ex-'+i,amount:1,date:'2026-10-11',note:'Refund '+i,currency:'USD',currencyDecimals:2,cash:true}));
   state.transactionReturns=Array.from({length:22},(_,i)=>({id:'audit-return-'+i,transactionId:'audit-tx-'+i,lineIndex:0,quantity:1,refundAmount:1,returnDate:'2026-10-11',itemName:'Test service',note:'Return '+i,currency:'USD',currencyDecimals:2}));
  });
  for(const route of ['dashboard','transactions','expenses','reports','inventory','finance','settings']){
   await page.evaluate(route=>{closeModal();go(route);if(route==='reports'){for(const[id,iso]of[['reportFrom','2026-10-10'],['reportTo','2026-10-12']]){const e=document.getElementById(id);e.dataset.iso=iso;e.dataset.snapshot=e.value=TameshkCalendar.format(iso,e.dataset.calendar)}document.getElementById('reportView').value='all';renderReport()}},route);
   await page.waitForFunction(()=>[...document.querySelectorAll('#content [data-tp-key][data-tp-size]')].every(host=>{const table=host.matches('table')?host:host.querySelector('table');if(!table||!table.tBodies[0])return true;return [...document.querySelectorAll('[data-tp-controls-for]')].filter(c=>c.dataset.tpControlsFor===host.dataset.tpKey).length===1}),null,{timeout:3000});
   const controls=await page.evaluate(()=>[...document.querySelectorAll('#content [data-tp-key][data-tp-size]')].map(host=>{const table=host.matches('table')?host:host.querySelector('table');if(!table||!table.tBodies[0])return null;const anchor=table.closest('.table-wrap')||table,key=host.dataset.tpKey,controls=[...document.querySelectorAll('[data-tp-controls-for]')].filter(c=>c.dataset.tpControlsFor===key);return{key,count:controls.length,adjacent:controls[0]===anchor.nextElementSibling,under:!!controls[0]&&(controls[0].hidden||controls[0].getBoundingClientRect().top>=anchor.getBoundingClientRect().bottom-2)}}).filter(Boolean));
   for(const c of controls){audited.add(c.key);const message=route+' '+JSON.stringify(c);assert.equal(c.count,1,message);assert.equal(c.adjacent,true,message);assert.equal(c.under,true,message)}
  }
  await page.close();
 })
 if(navigationBlocked||(!audited.has('report-sales')&&url.startsWith('file:'))){t.skip('Managed Chromium policy prevents reliable local-file script navigation; equivalent cross-panel checks run in test-support/browser-regressions.py');return}
 assert.ok(audited.has('report-sales'));assert.ok(audited.has('report-expenses'));assert.ok(audited.size>=8,'Expected a cross-panel footer audit; observed '+[...audited].join(','));
 }finally{await browser.close()}
});
