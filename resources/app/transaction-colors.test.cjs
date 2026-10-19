'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function policy(state={transactions:[]}){
 const document={createElement:()=>({}),head:{appendChild(){}},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null};
 const window={document,state};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'transaction-invoice-output.js'),'utf8'),{window});return window.TameshkInvoiceOutput;
}
test('all line/whole combinations, invalid colors and unanimous-only group summaries',()=>{
 const p=policy();
 for(const [item,whole,want] of [['','',''],['#ff0000','','#ff0000'],['','#0000ff','#0000ff'],['#ff0000','#0000ff','#ff0000']])assert.equal(p.lineColor({backgroundColor:item},{backgroundColor:whole}),want);
 assert.equal(p.lineColor({backgroundColor:'url(x)'},{backgroundColor:'red'}),'');
 assert.equal(p.commonColor(['#ff0000','#0000ff']),'');assert.equal(p.commonColor(['#ff0000','']),'');assert.equal(p.commonColor(['#ff0000','#ff0000']),'#ff0000');assert.equal(p.commonColor([]),'');
 assert.equal(p.softColor('#ff0000'),'rgb(255, 209, 209)');
});
test('saved/legacy returns and aggregates resolve exact source lines without mutating data',()=>{
 const s={transactions:[{id:'t',backgroundColor:'#0000ff',items:[{backgroundColor:'#ff0000'},{backgroundColor:'#00ff00'}]}],consolidatedInvoices:[]};
 const inv={items:[{sourceTransactionId:'t'},{sourceTransactionId:'t'}]};s.consolidatedInvoices.push(inv);const before=JSON.stringify(s),p=policy(s);
 assert.equal(p.returnColor({transactionId:'t',lineIndex:0}),'#ff0000');assert.equal(p.returnColor({transactionId:'t',lineIndex:1}),'#00ff00');
 for(const lineIndex of [null,undefined,'',-1,0.5])assert.equal(p.returnColor({transactionId:'t',lineIndex}),'#0000ff');
 assert.equal(p.returnColor({transactionId:'missing',itemBackgroundColor:'#ff0000',sourceTransactionBackgroundColor:'#0000ff'}),'#ff0000');
 assert.equal(p.returnColor({transactionId:'missing',sourceTransactionBackgroundColor:'#0000ff'}),'#0000ff');assert.equal(p.returnColor({transactionId:'missing'}),'');
 assert.equal(p.aggregateLineColor(inv.items[0]),'#ff0000');assert.equal(p.aggregateLineColor(inv.items[1]),'#00ff00');
 assert.equal(p.aggregateLineColor({sourceTransactionId:'t',backgroundColor:''}),'#0000ff');
 assert.equal(p.aggregateLineColor({backgroundColor:'#ff0000',sourceTransactionBackgroundColor:'#0000ff'}),'#ff0000');
 assert.equal(p.aggregateLineColor({sourceTransactionBackgroundColor:'#0000ff'}),'#0000ff');assert.equal(p.aggregateLineColor({sourceTransactionId:'missing'}),'');
 assert.equal(JSON.stringify(s),before);
});
test('sales history uses only transaction color and clears stale legacy custom backgrounds',()=>{
 const s={transactions:[{id:'a',backgroundColor:'#0000ff',items:[{backgroundColor:'#ff0000'}]},{id:'b',items:[{backgroundColor:'#ff0000'}]}],settings:{recordAppearance:{highlights:{'transactions:b':'#00ff00'},defaultRows:{transactions:'#00ff00'}}}};
 const rows=s.transactions.map(t=>({dataset:{recordId:t.id},style:{value:'#00ff00',getPropertyValue(){return this.value},getPropertyPriority(){return''},setProperty(k,v){this.value=v},removeProperty(){this.value=''}}}));
 const document={createElement:()=>({}),head:{appendChild(){}},querySelector:()=>null,getElementById:()=>null,querySelectorAll:()=>[{querySelectorAll:()=>rows}]};
 const window={document,state:s};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'transaction-invoice-output.js'),'utf8'),{window});window.TameshkInvoiceOutput.softHistory();assert.equal(rows[0].style.value,'rgb(209, 209, 255)');assert.equal(rows[1].style.value,'');
});
test('new return saves source color snapshots without changing original invoice values',()=>{
 const transaction={id:'t',backgroundColor:'#0000ff',items:[{name:'Fixture',qty:2,price:100,backgroundColor:'#ff0000'}]},s={transactions:[transaction],products:[],expenses:[]},before=JSON.stringify(transaction);
 const fields={rmQty:{value:'1'},rmAmount:{value:'100'},rmDate:{value:'2026-10-10'},rmNote:{value:''},rmRestock:{checked:false}},window={document:{getElementById:id=>fields[id]}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'returns-management.js'),'utf8'),{window,state:s,save(){}});
 assert.equal(window.TameshkReturnsManagement.submitTransactionReturn('t',0),true);assert.equal(s.transactionReturns[0].itemBackgroundColor,'#ff0000');assert.equal(s.transactionReturns[0].sourceTransactionBackgroundColor,'#0000ff');assert.equal(s.transactionReturns[0].refundAmount,100);assert.equal(JSON.stringify(transaction),before);
});
let chromium;try{({chromium}=require(process.env.TAMESHK_PLAYWRIGHT||'/tmp/r21-browser/node_modules/playwright-core'))}catch{}
test('fixture browser: dashboard, reports, returns, aggregates, filtering, pagination and reload',{skip:!chromium||!fs.existsSync('/usr/bin/chromium'),timeout:90000},async()=>{
 const http=require('node:http'),server=http.createServer((req,res)=>{const file=path.join(__dirname,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(__dirname)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(b)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const date=new Date().toISOString().slice(0,10),combos=[['',''],['#ff0000',''],['','#0000ff'],['#ff0000','#0000ff']];
 const fixture={products:[],categories:['Fixture'],expenses:[],transactions:Array.from({length:24},(_,i)=>({id:'fixture-'+i,no:'F-'+i,date,createdAt:date+'T12:00:00.000Z',customer:'Fixture customer',address:'',note:'',discount:0,taxOn:false,backgroundColor:combos[i%4][1],items:[{name:'Fixture item '+i,qty:2,price:100,backgroundColor:combos[i%4][0]}]})),transactionReturns:Array.from({length:24},(_,i)=>({id:'return-'+i,transactionId:'fixture-'+i,lineIndex:0,itemName:'Fixture item '+i,quantity:1,refundAmount:100,returnDate:date,createdAt:date+'T12:00:00.000Z'})),expenseReturns:[],settings:{language:'en',transactionCalendar:'میلادی',reportCalendar:'میلادی',dateMode:'میلادی',featureOptions:{fieldStyle:false},recordAppearance:{highlights:{'transactions:fixture-0':'#00ff00'},defaultRows:{transactions:'#00ff00'}}}};
 await page.addInitScript(f=>{if(!localStorage.getItem('tameshk-state'))localStorage.setItem('tameshk-state',JSON.stringify(f))},fixture);
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.TameshkInvoiceOutput);await page.evaluate(()=>document.getElementById('profileOverlay')?.remove());
 const settled=()=>page.waitForTimeout(250);
 await page.evaluate(()=>go('dashboard'));await settled();assert.deepEqual(await page.locator('#content tr[data-record-id]').evaluateAll(rows=>rows.map(r=>r.style.backgroundColor).filter(Boolean)),[]);
 await page.evaluate(()=>go('transactions'));await settled();
 async function checkRows(selector,kind){const result=await page.locator(selector).evaluateAll((rows,kind)=>{const s=window.__tameshkGetState(),p=window.TameshkInvoiceOutput;return rows.filter(r=>!r.dataset.tpEmpty).map(r=>{const id=kind==='returns'?r.dataset.returnId:r.dataset.recordId||r.dataset.sourceTransactionId,t=kind==='returns'?s.transactionReturns.find(t=>t.id===id):s.transactions.find(t=>t.id===id);return t?{got:r.style.backgroundColor,want:p.softColor(kind==='returns'?p.returnColor(t):kind==='pending'?p.lineColor(t.items[0],t):t.backgroundColor)}:null}).filter(Boolean)},kind);assert.ok(result.length,selector);for(const r of result)assert.equal(r.got,r.want,selector)}
 await checkRows('#txTable tbody tr[data-record-id]','sales');await checkRows('[data-tp-key="sales-returns-pending"] tr[data-source-transaction-id]','pending');await checkRows('[data-tp-key="sales-returns-history"] tr[data-return-id]','returns');
 await page.evaluate(()=>{document.querySelector('#txTable tr[data-record-id]').style.backgroundColor='#00ff00';window.TameshkFeatureControls.applyHighlights()});await settled();await checkRows('#txTable tbody tr[data-record-id]','sales');
 await page.fill('#txSearch','F-3');await settled();await checkRows('#txTable tbody tr[data-record-id]','sales');await page.fill('#txSearch','');await settled();
 // Use real pagination controls, not a synthetic re-render.
 for(const [key,selector,kind] of [['transactions-main','#txTable tbody tr[data-record-id]','sales'],['sales-returns-pending','[data-tp-key="sales-returns-pending"] tr[data-source-transaction-id]','pending'],['sales-returns-history','[data-tp-key="sales-returns-history"] tr[data-return-id]','returns']]){const controls=page.locator(`[data-tp-controls-for="${key}"]`);await controls.locator('.tp-page').filter({hasText:/^2$/}).click();await settled();await checkRows(selector,kind)}
 await page.selectOption('#aggregateCustomer','Fixture customer');await settled();assert.equal(await page.locator('#aggregateChoices .aggregate-tx').count(),24);assert.equal(await page.locator('#aggregateChoices .aggregate-tx').first().evaluate(input=>input.closest('tr').style.backgroundColor),'');
 await page.evaluate(()=>{const s=window.__tameshkGetState(),inv=buildConsolidatedInvoice(s.transactions.slice(0,4));s.consolidatedInvoices=[inv];save();go('transactions')});await settled();
 assert.equal(await page.locator('[data-aggregate-id]').first().evaluate(r=>r.style.backgroundColor),'');assert.equal(await page.locator('[data-aggregate-id] details').getAttribute('data-color-mixed'),'true');
 await page.evaluate(()=>showConsolidatedInvoice(window.__tameshkGetState().consolidatedInvoices[0].id));await settled();const aggregateRows=await page.locator('#aggregatePaper table tbody').first().locator(':scope > tr').evaluateAll(rows=>rows.map(r=>r.style.backgroundColor));assert.deepEqual(aggregateRows.slice(0,4),['','rgb(255, 209, 209)','rgb(209, 209, 255)','rgb(255, 209, 209)']);
 await page.evaluate(()=>{closeModal();go('reports');setReportRange('all')});await settled();await checkRows('[data-tp-key="report-sales"] tr[data-record-id]','sales');await page.locator('[data-tp-controls-for="report-sales"] .tp-page').filter({hasText:/^2$/}).click();await settled();await checkRows('[data-tp-key="report-sales"] tr[data-record-id]','sales');
 await page.evaluate(()=>{document.getElementById('reportFrom').value='2099-01-01';document.getElementById('reportTo').value='2099-01-02';renderReport()});await settled();assert.equal(await page.locator('[data-tp-key="report-sales"] tr[data-record-id]').count(),0);await page.evaluate(()=>setReportRange('all'));await settled();await checkRows('[data-tp-key="report-sales"] tr[data-record-id]','sales');
 await page.reload();await page.waitForFunction(()=>!!window.TameshkInvoiceOutput);await page.evaluate(()=>go('transactions'));await settled();await checkRows('[data-tp-key="sales-returns-history"] tr[data-return-id]','returns');assert.equal(await page.locator('[data-aggregate-id]').count(),1);
 assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
});
