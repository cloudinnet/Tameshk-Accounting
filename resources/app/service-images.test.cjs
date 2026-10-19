'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const images={png:'data:image/png;base64,iVBORw0KGgo=',jpeg:'data:image/jpeg;base64,/9j/',webp:'data:image/webp;base64,UklGRgAAAABXRUJQ'};
function fixture(saved){
 const state=saved?JSON.parse(saved):{categories:['Services'],settings:{},products:[],services:[],quickCatalog:[],transactions:[]},nodes=new Map(),listeners={};let persisted='',modal='',inventory='',toasts=[],lastFile;
 const element=()=>({dataset:{},classList:{contains(){return false}},addEventListener(){},appendChild(){},querySelector(){return null},querySelectorAll(){return []},value:'',innerHTML:'',click(){lastFile=this}});
 const content=element(),doc={head:element(),createElement:element,getElementById:id=>id==='content'?content:nodes.get(id),querySelector(){return null},querySelectorAll(){return []},addEventListener(type,fn,capture){(listeners[type]??=[]).push({fn,capture})}};
 const root={document:doc,state,uiText:s=>s,save(){persisted=JSON.stringify(state)},render(){},showToast:s=>toasts.push(s),closeModal(){},inventoryPage(){},openModal(html){modal=html;nodes.clear();for(const m of html.matchAll(/<(input|select|div)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const el=element();el.value=m[2].match(/\bvalue="([^"]*)"/)?.[1]||'';el.checked=/\bchecked\b/.test(m[2]);nodes.set(m[3],el)}for(const [id,value] of [['svCategory','Services'],['svUnlimited','yes']])if(nodes.has(id))nodes.get(id).value=value},TameshkBarcode:{renderQuickCatalog(){}}};root.window=root;
 class FileReader{readAsDataURL(file){this.result=file.data;this.onload()}}
 const context=vm.createContext({window:root,state,FileReader,MutationObserver:class{observe(){}},setTimeout,atob,Uint8Array});
 vm.runInContext('const IMAGE_LIMIT=500*1024;'+read('index.html').match(/function validateImageDataUrl\(data\)\{[^\n]+/)[0]+';window.validateImageDataUrl=validateImageDataUrl;',context);
 vm.runInContext(read('catalog-images.js'),context);vm.runInContext(read('service-management.js'),context);
 function upload(data,type='image/png',size=20){const input={files:[{data,type,size}],value:'chosen'};root.TameshkCatalogImages.read(input,'serviceImageData','serviceImagePreview');return input}
 function inventoryRender(){const host={querySelector(){return null},insertAdjacentHTML(where,html){inventory=html}};root.inventoryPage(host);return inventory}
 return{state,root,nodes,upload,inventoryRender,get persisted(){return persisted},get modal(){return modal},get toasts(){return toasts},listeners,get lastFile(){return lastFile}};
}
test('service add/edit: safe image upload, replacement, persistence, inventory toggle, removal and legacy mirror',()=>{
 const f=fixture();f.root.TameshkServices.edit();assert.match(f.modal,/id="serviceImageFile"/);assert.match(f.modal,/image\/png,image\/jpeg,image\/webp/);f.nodes.get('svName').value='Independent';
 for(const [format,data] of Object.entries(images)){f.upload(data,'image/'+format);assert.equal(f.nodes.get('serviceImageData').value,data)}
 const s=f.root.TameshkServices.save();assert.equal(s.imageData,images.webp);assert.equal(f.state.quickCatalog[0].imageData,images.webp);assert.equal(JSON.parse(f.persisted).services[0].imageData,images.webp);
 assert.doesNotMatch(f.inventoryRender(),/service-inventory-image/);f.state.settings.showImagesInInventory=true;assert.match(f.inventoryRender(),/service-inventory-image/);
 const restored=fixture(f.persisted);assert.equal(restored.state.services[0].imageData,images.webp);restored.root.TameshkServices.edit(s.id);assert.equal(restored.nodes.get('serviceImageData').value,images.webp);
 restored.upload(images.png);restored.root.TameshkServices.save(s.id);assert.equal(restored.state.services[0].imageData,images.png);
 restored.root.TameshkServices.edit(s.id);restored.root.TameshkCatalogImages.clear('serviceImageData','serviceImagePreview');restored.root.TameshkServices.save(s.id);assert.equal(restored.state.services[0].imageData,undefined);assert.equal(restored.state.quickCatalog[0].imageData,undefined);assert.equal(fixture(restored.persisted).state.services[0].imageData,undefined);
});
let playwright;try{playwright=require(process.env.TAMESHK_PLAYWRIGHT_CORE||process.env.TAMESHK_PLAYWRIGHT||'playwright-core')}catch{}
test('browser: service image add/edit persistence, list/entry flags, reselection and invoice choices preserve products',{skip:!playwright,timeout:90000},async()=>{
 const http=require('node:http'),server=http.createServer((req,res)=>{const file=path.resolve(__dirname,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(__dirname+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(bytes)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await playwright.chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||playwright.chromium.executablePath(),headless:true,args:['--no-sandbox']});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url);await page.waitForFunction(()=>window.TameshkServices&&window.TameshkWorkflow);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'),photo='data:image/png;base64,'+png.toString('base64');
  await page.evaluate(photo=>{closeModal();document.getElementById('profileOverlay')?.remove();state.products=[{id:'fixture-product',name:'Fixture product',category:'Fixture',unit:'each',baseUnit:'each',stock:100,price:20,cost:5,imageData:photo}];state.services=[];state.quickCatalog=[];state.transactions=[];state.categories=['Fixture'];Object.assign(state.settings,{language:'en',showImagesInInventory:false,showImagesInEntry:true,invoiceImagesByDefault:false});save();go('inventory')},photo);
  let productBefore;
  await page.locator('button[onclick="window.TameshkServices.edit()"] ').click();await page.fill('#svName','Fixture service');await page.locator('.field').filter({has:page.locator('#svPrice')}).locator('.localized-number-entry').fill('45');
  await page.setInputFiles('#serviceImageFile',{name:'service.png',mimeType:'image/png',buffer:png});await page.waitForFunction(photo=>document.getElementById('serviceImageData')?.value===photo,photo);
  assert.equal(await page.locator('#serviceImagePreview img').evaluate(img=>img.naturalWidth),1);
  await page.locator('#modalInner button[onclick^="window.TameshkServices.save"]').click();
  const serviceId=await page.evaluate(()=>state.services[0].id);assert.equal(await page.evaluate(()=>state.services[0].imageData),photo);assert.equal(await page.locator('.service-inventory-image').count(),0);
  await page.reload();await page.waitForFunction(()=>window.TameshkServices);await page.evaluate(()=>{document.getElementById('profileOverlay')?.remove();go('inventory')});assert.equal(await page.evaluate(()=>state.services[0].imageData),photo);
  await page.evaluate(id=>TameshkServices.edit(id),serviceId);assert.equal(await page.inputValue('#serviceImageData'),photo);
  await page.locator('#modalInner button[onclick^="window.TameshkCatalogImages.clear"]').click();await page.locator('#modalInner button[onclick^="window.TameshkServices.save"]').click();
  assert.equal(await page.evaluate(()=>state.services[0].imageData),undefined);assert.equal(await page.evaluate(()=>state.quickCatalog[0].imageData),undefined);
  await page.reload();await page.waitForFunction(()=>window.TameshkServices);assert.equal(await page.evaluate(()=>state.services[0].imageData),undefined);
  await page.evaluate(id=>{document.getElementById('profileOverlay')?.remove();TameshkServices.edit(id)},serviceId);await page.setInputFiles('#serviceImageFile',{name:'replacement.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>!!document.getElementById('serviceImageData')?.value);await page.locator('#modalInner button[onclick^="window.TameshkServices.save"]').click();
  await page.reload();await page.waitForFunction(()=>window.TameshkServices);assert.equal(await page.evaluate(()=>state.services[0].imageData),photo);
  for(const show of [true,false]){await page.evaluate(show=>{document.getElementById('profileOverlay')?.remove();state.settings.showImagesInInventory=show;save();go('inventory')},show);assert.equal(await page.locator('.service-inventory-image').count(),show?1:0)}
  productBefore=await page.evaluate(()=>JSON.stringify(state.products));
  // Real browser DOM and layered production handlers; emulate Chromium's
  // datalist commit input event (data=null, insertText) without a change event.
  async function select(name){await page.locator('.item-name').first().evaluate((input,name)=>{input.value=name;input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:null}))},name)}
  for(const widget of [false,true]){
   if(widget){await page.goto(url+'/?tameshkPanel=transaction');await page.waitForFunction(()=>window.TameshkServices);await page.evaluate(()=>{document.getElementById('profileOverlay')?.remove();closeModal()})}
   for(const show of [false,true])for(const choice of [false,true]){
    await page.evaluate(({show,widget})=>{closeModal();state.settings.showImagesInEntry=show;state.settings.invoiceImagesByDefault=false;if(widget)newPage(document.getElementById('content'));else go('new')},{show,widget});
    await page.waitForTimeout(200);
    await select('Fixture product');assert.equal(await page.locator('.item-row').first().getAttribute('data-image-data'),photo,JSON.stringify({errors,dom:await page.locator('.item-name').first().evaluate(input=>({value:input.value,list:input.list?.innerHTML,row:input.closest('.item-row').dataset}))}));
    await select('Fixture service');assert.equal(await page.locator('.item-row').first().getAttribute('data-service-id'),serviceId);assert.equal(await page.locator('.item-image-preview').first().isVisible(),show);
    await page.locator('.item-include-image').first().setChecked(choice);
    await page.locator('.item-name').first().fill('');assert.equal(await page.locator('.item-row').first().getAttribute('data-image-data'),null);
    await select('Fixture service');assert.equal(await page.locator('.item-row').first().getAttribute('data-image-data'),photo);assert.equal(await page.locator('.item-include-image').first().isChecked(),choice);assert.equal(await page.locator('.item-image-preview').first().isVisible(),show);
    await page.evaluate(()=>saveTransaction(false));const tx=await page.evaluate(()=>state.transactions.at(-1));assert.equal(tx.items[0].imageData,photo);assert.equal(tx.items[0].includeImage,choice);
    if(!widget){await page.evaluate(id=>showInvoice(id,false),tx.id);assert.equal(await page.locator('#modalInner .invoice-paper img.catalog-thumb').count(),choice?1:0);await page.evaluate(()=>closeModal());await page.evaluate(id=>showInvoice(id,true),tx.id);await page.locator('.invoice-include-image').first().setChecked(!choice);await page.evaluate(id=>saveInvoiceEdits(id),tx.id);assert.equal(await page.evaluate(id=>state.transactions.find(tx=>tx.id===id).items[0].includeImage,tx.id),!choice);assert.equal(await page.locator('#modalInner .invoice-paper img.catalog-thumb').count(),choice?0:1);await page.evaluate(()=>closeModal())}
   }
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state.products)),productBefore);assert.deepEqual(errors,[]);
  await context.close();
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
});
test('service upload rejects invalid MIME, excessive size and forged signatures without destroying prior choice',()=>{
 const f=fixture();f.root.TameshkServices.edit();f.nodes.get('svName').value='Safe';f.upload(images.png);
 for(const [data,type,size] of [[images.png,'image/svg+xml',20],[images.png,'image/png',500*1024+1],['data:image/png;base64,PHN2Zz4=','image/png',20]]){f.upload(data,type,size);assert.equal(f.nodes.get('serviceImageData').value,images.png)}
 assert.equal(f.toasts.length,3);f.nodes.get('serviceImageData').value='javascript:alert(1)';f.root.TameshkServices.save();assert.equal(f.state.services.length,0);assert.equal(f.state.quickCatalog.length,0);
 f.state.services.push({id:'unsafe',name:'Unsafe',imageData:'data:image/svg+xml;base64,PHN2Zz4='});f.root.TameshkServices.migrate();assert.equal(f.state.services[0].imageData,undefined);
});
test('service snapshots take priority, current independent service lookup works by ID/name, removal does not resurrect a stale quick image',()=>{
 const f=fixture();f.state.services.push({id:'s',name:'Independent',imageData:images.png});f.state.quickCatalog.push({id:'s',kind:'service',name:'Independent',imageData:images.webp});const api=f.root.TameshkCatalogImages;
 assert.equal(api.imageForItem({serviceId:'s',name:'Old name',catalogType:'service'}),images.png);assert.equal(api.imageForItem({name:'Independent'}),images.png);assert.equal(api.imageForItem({serviceId:'s',imageData:images.jpeg}),images.jpeg);
 delete f.state.services[0].imageData;assert.equal(api.imageForItem({serviceId:'s',name:'Independent'}),'');
});
test('legacy quick-service photo edit and deletion update its independent service',()=>{
 const f=fixture();f.state.quickCatalog.push({id:'q',kind:'service',name:'Quick',imageData:images.png});f.root.TameshkServices.migrate();f.root.TameshkCatalogImages.pickQuick('q');const input=f.lastFile;input.files=[{type:'image/webp',size:20,data:images.webp}];input.onchange();assert.equal(f.state.services[0].imageData,images.webp);
 const target={closest(selector){return selector==='[data-image-clear]'?{dataset:{imageClear:'q'}}:null}};for(const {fn} of f.listeners.click)fn({target});assert.equal(f.state.services[0].imageData,undefined);assert.equal(f.state.quickCatalog[0].imageData,undefined);
});
