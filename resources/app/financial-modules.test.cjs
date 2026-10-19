'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'financial-modules.js'),'utf8');

function boot(state, fields={}, lines=[]){
  const toasts=[];
  const document={
    head:{appendChild(){}},
    createElement(){return {id:'',style:{},appendChild(){},set textContent(_) {},click(){},remove(){}}},
    getElementById(key){
      if(key==='content') return null;
      if(key==='tameshk-finance-style') return null;
      if(key==='fin_taxOn') return fields.taxOn||{checked:false};
      return fields[key]||{value:''};
    },
    querySelectorAll(selector){return selector==='#fin_lines .fin-line'?lines:[]}
  };
  const ctx={
    document,state,titles:{},menuLabels:{},currentPage:'other',
    save(){ctx.saved=(ctx.saved||0)+1},
    showToast(message){toasts.push(String(message))},
    closeModal(){},openModal(html){ctx.modal=html},
    console:{error(){},warn(){}},localStorage:{setItem(){}},
    setTimeout(fn){return 0},clearTimeout(){},
    Intl,Date,Math,Number,String,JSON,Array,Object,Set,Map,Promise,
  };
  ctx.globalThis=ctx;
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(source,ctx,{filename:'financial-modules.js'});
  return {ctx,toasts};
}
function fields(values){return Object.fromEntries(Object.entries(values).map(([key,value])=>[`fin_${key}`,{value:String(value??'')}]))}
function line(values){return {querySelector(selector){const map={
  '.fl-name':'name','.fl-category':'category','.fl-qty':'qty','.fl-unit':'unit',
  '.fl-price':'price','.fl-discount':'discount','.fl-profit':'profit'};return {value:String(values[map[selector]]??'')}}}}

test('credit sale rejects a line discount above its line subtotal and tax above 100%',()=>{
  const state={settings:{language:'fa'},creditRecords:[]};
  let b=boot(state,fields({party:'Buyer',taxPercent:10}),[line({name:'Item',qty:2,price:50,discount:101})]);
  b.ctx.tameshkFinanceSaveCredit('sale','');
  assert.equal(state.creditRecords.length,0);assert.equal(b.ctx.saved,undefined);
  b=boot(state,fields({party:'Buyer',taxOn:true,taxPercent:100.01}),[line({name:'Item',qty:1,price:100,discount:0})]);
  b.ctx.tameshkFinanceSaveCredit('sale','');
  assert.equal(state.creditRecords.length,0);assert.equal(b.ctx.saved,undefined);
});

test('editing an installment plan archives the old schedule and carries paid installments once',()=>{
  const original={id:'inst-1',kind:'sale',party:'Buyer',total:100,count:2,cadence:'monthly',startDate:'2026-01-01',parts:[
    {id:'part-1',originPartId:'part-1',dueDate:'2026-01-01',amount:40,status:'paid',paidAt:'2026-01-02T10:00:00.000Z',penalty:2},
    {id:'part-2',originPartId:'part-2',dueDate:'2026-02-01',amount:60,status:'unpaid',paidAt:'',penalty:0}]};
  const state={settings:{language:'fa'},installments:[structuredClone(original)]};
  const b=boot(state,fields({party:'Buyer',total:120,count:2,cadence:'monthly',start:'2026-03-01',phone:'',address:'',freq:'daily',penalty:0}));
  b.ctx.tameshkFinanceSaveInstallment('sale','inst-1');
  assert.equal(state.installments.length,2);const archived=state.installments[0],active=state.installments[1];
  assert.equal(archived.active,false);assert.equal(archived.parts[0].amount,40);assert.equal(active.active,true);
  assert.equal(active.total,120);assert.equal(active.parts.filter(x=>x.status==='paid').length,1);
  assert.equal(active.parts.find(x=>x.status==='paid').amount,40);assert.equal(active.parts.find(x=>x.status==='paid').immutablePaid,true);
  assert.equal(active.parts.filter(x=>x.status!=='paid').reduce((s,x)=>s+x.amount,0),80);
  assert.equal(active.parts.reduce((s,x)=>s+x.amount,0),120);assert.equal(active.version,2);
});

test('a pending historical correction is applied only to a new version and leaves source details intact',()=>{
  const old={id:'old',chainId:'chain',version:1,active:false,kind:'sale',party:'Buyer',total:100,parts:[{id:'old-p',originPartId:'origin-p',amount:50,dueDate:'2026-01-01',status:'paid',paidAt:'2026-01-02T10:00:00.000Z'}]};
  const active={id:'active',chainId:'chain',version:2,active:true,kind:'sale',party:'Buyer',total:100,parts:[{id:'copy-p',originPartId:'origin-p',amount:50,dueDate:'2026-01-01',status:'paid',paidAt:'2026-01-02T10:00:00.000Z',immutablePaid:true},{id:'unpaid',originPartId:'unpaid',amount:50,dueDate:'2026-02-01',status:'unpaid'}]};
  const state={settings:{language:'fa'},installments:[old,active],installmentAmendments:[{id:'a1',chainId:'chain',originPartId:'origin-p',sourceVersionId:'old',snapshot:{...old.parts[0]},changes:{amount:50,dueDate:'2026-01-01',status:'unpaid',paidAt:''},reason:'پرداخت اشتباه بود',status:'pending'}]};
  const b=boot(state,fields({party:'Buyer',total:100,count:2,cadence:'monthly',start:'2026-03-01',phone:'',address:'',freq:'daily',penalty:0}));
  b.ctx.tameshkFinanceSaveInstallment('sale','active');
  assert.equal(state.installments[0].parts[0].status,'paid');const next=state.installments.at(-1);
  assert.equal(next.parts.some(x=>x.originPartId==='origin-p'&&x.status==='unpaid'),true);
  assert.equal(next.parts.reduce((s,x)=>s+x.amount,0),100);assert.equal(state.installmentAmendments[0].status,'applied');
});

test('a paid mistake in an archived plan can only be corrected through a reasoned amendment applied to a later version',()=>{
  const old={id:'old',chainId:'chain',version:1,active:false,archived:true,kind:'sale',party:'Buyer',total:100,parts:[{id:'old-p',originPartId:'origin-p',amount:40,dueDate:'2026-01-01',status:'paid',paidAt:'2026-01-02T10:00:00.000Z'},{id:'old-u',originPartId:'origin-u',amount:60,dueDate:'2026-02-01',status:'unpaid',paidAt:''}]};
  const current={id:'active',chainId:'chain',version:2,active:true,kind:'sale',party:'Buyer',total:100,parts:[{id:'copy-p',originPartId:'origin-p',amount:40,dueDate:'2026-01-01',status:'paid',paidAt:'2026-01-02T10:00:00.000Z',immutablePaid:true},{id:'copy-u',originPartId:'origin-u',amount:60,dueDate:'2026-02-01',status:'unpaid',paidAt:''}]};
  const state={settings:{language:'fa'},installments:[old,current],installmentAmendments:[]};
  const f=fields({amendAmount:40,amendDue:'2026-01-01',amendStatus:'unpaid',amendPaidAt:'',amendReason:'پرداخت به اشتباه ثبت شده بود',party:'Buyer',total:100,count:2,cadence:'monthly',start:'2026-03-01',phone:'',address:'',freq:'daily',penalty:0}),b=boot(state,f);
  b.ctx.tameshkFinanceSaveInstallmentAmendment('old',0);
  assert.equal(old.parts[0].status,'paid');assert.equal(old.parts[0].paidAt,'2026-01-02T10:00:00.000Z');
  assert.equal(state.installmentAmendments[0].status,'pending');assert.equal(state.installmentAmendments[0].reason,'پرداخت به اشتباه ثبت شده بود');
  b.ctx.tameshkFinanceSaveInstallment('sale','active');
  const next=state.installments.at(-1);assert.equal(state.installmentAmendments[0].status,'applied');
  assert.equal(next.parts.some(p=>p.originPartId==='origin-p'&&p.status==='unpaid'),true);assert.equal(next.parts.filter(p=>p.status==='paid').length,0);
  assert.equal(next.parts.reduce((s,p)=>s+p.amount,0),100);
});

test('archived plans cannot be directly edited or deleted',()=>{
  const state={settings:{language:'fa'},installments:[{id:'old',chainId:'chain',active:false,kind:'sale',total:50,parts:[{id:'p',amount:50,dueDate:'2026-01-01',status:'unpaid'}]}]};
  const b=boot(state,fields({party:'Buyer',total:50,count:2,cadence:'monthly',start:'2026-01-01',freq:'daily',penalty:0}));
  b.ctx.tameshkFinanceSaveInstallment('sale','old');assert.equal(state.installments.length,1);
  b.ctx.tameshkFinanceDelete('installments','old');assert.equal(state.installments.length,1);
});

test('editing an unpaid part opens the new-version form and direct in-place commit is blocked',()=>{
  const state={settings:{language:'fa'},installments:[{id:'inst-2',chainId:'c',version:1,active:true,kind:'sale',party:'Buyer',total:100,count:2,cadence:'monthly',startDate:'2026-01-01',parts:[
    {id:'p1',amount:50,dueDate:'2026-01-01',status:'unpaid'},
    {id:'p2',amount:50,dueDate:'2026-02-01',status:'unpaid'}]}]};
  const b=boot(state,fields({partAmount:60,partDue:'2026-01-15'}));
  b.ctx.tameshkFinanceEditPart('inst-2',0);assert.match(b.ctx.modal,/ساخت نسخهٔ تازه/);
  const before=JSON.stringify(state);b.ctx.tameshkFinanceCommitPart('inst-2',0);
  assert.equal(JSON.stringify(state),before);assert.match(b.toasts.at(-1),/نسخهٔ تازهٔ برنامه/);
});

test('unpaid check remains visible in due alerts even when paidAt is populated',()=>{
  const today=new Date().toISOString().slice(0,10);
  const state={settings:{language:'fa'},checks:[{id:'check-1',status:'unpaid',paidAt:'2026-01-02T10:00:00.000Z',dueDate:today,alertLeadDays:3,number:'C-1',amount:10,direction:'issued'}]};
  const b=boot(state);
  const host={innerHTML:''};
  b.ctx.tameshkFinanceTab('checks');
  b.ctx.TameshkFinancialModules.page(host);
  assert.match(host.innerHTML,/هشدار سررسید چک/);
});

test('archived versions and carried paid parts render dimmed and without direct payment controls',()=>{
  const state={settings:{language:'fa'},installments:[
    {id:'old',chainId:'c',version:1,active:false,archived:true,kind:'sale',party:'Buyer',total:100,parts:[{id:'p1',amount:40,dueDate:'2026-01-01',status:'paid',paidAt:'2026-01-02'}]},
    {id:'current',chainId:'c',version:2,active:true,kind:'sale',party:'Buyer',total:100,parts:[{id:'p1-copy',originPartId:'p1',amount:40,dueDate:'2026-01-01',status:'paid',paidAt:'2026-01-02',immutablePaid:true},{id:'p2',amount:60,dueDate:'2026-02-01',status:'unpaid'}]}
  ]};
  const b=boot(state);b.ctx.tameshkFinanceTab('installments');const host={innerHTML:''};b.ctx.TameshkFinancialModules.page(host);
  assert.match(host.innerHTML,/style="opacity:\.52"/);assert.match(host.innerHTML,/opacity:\.58/);assert.match(host.innerHTML,/پرداخت در نسخهٔ قبلی؛ فقط مشاهده/);
  assert.doesNotMatch(host.innerHTML,/tameshkFinancePay\('current',0\)/);
});

test('an accidentally marked-paid installment must be corrected on the active version before re-versioning',()=>{ 
  const state={settings:{language:'fa'},installments:[{id:'plan',chainId:'chain',version:1,active:true,kind:'sale',party:'Buyer',total:100,count:2,cadence:'monthly',startDate:'2026-01-01',parts:[
    {id:'p1',originPartId:'p1',amount:40,dueDate:'2026-01-01',status:'paid',paidAt:'2026-01-02T10:00:00.000Z'},
    {id:'p2',originPartId:'p2',amount:60,dueDate:'2026-02-01',status:'unpaid',paidAt:''}
  ]}]};
  const f=fields({paidAt:'',party:'Buyer',total:100,count:2,cadence:'monthly',start:'2026-03-01',phone:'',address:'',freq:'daily',penalty:0}),b=boot(state,f);
  b.ctx.tameshkFinanceCommitPay('plan',0);
  assert.equal(state.installments[0].parts[0].status,'unpaid');assert.equal(state.installments[0].parts[0].paidAt,'');
  b.ctx.tameshkFinanceSaveInstallment('sale','plan');
  const archived=state.installments[0],active=state.installments[1];
  assert.equal(archived.active,false);assert.equal(archived.parts[0].status,'unpaid');
  assert.equal(active.active,true);assert.equal(active.parts.reduce((s,p)=>s+p.amount,0),100);
  assert.equal(active.parts.every(p=>p.status==='unpaid'&&!p.immutablePaid),true);
});

test('a conflicting second active version blocks re-versioning without mutation',()=>{
  const state={settings:{language:'fa'},installments:[
    {id:'one',chainId:'chain',version:1,active:true,kind:'sale',party:'Buyer',total:50,parts:[{id:'p1',amount:50,dueDate:'2026-01-01',status:'unpaid'}]},
    {id:'two',chainId:'chain',version:2,active:true,kind:'sale',party:'Buyer',total:50,parts:[{id:'p2',amount:50,dueDate:'2026-02-01',status:'unpaid'}]}
  ]};
  const b=boot(state,fields({party:'Buyer',total:50,count:1,cadence:'monthly',start:'2026-03-01',phone:'',address:'',freq:'daily',penalty:0})),before=JSON.stringify(state);
  b.ctx.tameshkFinanceSaveInstallment('sale','one');assert.equal(JSON.stringify(state),before);assert.match(b.toasts.at(-1),/چند نسخهٔ فعال/);
});

test('unsafe persisted IDs are rejected from rendered inline actions',()=>{
  const malicious='x\" onclick=\"alert(1)';
  const state={settings:{language:'fa'},creditRecords:[{id:malicious,kind:'sale',party:'Buyer',total:1,lines:[]}]};
  const b=boot(state);const host={innerHTML:''};b.ctx.TameshkFinancialModules.page(host);
  assert.doesNotMatch(host.innerHTML,/alert\(1\)/);
});
