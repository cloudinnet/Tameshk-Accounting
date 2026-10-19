'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
let chromium;
for(const modulePath of [process.env.TAMESHK_PLAYWRIGHT_CORE,process.env.TAMESHK_PLAYWRIGHT,'playwright-core','/tmp/tameshk-current/node_modules/playwright-core','/tmp/tameshk-qa/node_modules/playwright-core'].filter(Boolean)){
 try{({chromium}=require(modulePath));break}catch{}
}
const layout=require('./invoice-print-layout.js');
test('print direction follows language without changing page dimensions or margins',()=>{
 for(const language of ['en','fa','ar'])for(const size of ['A4','A5'])for(const orientation of ['portrait','landscape']){
  const css=layout.buildCss({language,size,orientation,marginMm:8});
  assert.match(css,new RegExp(`direction:${language==='en'?'ltr':'rtl'}!important`));
  assert.match(css,new RegExp(`size:${layout.pageDimensions(size,orientation)}`));
  assert.match(css,/margin:8mm 8mm 13mm/);
 }
});
test('actual main/widget preview, print emulation and Chromium PDF preserve locale geometry and user text',{skip:!chromium,timeout:120000},async t=>{
 const server=require('node:http').createServer((req,res)=>{const file=path.resolve(__dirname,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(__dirname+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(bytes)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const artifacts=process.env.TAMESHK_INVOICE_ARTIFACTS||fs.mkdtempSync(path.join(os.tmpdir(),'invoice-1504-'));fs.mkdirSync(artifacts,{recursive:true});
 try{for(const language of ['en','fa','ar'])for(const widget of [false,true])await t.test(`${language} ${widget?'actual widget':'main'}: four sheets, live print and PDF`,async()=>{
  const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({language})=>{
   class Storage{constructor(){this.values=new Map()}getItem(k){return this.values.get(k)??null}setItem(k,v){this.values.set(k,String(v))}removeItem(k){this.values.delete(k)}}
   Object.defineProperty(window,'localStorage',{value:new Storage});Object.defineProperty(window,'sessionStorage',{value:new Storage});
   // Deliberately disagree with current defaults: historical output owns USD/2.
   localStorage.setItem('tameshk-state',JSON.stringify({settings:{language,currency:'IRT',currencyDecimals:0,invoiceTemplate:'classic',business:'داشبورد',invoiceNote:'پیش فرض',invoicePrintMarginMigration:'1.5.22'},transactions:[{id:'locale-fixture',no:'PDF-1504',date:'2026-10-11',createdAt:'2026-10-11T10:00:00Z',customer:'ثبت هزینه',note:'یادداشت فارسی واقعی',currency:'USD',currencyDecimals:2,discount:1.25,items:[{name:'ROWITEM',unit:'UNITMARK',qty:2,price:12.75,lineDiscount:0}]}],products:[],expenses:[]}));
   window.tameshkDesktop={log(){},saveInvoicePdf:payload=>window.__captureInvoicePdf(payload),printInvoice:payload=>window.__captureInvoicePrint(payload)};
  },{language});
  async function geometry(){return page.evaluate(()=>{
   const paper=document.querySelector('.invoice-paper'),cells=[...paper.querySelectorAll('.tm-items th')],box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
   return{paper:box(paper),columns:cells.map(box),direction:getComputedStyle(paper).direction,tableDirection:getComputedStyle(paper.querySelector('table')).direction,moneyAlign:getComputedStyle(paper.querySelector('.tm-money')).textAlign,noteAlign:getComputedStyle(paper.querySelector('.tm-note')).textAlign,signature:box(paper.querySelector('.tm-signature')),stamp:box(paper.querySelector('.tm-stamp')),contain:getComputedStyle(document.getElementById('modalInner')).containerType};
  })}
  let current,printed=0,pdfs=0,bindingErrors=[];
  function verify(g){assert.equal(g.direction,language==='en'?'ltr':'rtl');assert.equal(g.tableDirection,g.direction);for(let i=1;i<g.columns.length;i++)assert.ok(language==='en'?g.columns[i].x>g.columns[i-1].x:g.columns[i].x<g.columns[i-1].x,'column physical order');if(language==='en'){assert.equal(g.moneyAlign,'left');assert.equal(g.noteAlign,'left');assert.ok(g.signature.x>g.stamp.x,'signature right of stamp')}else assert.ok(g.signature.x<g.stamp.x,'RTL signature retained');assert.ok(g.columns.every(c=>c.x>=g.paper.x-1&&c.x+c.width<=g.paper.x+g.paper.width+1),'table fits')}
  await page.exposeFunction('__captureInvoicePrint',async()=>{try{await page.emulateMedia({media:'print'});verify(await geometry());printed++;await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.__printed=true);return{success:true}}catch(e){bindingErrors.push(e.message);await page.evaluate(()=>window.__printed=true);throw e}});
  await page.exposeFunction('__captureInvoicePdf',async()=>{
   try{await page.emulateMedia({media:'print'});verify(await geometry());const cdp=await page.context().newCDPSession(page),result=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});await cdp.detach();
   const file=path.join(artifacts,`${language}-${widget?'widget':'main'}-${current.size}-${current.orientation}.pdf`);fs.writeFileSync(file,Buffer.from(result.data,'base64'));
   const bbox=execFileSync('pdftotext',['-bbox',file,'-'],{encoding:'utf8'}),words=[...bbox.matchAll(/<word xMin="([^"]+)" yMin="([^"]+)" xMax="([^"]+)" yMax="([^"]+)">([^<]+)<\/word>/g)].map(m=>({x:+m[1],y:+m[2],text:m[5]}));
   const item=words.find(w=>w.text==='ROWITEM'),unit=words.find(w=>w.text.startsWith('UNIT'));assert.ok(item&&unit,'real PDF contains row text');assert.ok(language==='en'?item.x<unit.x:item.x>unit.x,'real PDF row columns retain locale order');assert.ok(Math.abs(item.y-unit.y)<12,'same PDF row including wrapped units');
   const dims=layout.pageDimensions(current.size,current.orientation).split(' ').map(parseFloat),sheet=bbox.match(/<page width="([^"]+)" height="([^"]+)">/);assert.ok(sheet);assert.ok(Math.abs(+sheet[1]-dims[0]*72/25.4)<1);assert.ok(Math.abs(+sheet[2]-dims[1]*72/25.4)<1);
   if(language==='en'){const signature=words.find(w=>w.text==='Signature'),notes=words.find(w=>w.text==='Notes'),total=words.find(w=>w.text==='Final');assert.ok(signature&&notes&&total,'localized fixed captions in PDF');assert.ok(signature.x>notes.x&&signature.x>total.x,'PDF signature right, notes/totals left')}
   pdfs++;await page.emulateMedia({media:'screen'});return{success:true,filename:path.basename(file)};}catch(e){bindingErrors.push(e.message);throw e}
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/${widget?'?tameshkPanel=invoice&record=locale-fixture':''}`);await page.waitForFunction(()=>window.TameshkInvoiceOutput&&window.downloadInvoicePdf);
  // The fake desktop bridge has no titlebar mount to signal startup readiness.
  await page.evaluate(()=>window.TameshkStartup1506?.desktopReady());
  await page.waitForFunction(()=>!document.documentElement.classList.contains('tameshk-starting'));
  await page.evaluate(()=>{document.getElementById('profileOverlay')?.remove();showInvoice('locale-fixture',false);applyUiLanguage()});
  if(widget)assert.equal(await page.evaluate(()=>window.__tameshkWidgetRoute),'invoice');
  verify(await geometry());assert.equal(await page.locator('.tm-business-name').textContent(),'داشبورد');assert.equal(await page.locator('.tm-note > div:last-child').textContent(),'یادداشت فارسی واقعی');
  await page.evaluate(()=>{window.__originalTx=JSON.stringify(state.transactions)});
  for(const size of ['A4','A5'])for(const orientation of ['portrait','landscape']){
   current={size,orientation};await page.evaluate(({size,orientation})=>{setInvoicePrintOptions(orientation,size,8);showInvoice('locale-fixture',false);applyUiLanguage();document.querySelector('[data-invoice-control="orientation"]').value=orientation;document.querySelector('[data-invoice-control="size"]').value=size;document.querySelector('[data-invoice-control="margin"]').value='8';updateInvoicePrintOptions()},current);
   await page.evaluate(()=>downloadInvoicePdf('locale-fixture'));assert.deepEqual(bindingErrors,[]);await page.evaluate(()=>{window.__printed=false;printInvoice('locale-fixture')});await page.waitForFunction(()=>window.__printed);assert.deepEqual(bindingErrors,[]);
  }
  assert.equal(pdfs,4);assert.equal(printed,4);assert.equal(await page.evaluate(()=>JSON.stringify(state.transactions)),await page.evaluate(()=>window.__originalTx));
  await page.evaluate(language=>{setInvoicePrintOptions('landscape','A5',8);showInvoice('locale-fixture',true);applyUiLanguage();let style=document.getElementById('invoicePrintOptionsStyle');if(!style){style=document.createElement('style');style.id='invoicePrintOptionsStyle';document.head.append(style)}style.textContent=TameshkInvoicePrintLayout.buildCss({language,size:'A5',orientation:'landscape',marginMm:8});document.documentElement.dataset.tameshkPrintOrientation='landscape'},language);
  await page.emulateMedia({media:'print'});const editable=await page.evaluate(()=>{const paper=document.querySelector('.invoice-paper'),xs=[...paper.querySelectorAll('thead th')].filter(th=>th.getBoundingClientRect().width>0).map(th=>th.getBoundingClientRect().x),signature=paper.querySelector('.signature')?.getBoundingClientRect(),totals=paper.querySelector('.totals');return{xs,signatureX:signature?.x,paperX:paper.getBoundingClientRect().x,paperWidth:paper.getBoundingClientRect().width,totalsAlign:getComputedStyle(totals).alignItems}});assert.ok(editable.xs.length>=7,'all seven data columns print; an optional hidden image header has no physical order');for(let i=1;i<editable.xs.length;i++)assert.ok(language==='en'?editable.xs[i]>editable.xs[i-1]:editable.xs[i]<editable.xs[i-1]);if(language==='en'){assert.equal(editable.totalsAlign,'flex-start');assert.ok(editable.signatureX>editable.paperX+editable.paperWidth/2)}
  const editableCdp=await page.context().newCDPSession(page),editablePdf=await editableCdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});await editableCdp.detach();const editableFile=path.join(artifacts,`${language}-${widget?'widget':'main'}-editable-A5-landscape.pdf`);fs.writeFileSync(editableFile,Buffer.from(editablePdf.data,'base64'));const editableText=execFileSync('pdftotext',[editableFile,'-'],{encoding:'utf8'});assert.ok(editableText.includes('PDF-1504'),'current invoice number survives editor-hiding print CSS');assert.ok(editableText.includes('ROWITEM'),'editable item names remain in PDF as inert text');assert.equal(await page.evaluate(()=>JSON.stringify(state.transactions)),await page.evaluate(()=>window.__originalTx),'print-only mirrors never update saved transactions');await page.emulateMedia({media:'screen'});
  const currencyContract=await page.evaluate(()=>{
   if(!window.TameshkCurrency)throw new Error('Real saved-record currency helper is required');
   const prior={currency:state.settings.currency,currencyDecimals:state.settings.currencyDecimals},results=[],before=JSON.stringify(state.transactions);
   try{for(const currency of ['IRT','SAR','USD'])for(const currencyDecimals of [0,2,4]){
    // Each fixture owns its snapshot; unrelated current defaults must not win.
    const record={...state.transactions[0],currency,currencyDecimals},symbol=TameshkCurrency.symbol(record),host=document.createElement('div');
    Object.assign(state.settings,{currency:currency==='IRT'?'USD':'IRT',currencyDecimals:currencyDecimals===0?4:0});
    host.innerHTML=renderTemplateInvoice(record,'یادداشت');TameshkInvoiceOutput.updateTemplateTotals(record,host.querySelector('.invoice-paper'));
    results.push({header:host.querySelector('.tm-items th:nth-child(4)').textContent,symbol,price:host.querySelector('.tm-items tbody td:nth-child(4)').textContent,expected:TameshkCurrency.format(12.75,record),summary:[...host.querySelectorAll('.tm-money:not(.tx-invoice-line-discount-spacer) b')].every(b=>b.textContent.includes(symbol))});
   }}finally{Object.assign(state.settings,prior)}
   if(before!==JSON.stringify(state.transactions))throw new Error('Currency output matrix mutated saved transactions');return results;
  });for(const c of currencyContract){assert.ok(c.header.includes(c.symbol));assert.equal(c.price,c.expected);assert.equal(c.summary,true)}
  await page.evaluate(()=>{state.transactions[0].invoiceNoteOverride='';showInvoice('locale-fixture',false)});assert.equal(await page.evaluate(()=>state.transactions[0].invoiceNoteOverride),'');assert.ok(!(await page.locator('.tm-note').textContent()).includes('پیش فرض'));
  if(!widget){await page.evaluate(()=>{go('settings');applyUiLanguage()});const labels=await page.locator('#tmFields .tm-field-edit > input').evaluateAll(inputs=>inputs.map(i=>i.value));assert.equal(labels.length,16);if(language!=='fa')assert.ok(labels.every(v=>!/[پچژگک]/.test(v)),'builtin labels translated');const sources=await page.locator('#tmAddSource option').allTextContents();assert.equal(sources.length,21);if(language==='en')assert.ok(sources.every(v=>!/[\u0600-\u06ff]/.test(v)),'all source captions translated')}
  const custom=await page.evaluate(()=>{
   const fields=[['items','items','items'],['total','totals.total','money'],['note','invoice.note','note']].map(([id,source,type])=>({id,source,type,label:'تخفیف',visible:true,style:{align:'right',emphasis:'normal',tone:'default'},fontId:'tahoma',fontSize:10,color:'#1e2d35'}));
   const template={schema:'tameshk.invoice-template',schemaVersion:2,id:'custom-locale-test',name:'کلاسیک',description:'',style:{variant:'classic',density:'comfortable',accent:'teal',border:'solid'},fields};state.settings.invoiceTemplates=[template];const before=JSON.stringify(template),host=document.createElement('div');host.innerHTML=renderTemplateInvoice({...state.transactions[0],invoiceTemplateId:template.id},'توضیحات');return{labels:[...host.querySelectorAll('[data-no-i18n]')].map(e=>e.textContent),unchanged:before===JSON.stringify(template)};
  });assert.ok(custom.labels.filter(v=>v==='تخفیف').length>=3);assert.ok(custom.labels.includes('توضیحات'));assert.equal(custom.unchanged,true);
  assert.deepEqual(errors,[]);await page.close();
 });}finally{await browser.close();await new Promise(r=>server.close(r))}
});
