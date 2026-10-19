'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require(process.env.TAMESHK_PLAYWRIGHT||'/tmp/r21-browser/node_modules/playwright-core'))}catch{}
test('final invoice discount is absent at zero regardless of default field color and present when applied',{skip:!chromium||!fs.existsSync('/usr/bin/chromium'),timeout:90000},async()=>{
 const server=require('node:http').createServer((req,res)=>{const url=decodeURIComponent(req.url.split('?')[0]),file=path.join(__dirname,url==='/'?'index.html':url);if(!file.startsWith(__dirname+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(b)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.TameshkInvoiceOutput);
  await page.evaluate(()=>{document.getElementById('profileOverlay')?.remove();state.settings.recordAppearance={discountDefaults:{textColor:'#ff0000',backgroundColor:'#ffffff'},fieldStyles:{transactionDiscount:{color:'#ff0000'}}};state.settings.featureOptions={fieldStyle:false};state.transactions=[{id:'discount-fixture',no:'D-1',date:'2026-10-10',createdAt:'2026-10-10T10:00:00.000Z',customer:'Fixture',items:[{name:'Item',qty:1,price:1000,lineDiscount:20}],discount:0,note:''}];save()});
  for(const language of ['fa','en','ar'])for(const widget of [false,true])for(const orientation of ['portrait','landscape'])for(const value of [undefined,'',0,125]){
   await page.emulateMedia({media:'screen'});
   await page.evaluate(({language,widget,orientation,value})=>{document.body.classList.toggle('widget-panel-body',widget);state.settings.language=language;state.transactions[0].discount=value;setInvoicePrintOptions(orientation,'A4',0);showInvoice('discount-fixture',false)}, {language,widget,orientation,value});
   const row=page.locator('.invoice-paper [data-tx-summary="finalDiscount"]');assert.equal(await row.count(),1);
   assert.equal(await row.isVisible(),value===125,JSON.stringify({language,widget,orientation,value,media:'screen'}));
   await page.evaluate(orientation=>{document.getElementById('qa-discount-print')?.remove();const s=document.createElement('style');s.id='qa-discount-print';s.textContent=TameshkInvoicePrintLayout.buildCss({size:'A4',orientation,marginMm:0});document.head.append(s);document.documentElement.dataset.tameshkPrintOrientation=orientation},orientation);
   await page.emulateMedia({media:'print'});assert.equal(await row.isVisible(),value===125,JSON.stringify({language,widget,orientation,value,media:'print'}));
  }
  await page.emulateMedia({media:'screen'});await page.evaluate(()=>{state.transactions[0].discount=0;showInvoice('discount-fixture',true)});
  assert.equal(await page.locator('#invoiceDiscount').count(),1);assert.equal(await page.locator('#invoiceDiscount').isVisible(),true,'zero-discount editing control must remain usable');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
});
