'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {normalizeInvoicePrintOptions,normalizeInvoicePdfOptions,formatInvoicePdfFilename,registerInvoicePrint,registerInvoicePdfSave,isInvoicePrintSender}=require('./invoice-print.cjs');

test('print options use the selected physical sheet dimensions and never ask the driver to rotate twice',()=>{
  const landscape=normalizeInvoicePrintOptions({orientation:'landscape',size:'A4',marginMm:20});
  assert.equal(landscape.landscape,false);
  assert.deepEqual(landscape.pageSize,{width:297000,height:210000});
  assert.deepEqual(landscape.margins,{marginType:'none'});
  assert.equal(landscape.printBackground,true);assert.equal(landscape.silent,false);
  const portrait=normalizeInvoicePrintOptions({orientation:'portrait',size:'A4',marginMm:0});
  assert.equal(portrait.landscape,false);assert.deepEqual(portrait.pageSize,{width:210000,height:297000});
});

test('print options preserve selected portrait and landscape dimensions for every paper size',()=>{
  assert.deepEqual(normalizeInvoicePrintOptions({orientation:'landscape',size:'A5'}).pageSize,{width:210000,height:148000});
  assert.deepEqual(normalizeInvoicePrintOptions({orientation:'portrait',size:'Letter'}).pageSize,{width:215900,height:279400});
  assert.deepEqual(normalizeInvoicePrintOptions({orientation:'landscape',size:'Letter'}).pageSize,{width:279400,height:215900});
});

test('print IPC uses authorized local renderer and matching physical dimensions',async()=>{
  const handlers=new Map(),ipc={handle:(k,v)=>handlers.set(k,v)},calls=[];
  registerInvoicePrint(ipc,s=>s.local===true);
  const sender={local:true,print:(options,cb)=>{calls.push(options);cb(true,'')}};
  const result=await handlers.get('tameshk:invoice-print')({sender},{orientation:'landscape',size:'A4',marginMm:0});
  assert.equal(result.success,true);assert.deepEqual(calls[0].pageSize,{width:297000,height:210000});assert.equal(calls[0].landscape,false);
  assert.deepEqual(calls[0].margins,{marginType:'none'});
  const rejected=await handlers.get('tameshk:invoice-print')({sender:{local:false,print(){throw Error('must not print')}}},{});
  assert.equal(rejected.error,'unauthorized');
});

test('invoice printing permits only the main renderer or an authorized detached invoice on the assigned loopback origin',()=>{
  const main={getURL:()=> 'http://127.0.0.1:43822/'},origin='http://127.0.0.1:51973',allowed=sender=>sender.widget===true;
  assert.equal(isInvoicePrintSender(main,main,origin,allowed),true);
  const invoice={widget:true,getURL:()=>`${origin}/?tameshkPanel=invoice&record=x`};
  assert.equal(isInvoicePrintSender(invoice,main,origin,allowed),true);
  assert.equal(isInvoicePrintSender({widget:false,getURL:()=>`${origin}/?tameshkPanel=invoice&record=x`},main,origin,allowed),false,'a forged auxiliary page is not an authorized widget renderer');
  for(const url of [`${origin}/?tameshkWidget=toolbar`,`${origin}/?tameshkPanel=history`,`http://127.0.0.1:43822/?tameshkPanel=invoice`,`http://127.0.0.1:51973.evil/?tameshkPanel=invoice`,'https://evil.example/?tameshkPanel=invoice'])assert.equal(isInvoicePrintSender({widget:true,getURL:()=>url},main,origin,allowed),false,url);
});

test('direct PDF options preserve selected paper dimensions and rely on print CSS margins',()=>{
  const opts=normalizeInvoicePdfOptions({orientation:'landscape',size:'A5',marginMm:18});
  assert.deepEqual(opts.pageSize,{width:210000,height:148000});
  assert.equal(opts.printBackground,true);assert.equal(opts.landscape,false);assert.equal(opts.preferCSSPageSize,true);
  assert.deepEqual(opts.margins,{top:0,bottom:0,left:0,right:0});
});

test('invoice filename follows orientation, invoice number, localized calendar, and click time',()=>{
  const at=new Date(2026,9,6,19,38,53);
  assert.equal(formatInvoicePdfFilename({orientation:'portrait',invoiceNumber:'T-01004',language:'fa',timestamp:at}),'P___T-01004__1405-07-14__19-38-53.pdf');
  assert.equal(formatInvoicePdfFilename({orientation:'landscape',invoiceNumber:'T-01004',language:'en',timestamp:at}),'L___T-01004__2026-10-06__19-38-53.pdf');
  assert.equal(formatInvoicePdfFilename({orientation:'portrait',invoiceNumber:'T-01004',language:'ar',timestamp:at}),'P___T-01004__1448-04-25__19-38-53.pdf');
  assert.throws(()=>formatInvoicePdfFilename({invoiceNumber:'',timestamp:at}),/invoice number/i);
});

test('direct invoice PDF saves without a dialog inside the user Downloads subfolder and never overwrites',async t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tameshk-invoice-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const handlers=new Map(),calls=[];registerInvoicePdfSave({handle:(k,v)=>handlers.set(k,v)},s=>s.local===true,()=>temp);
  const sender={local:true,printToPDF:async options=>{calls.push(options);return Buffer.from('%PDF-test')}};
  const handler=handlers.get('tameshk:invoice-save-pdf'),raw={orientation:'landscape',size:'A4',marginMm:12,invoiceNumber:'T-01004',language:'en',requestedAt:new Date(2026,9,6,19,38,53).getTime()};
  const first=await handler({sender},raw),second=await handler({sender},raw);
  assert.equal(first.filename,'L___T-01004__2026-10-06__19-38-53.pdf');
  assert.equal(second.filename,'L___T-01004__2026-10-06__19-38-53 (2).pdf');
  const folder=path.join(temp,"Tameshk Accounting Invoice's");assert.equal(fs.readFileSync(path.join(folder,first.filename),'utf8'),'%PDF-test');
  assert.equal(calls.length,2);assert.equal(calls[0].preferCSSPageSize,true);
  const denied=await handler({sender:{local:false,printToPDF:async()=>{throw Error('must not export')}}},raw);assert.equal(denied.error,'unauthorized');
});
