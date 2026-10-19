'use strict';
// Runs the recovered application, not extracted functions or a currency mock.
// NODE_PATH=/tmp/tameshk-current/node_modules node --test invoice-recovered-1506.test.cjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.TAMESHK_PLAYWRIGHT_CORE||'playwright-core');
const artifacts=process.env.TAMESHK_INVOICE_ARTIFACTS||path.join(require('node:os').tmpdir(),'invoice-recovered-1506');
test('recovered invoice: generated copy localization, user ownership, saved currency, preview/print/PDF',{timeout:120000},async t=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const server=http.createServer((req,res)=>{const p=path.resolve(__dirname,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(__dirname+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(b)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const language of ['fa','en','ar'])for(const widget of [false,true])await t.test(`${language} ${widget?'widget':'main'}`,async()=>{
  const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[],logs=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({language})=>{
   const fixture={settings:{language,currency:'IRT',currencyDecimals:0,business:'BUSINESS_USER_TEXT',invoiceTemplate:'classic',invoicePrintMarginMigration:'1.5.22'},products:[],expenses:[],transactions:[{id:'saved-usd',no:'INV-SAVED-USD',date:'2026-10-11',createdAt:'2026-10-11T10:00:00Z',dateCalendar:'میلادی',customer:'CUSTOMER_USER_TEXT',note:'NOTE_USER_TEXT',currency:'USD',currencyDecimals:2,taxMode:'per-item',discount:0.25,items:[{name:'ROWITEM',unit:'UNITMARK',price:12.75,priceAtSale:12.75,qty:2,lineDiscount:0.5,taxOn:true,taxPercent:10,taxAmount:2.5}]}]};
   localStorage.setItem('tameshk-state',JSON.stringify(fixture));
   window.tameshkDesktop={log:(...args)=>window.__invoiceLog(...args),saveInvoicePdf:payload=>window.__invoicePdf(payload),printInvoice:payload=>window.__invoicePrint(payload)};
  },{language});
  let prints=0,pdfs=0;
  await page.exposeFunction('__invoiceLog',(...args)=>logs.push(args));
  await page.exposeFunction('__invoicePrint',async()=>{await page.emulateMedia({media:'print'});assert.ok(await page.locator('.invoice-paper').isVisible());prints++;await page.emulateMedia({media:'screen'});return{success:true}});
  await page.exposeFunction('__invoicePdf',async()=>{await page.emulateMedia({media:'print'});const file=path.join(artifacts,`${language}-${widget?'widget':'main'}.pdf`);await page.pdf({path:file,preferCSSPageSize:true,printBackground:true});const text=execFileSync('pdftotext',[file,'-'],{encoding:'utf8'}),compact=text.replace(/\s/g,'');assert.ok(compact.includes('ROWITEM'));assert.ok(compact.includes('NOTE_USER_TEXT'));assert.ok(text.includes('12.75')||text.includes('۱۲٫۷۵')||text.includes('١٢٫٧٥'));assert.ok(!text.includes('editable copy'));assert.ok(!text.includes('نسخة قابلة للتعديل'));if(language==='en'){assert.ok(text.includes('Invoice items'));assert.ok(text.includes('Item tax'));assert.ok(!text.includes('تومان'))}pdfs++;await page.emulateMedia({media:'screen'});return{success:true,filename:path.basename(file)}});
  await page.goto(`http://127.0.0.1:${server.address().port}/${widget?'?tameshkPanel=invoice&record=saved-usd':''}`);
  await page.waitForFunction(()=>window.TameshkInvoiceOutput&&window.TameshkCurrencyRecords1506);
  // Test bridge has no real desktop titlebar mount to signal this handshake.
  await page.evaluate(()=>{TameshkStartup1506.desktopReady();document.getElementById('profileOverlay')?.remove();showInvoice('saved-usd',false);applyUiLanguage()});
  await page.waitForFunction(()=>!document.documentElement.classList.contains('tameshk-starting'));
  const before=await page.evaluate(()=>JSON.stringify(state.transactions));
  const currencyResults=await page.evaluate(()=>{
   const result=[];for(const currency of ['USD','IRT','SAR'])for(const currencyDecimals of [0,2,4]){
    const tx={...state.transactions[0],currency,currencyDecimals};state.transactions=[tx];state.settings.currency=currency==='IRT'?'USD':'IRT';state.settings.currencyDecimals=currencyDecimals===0?4:0;showInvoice(tx.id,false);applyUiLanguage();
    const paper=document.querySelector('.invoice-paper'),symbol=TameshkCurrency.symbol(tx),price=paper.querySelector('.tm-items tbody td:nth-child(4)').textContent,tax=paper.querySelector('.invoice-tax-details').textContent;
    result.push({currency,currencyDecimals,price,expectedPrice:TameshkCurrency.format(12.75,tx),header:paper.querySelector('.tm-items th:nth-child(4)').textContent,symbol,tax,expectedTax:TameshkCurrency.amount(2.5,tx),summaries:[...paper.querySelectorAll('.tm-money:not(.tx-invoice-line-discount-spacer) b')].map(b=>b.textContent)});
   }return result;
  });
  for(const c of currencyResults){assert.equal(c.price,c.expectedPrice,JSON.stringify(c));assert.ok(c.header.includes(c.symbol),JSON.stringify(c));assert.ok(c.tax.includes(c.expectedTax),JSON.stringify(c));assert.ok(c.summaries.every(s=>s.includes(c.symbol)),JSON.stringify(c))}
  await page.evaluate(before=>{state.transactions=JSON.parse(before);state.settings.currency='IRT';state.settings.currencyDecimals=0;const content=document.getElementById('content');settingsPage(content);selectInvoiceTemplate('classic');duplicateInvoiceTemplate();applyUiLanguage()},before);
  const generated=await page.evaluate(()=>{const copy=state.settings.invoiceTemplates.at(-1);return{name:TameshkTemplateName(copy),labels:[...document.querySelectorAll('#tmFields .tm-field-edit > input')].map(i=>i.value),baseline:copy.fields.map(f=>f.label),preview:document.getElementById('tmPreview').textContent}});
  assert.equal(generated.labels.length,16);assert.equal(new Set(generated.labels).size,16);
  if(language==='en'){assert.equal(generated.name,'Classic · editable copy');assert.deepEqual(generated.labels,['Logo','Business name','Invoice number','Date','Recorded time','Customer name','Customer surname','Phone','Address','Invoice items','Item subtotal','Discount','Final total','Notes','Stamp','Signature'])}
  if(language==='ar'){assert.equal(generated.name,'كلاسيكي · نسخة قابلة للتعديل');assert.deepEqual(generated.labels,['الشعار','اسم النشاط التجاري','رقم الفاتورة','التاريخ','وقت التسجيل','اسم العميل','اسم عائلة العميل','الهاتف','العنوان','بنود الفاتورة','المجموع الفرعي للبنود','الخصم','المبلغ النهائي','ملاحظات','الختم','التوقيع'])}
  if(language==='fa')assert.deepEqual(generated.labels,generated.baseline);
  const preservation=await page.evaluate(()=>{
   // Explicitly typing a default Persian word makes it user-owned even in EN/AR.
   updateInvoiceFieldLabel('note','توضیحات');updateInvoiceFieldLabel('discount','تخفیف');
   const copy=state.settings.invoiceTemplates.at(-1);copy.name='USER_TEMPLATE_NAME';state.transactions[0].invoiceTemplateId=copy.id;save();showInvoice('saved-usd',false);applyUiLanguage();return{note:document.querySelector('.tm-note .tm-label').textContent,discount:document.querySelector('[data-template-source="totals.discount"] .tm-label').textContent,name:TameshkTemplateName(copy),paper:document.querySelector('.invoice-paper').textContent};
  });assert.equal(preservation.note,'توضیحات');assert.equal(preservation.discount,'تخفیف');assert.equal(preservation.name,'USER_TEMPLATE_NAME');assert.ok(!preservation.paper.includes('USER_TEMPLATE_NAME'));
  await page.reload();await page.waitForFunction(()=>window.TameshkInvoiceOutput);await page.evaluate(()=>{TameshkStartup1506.desktopReady();document.getElementById('profileOverlay')?.remove();showInvoice('saved-usd',false);applyUiLanguage()});await page.waitForFunction(()=>!document.documentElement.classList.contains('tameshk-starting'));
  assert.equal(await page.locator('.tm-note .tm-label').textContent(),'توضیحات');
  // Return to producer-owned copy for translated output checks.
  await page.evaluate(()=>{selectInvoiceTemplate('classic');duplicateInvoiceTemplate();state.transactions[0].invoiceTemplateId=state.settings.invoiceTemplate;showInvoice('saved-usd',false);applyUiLanguage();setInvoicePrintOptions('portrait','A4',8)});
  const beforeOutput=await page.evaluate(()=>JSON.stringify(state.transactions));
  await page.evaluate(()=>downloadInvoicePdf('saved-usd'));assert.equal(pdfs,1,JSON.stringify(await page.evaluate(()=>({toast:document.getElementById('toast')?.textContent,paper:document.querySelector('.invoice-paper')?.innerText,modal:document.getElementById('modal')?.className}))));
  await page.evaluate(()=>printInvoice('saved-usd'));await page.waitForFunction(()=>document.title!=='INV-SAVED-USD__2026_10_11__10-00-00');
  for(let i=0;i<50&&!prints;i++)await page.waitForTimeout(100);assert.equal(prints,1,JSON.stringify(logs));
  await page.evaluate(()=>{showInvoice('saved-usd',true);applyUiLanguage()});
  const editableCurrency=await page.evaluate(()=>({headers:[...document.querySelectorAll('.invoice-paper th')].map(e=>e.textContent),tax:document.querySelector('.invoice-tax-details')?.textContent,totals:[...document.querySelectorAll('.invoice-paper .total-line b')].map(e=>e.textContent)}));
  assert.ok(editableCurrency.headers.some(s=>s.includes('$')),JSON.stringify(editableCurrency));
  assert.ok(editableCurrency.headers.every(s=>!s.includes('تومان')&&!s.includes('toman')),JSON.stringify(editableCurrency));
  assert.equal(await page.evaluate(()=>JSON.stringify(state.transactions)),beforeOutput,'preview/print/PDF/editor display never alters saved amounts or values');
  assert.deepEqual(errors,[]);await page.close();
 });}finally{await browser.close();await new Promise(r=>server.close(r))}
});
