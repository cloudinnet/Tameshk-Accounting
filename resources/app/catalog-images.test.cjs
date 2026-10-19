'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
// Small dependency-free DOM fixture: exercise the complete production decorator,
// actual core syncItem handler, and event capture/inline/bubble ordering.
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.listeners={};this.className='';this.value='';this.textContent='';this.hidden=false;this.checked=false;this.disabled=false;this.classList={contains:c=>this.className.split(' ').includes(c),add:c=>{if(!this.classList.contains(c))this.className+=' '+c}}}
 appendChild(el){if(el.parentNode)el.parentNode.children.splice(el.parentNode.children.indexOf(el),1);this.children.push(el);el.parentNode=this;return el}
 append(...els){els.forEach(el=>this.appendChild(el))}
 prepend(el){this.appendChild(el);this.children.unshift(this.children.pop())}
 replaceChildren(...els){this.children.forEach(el=>el.parentNode=null);this.children=[];this.append(...els)}
 removeAttribute(name){delete this[name]}
 matches(s){return s.startsWith('.')?this.classList.contains(s.slice(1)):this.tagName===s.toUpperCase()}
 closest(s){return this.matches(s)?this:this.parentNode?.closest(s)}
 querySelector(s){return this.querySelectorAll(s)[0]||null}
 querySelectorAll(s){const match=el=>s==='img.catalog-thumb'?el.tagName==='IMG'&&el.classList.contains('catalog-thumb'):el.matches(s);const out=[];for(const c of this.children){if(match(c))out.push(c);out.push(...c.querySelectorAll(s))}return out}
 addEventListener(type,fn,capture=false){(this.listeners[type]??=[]).push({fn,capture})}
 get cells(){return this.children.filter(c=>c.tagName==='TD'||c.tagName==='TH')}
 get rows(){return this.children.filter(c=>c.tagName==='TR')}
 set innerHTML(html){this._html=html;if(html.includes('item-include-image')){const input=new Element('input');input.className='item-include-image';input.checked=html.includes(' checked');this.replaceChildren(input)}}
 get innerHTML(){return this._html||''}
}
const imageA='data:image/png;base64,AA==',imageB='data:image/png;base64,AQ==';
function fixture(defaultOn=true,widget=false){
 const state={settings:{showImagesInEntry:true,invoiceImagesByDefault:defaultOn},products:[{id:'p1',name:'Product',price:20,imageData:imageA},{id:'p2',name:'Other',price:30,imageData:imageB}],services:[],quickCatalog:[{id:'s1',kind:'service',name:'Service',imageData:imageB}],transactions:[]};
 const doc=new Element('document'),head=new Element('head'),items=new Element(),content=new Element();doc.head=head;content.id='content';doc.append(content);content.append(items);const row=new Element();row.className='item-row';items.append(row);
 const field=new Element();field.className='field';row.append(field);for(const [selector,value] of [['item-name',''],['item-stock',''],['item-price',''],['item-cat',''],['item-unit',''],['item-qty','1']]){const el=new Element(selector==='item-stock'?'small':'input');el.className=selector;el.value=value;(selector==='item-name'?field:row).append(el)}
 let table=null;
 doc.getElementById=id=>id==='content'?content:null;
 const basic=doc.querySelectorAll.bind(doc);doc.querySelectorAll=s=>s==='#items .item-row'?[row]:s==='.invoice-include-image'&&table?table.querySelectorAll(s):basic(s);
 doc.querySelector=s=>s==='#items .item-row:last-child'?row:s==='#modalInner .invoice-paper table'?table:null;
 doc.createElement=tag=>new Element(tag);doc.createTextNode=text=>{const n=new Element('text');n.textContent=text;return n};
 const root={document:doc,state,calcTotals(){},saleUnitOptions(){return ''},updateSaleUnit(){},save(){},showInvoice(){},saveInvoiceEdits(){},addItemRow(pref={}){row.querySelector('.item-name').value=pref.name||'';if(pref.name)root.syncItem(row.querySelector('.item-name'))},saveTransaction(){state.transactions.push({id:'saved-'+state.transactions.length,items:[{name:row.querySelector('.item-name').value,qty:1,price:20}]})},newPage(){root.addItemRow()}};root.window=root;
 const context=vm.createContext({...root,window:root,state,MutationObserver:class{observe(){}},setTimeout});
 const core=read('index.html').match(/function syncItem\(inp\)\{[^\n]+/)[0];vm.runInContext(core+'\nwindow.syncItem=syncItem;',context);
 vm.runInContext(read('catalog-images.js'),context);
 if(widget){const init=read('desktop-widget.js').match(/function initTransaction\(\)\{[^\n]+/)[0];vm.runInContext(init+'\ninitTransaction();',vm.createContext({d:doc,newPage:root.newPage,root,attachOpacityControl(){}}))}else root.addItemRow();
 row.querySelector('.item-name').list={get options(){return [...state.products,...state.services,...state.quickCatalog].map(x=>({value:x.name}))}};
 function event(type,inputType,details={}){const input=row.querySelector('.item-name'),ev={target:input,currentTarget:input,type,inputType,...details};for(const l of doc.listeners[type]||[])if(l.capture)l.fn(ev);if(type!=='beforeinput')root.syncItem(input);for(const l of doc.listeners[type]||[])if(!l.capture)l.fn(ev)}
 return{root,state,row,doc,event,setTable(t){table=t}};
}
for(const widget of [false,true])test(`${widget?'detached widget':'main'}: clear/edit/name typing removes stale photo; deliberate reselect restores it`,()=>{
 const f=fixture(true,widget),{row,root,event}=f,name=row.querySelector('.item-name');
 name.value='Product';event('change');assert.equal(row.dataset.productId,'p1');assert.equal(row.dataset.imageData,imageA);assert.equal(row.querySelector('.item-include-image').checked,true);
 for(const next of ['','Unmatched','Other']){name.value=next;event('input','insertText');assert.equal(row.dataset.imageData,undefined);assert.equal(row.querySelector('.item-image-preview').src,undefined);assert.equal(row.querySelector('.item-image-preview').hidden,true);assert.equal(row.querySelector('.item-include-image').disabled,true);assert.equal(root.TameshkCatalogImages.transactionFields(row).imageData,'');}
 assert.equal(row.dataset.productId,'p2','image invalidation must not overwrite core selected provenance');
 event('change');assert.equal(row.dataset.imageData,imageB);assert.equal(row.querySelector('.item-include-image').checked,true);
 name.value='Service';event('change');assert.equal(row.dataset.imageData,imageB);name.value='Serv';event('input','deleteContentBackward');assert.equal(root.TameshkCatalogImages.transactionFields(row).imageData,'');
 name.value='Service';event('input','insertReplacementText');assert.equal(row.dataset.imageData,imageB);
 name.value='custom';event('input','insertText');root.saveTransaction(false);assert.equal(f.state.transactions[0].items[0].imageData,undefined);assert.equal(f.state.transactions[0].items[0].includeImage,false);
});
for(const defaultOn of [false,true])test(`default ${defaultOn}: checkbox choices survive clear/reselect and saved row prefill`,()=>{
 const {root,row,event}=fixture(defaultOn);const name=row.querySelector('.item-name');name.value='Product';event('change');const check=row.querySelector('.item-include-image');assert.equal(check.checked,defaultOn);
 for(const choice of [true,false]){check.checked=choice;for(const l of check.listeners.change)l.fn({currentTarget:check});name.value='';event('input','deleteContentBackward');assert.equal(check.checked,false);name.value='Product';event('change');assert.equal(check.checked,choice);assert.equal(root.TameshkCatalogImages.transactionFields(row).includeImage,choice);}
 root.addItemRow({name:'Product',imageData:imageA,includeImage:false});assert.equal(check.checked,false);
});
for(const widget of [false,true])for(const nameValue of ['Product','Service'])test(`${widget?'widget':'main'}: same ${nameValue} native insertText selection restores without another change event`,()=>{
 const {row,event,root}=fixture(true,widget),name=row.querySelector('.item-name'),check=row.querySelector('.item-include-image');name.value=nameValue;event('change');const photo=row.dataset.imageData;
 for(const choice of [true,false]){check.checked=choice;for(const l of check.listeners.change)l.fn({currentTarget:check});
  for(const edited of ['',nameValue.slice(0,-1)]){name.value=edited;event('beforeinput','deleteContentBackward',{data:null});event('input','deleteContentBackward',{data:null});assert.equal(row.dataset.imageData,undefined);
   // Same as the previously committed name: Chromium need not emit change.
   name.value=nameValue;event('input','insertText',{data:null});assert.equal(row.dataset.imageData,photo);assert.equal(check.checked,choice);assert.equal(root.TameshkCatalogImages.transactionFields(row).imageData,photo);
  }
 }
 name.value='';event('input','deleteContentBackward',{data:null});name.value=nameValue;event('input',undefined);assert.equal(row.dataset.imageData,photo,'plain datalist input event is also a selection');
});
test('typing/pasting/composition of the exact catalog name is not mistaken for a datalist selection',()=>{
 const {row,event,root}=fixture(),name=row.querySelector('.item-name');name.value='Product';event('change');
 for(const [inputType,data] of [['insertText','t'],['insertFromPaste',null],['insertCompositionText',null]]){name.value='Produc';event('input','deleteContentBackward',{data:null});name.value='Product';event('beforeinput',inputType,{data,isComposing:inputType==='insertCompositionText'});event('input',inputType,{data,isComposing:inputType==='insertCompositionText'});assert.equal(root.TameshkCatalogImages.transactionFields(row).imageData,'');}
});
function invoiceTable(order,detail=false){const table=new Element('table'),thead=new Element('thead'),tbody=new Element('tbody'),header=new Element('tr');table.tHead=thead;table.tBodies=[tbody];table.append(thead,tbody);thead.append(header);for(const text of order){const c=new Element('th');c.textContent=text;if(text==='Image')c.className='tm-image-column';header.append(c)}for(let i=0;i<2;i++){const row=new Element('tr');for(const text of order){const c=new Element('td');c.textContent=text==='Total'?String(100+i):text;if(text==='Image')c.className='tm-image-column';row.append(c)}tbody.append(row);if(detail){const extra=new Element('tr');extra.className='invoice-tax-details';extra.append(new Element('td'));tbody.append(extra)}}return table}
for(const existing of [false,true])test(`invoice ${existing?'existing':'injected'} column is last, idempotent, and editor images remain attached to items`,()=>{
 const f=fixture(),table=invoiceTable(existing?['Name','Image','Total']:['Name','Total'],true);f.setTable(table);f.state.transactions.push({id:'invoice',items:[{name:'Product',imageData:imageA,includeImage:true},{name:'Service',imageData:imageB,includeImage:false}]});f.root.showInvoice('invoice',true);
 assert.equal(table.tHead.rows[0].cells.at(-1).classList.contains('tm-image-column'),true);const rows=table.tBodies[0].rows.filter(r=>!r.classList.contains('invoice-tax-details'));
 rows.forEach((row,i)=>{assert.equal(row.cells.at(-2).textContent,String(100+i));const cb=row.querySelector('.invoice-include-image');assert.equal(cb.dataset.index,String(i));assert.equal(cb.checked,i===0);assert.equal(row.querySelector('img.catalog-thumb').src,i===0?imageA:imageB)});
 assert.equal(table.tBodies[0].rows[1].cells[0].colSpan,3);const checks=rows.map(row=>row.querySelector('.invoice-include-image'));checks[0].checked=false;checks[1].checked=true;f.root.showInvoice('invoice',true);assert.equal(table.tHead.rows[0].cells.length,3);assert.equal(rows[0].querySelector('.invoice-include-image'),checks[0],'repeat decoration preserves unsaved editor choices');f.root.saveInvoiceEdits('invoice');assert.deepEqual(f.state.transactions[0].items.map(x=>x.includeImage),[false,true]);
});
test('noneditable image on/off and no-photo invoices do not gain duplicate or empty columns',()=>{
 const f=fixture();f.state.transactions.push({id:'invoice',items:[{name:'Product',imageData:imageA,includeImage:false},{name:'Service',imageData:imageB,includeImage:false}]});let table=invoiceTable(['Name','Total']);f.setTable(table);f.root.showInvoice('invoice',false);assert.equal(table.tHead.rows[0].cells.length,2);f.state.transactions[0].items[1].includeImage=true;table=invoiceTable(['Name','Total']);f.setTable(table);f.root.showInvoice('invoice',false);assert.equal(table.tHead.rows[0].cells.length,3);assert.equal(table.querySelectorAll('img.catalog-thumb').length,1);f.root.showInvoice('invoice',false);assert.equal(table.tHead.rows[0].cells.length,3);
});
test('independent services retain service provenance and never inherit a cleared product snapshot',()=>{
 const f=fixture(),{root,row,state,event}=f;state.services.push({id:'svc1',name:'Independent',active:true,imageData:imageB,price:45,category:'Services',unit:'hour',stockUnlimited:true});
 const source=read('service-management.js'),identify=source.match(/function identifyRow\(row\)\{[^\n]+/)[0],wrapper=source.match(/if\(typeof root\.syncItem==='function'\)\{[^\n]+/)[0];
 vm.runInNewContext(identify+'\n'+wrapper,{root,state,services:()=>state.services,normalize:x=>String(x||'').trim().toLowerCase(),esc:x=>String(x)});
 const name=row.querySelector('.item-name');name.value='Product';event('change');assert.equal(row.dataset.imageData,imageA);name.value='Independent';event('input','insertText');assert.equal(row.dataset.serviceId,'svc1');assert.equal(row.dataset.productId,'');assert.equal(root.TameshkCatalogImages.transactionFields(row).imageData,'');event('change');assert.equal(row.dataset.imageData,imageB);assert.equal(row.querySelector('.item-price').value,'45');name.value='';event('input','deleteContentBackward');assert.equal(row.dataset.serviceId,'');assert.equal(row.dataset.imageData,undefined);name.value='Independent';event('input','insertText',{data:null});assert.equal(row.dataset.imageData,imageB,'same independent service restores without change');assert.equal(row.dataset.serviceId,'svc1');
});
for(const widget of [false,true])for(const showEntry of [false,true])test(`${widget?'widget':'main'} independent service entry preview ${showEntry}: checkbox invoice choice is independent; same-service reselection`,()=>{
 const f=fixture(false,widget),{root,row,state,event}=f;state.settings.showImagesInEntry=showEntry;state.services.push({id:'independent',name:'Independent',active:true,imageData:imageB,price:45,category:'Services',unit:'hour',stockUnlimited:true});
 const source=read('service-management.js');vm.runInNewContext(source.match(/function identifyRow\(row\)\{[^\n]+/)[0]+'\n'+source.match(/if\(typeof root\.syncItem==='function'\)\{[^\n]+/)[0],{root,state,services:()=>state.services,normalize:x=>String(x||'').trim().toLowerCase(),esc:x=>String(x)});
 const name=row.querySelector('.item-name'),check=row.querySelector('.item-include-image');name.value='Independent';event('input','insertText',{data:null});assert.equal(row.dataset.serviceId,'independent');assert.equal(row.querySelector('.item-image-preview').hidden,!showEntry);assert.equal(check.disabled,false);assert.equal(check.checked,false);
 for(const choice of [true,false]){check.checked=choice;for(const l of check.listeners.change)l.fn({currentTarget:check});for(const value of ['', 'Indep']){name.value=value;event('input','deleteContentBackward',{data:null});assert.equal(root.TameshkCatalogImages.transactionFields(row).imageData,'');name.value='Independent';event('input','insertText',{data:null});assert.equal(root.TameshkCatalogImages.transactionFields(row).includeImage,choice);assert.equal(row.querySelector('.item-image-preview').hidden,!showEntry)}}
 for(const choice of [false,true]){check.checked=choice;for(const l of check.listeners.change)l.fn({currentTarget:check});root.saveTransaction(false);assert.equal(state.transactions.at(-1).items[0].imageData,imageB);assert.equal(state.transactions.at(-1).items[0].includeImage,choice);}
});
