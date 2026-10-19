'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'inventory-profiles.js'),'utf8');
function boot(products,{confirm=()=>true,storageFailure=false,saveProductImpl=()=>{}}={}){
  const state={settings:{language:'fa',defaultExpiryWarningDays:7,expiryAlertsEnabled:false},products,transactions:[],expenses:[]};
  const catalog={version:1,activeId:'profile-test',defaultId:'profile-test',startupPicker:false,profiles:[{id:'profile-test',name:'آزمون',icon:'آ'}]};
  const store=new Map([['tameshk-profiles-v1',JSON.stringify(catalog)],['tameshk-profile-profile-test',JSON.stringify(state)]]);
  const toasts=[];let saves=0,closed=0,renders=0;
  const localStorage={getItem(k){return store.get(k)||null},setItem(k,v){if(storageFailure===true||storageFailure==='stateOnly'&&k==='tameshk-state')throw new Error('storage full');store.set(k,String(v))},removeItem(k){store.delete(k)}};
  const document={head:{appendChild(){}},body:{appendChild(){}},documentElement:{style:{setProperty(){}}},createElement(){return {style:{setProperty(){}},appendChild(){},remove(){},dataset:{}}},getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]}};
  const ctx={state,localStorage,document,titles:{},menuLabels:{},currentPage:'inventory',confirm,showToast(x){toasts.push(String(x))},openModal(){},closeModal(){closed++},render(){renders++},save(){saves++},setInterval(){return 1},settingsPage(){},inventoryPage(el){el.innerHTML='inventory'},productModal(){},saveProduct:saveProductImpl,stockModal(){},addStock(){},saveTransaction(){},console,Date,Math,Number,Map,Set,Object,Array,JSON,String,Intl,structuredClone};
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'inventory-profiles.js'});
  return{ctx,get state(){return ctx.state},toasts,store,get saves(){return saves},get closed(){return closed},get renders(){return renders}};
}
const lot=(id,remainingQty,expiryDate='2026-12-31')=>({id,qtyIn:remainingQty,remainingQty,expiryDate,enteredAt:'2026-01-01T00:00:00.000Z',moves:[{type:'in',qty:remainingQty,at:'2026-01-01T00:00:00.000Z'}]});


test('creating a new product with opening stock creates exactly one lot and no discrepancy',()=>{
  let b;
  const saveProductImpl=()=>{b.state.products.push({id:'new-blue-pen',name:'Blue Pen',stock:10,cost:2,price:3,history:[]})};
  b=boot([],{saveProductImpl});
  b.ctx.saveProduct();
  const p=b.state.products.find(x=>x.id==='new-blue-pen');
  assert.ok(p);
  assert.equal(p.stock,10);
  assert.equal(p.lots.length,1);
  assert.equal(p.lots[0].qtyIn,10);
  assert.equal(p.lots[0].remainingQty,10);
  assert.deepEqual(JSON.parse(JSON.stringify(b.ctx.TameshkInventoryProfiles.lotDiscrepancies())),[]);
  const saved=JSON.parse(b.store.get('tameshk-profile-profile-test'));
  assert.equal(saved.products.find(x=>x.id==='new-blue-pen').lots.length,1);
});

test('no discrepancy is reported within floating-point tolerance',()=>{
  const b=boot([{id:'p',name:'کالا',stock:1.0000000001,lots:[lot('l',1)]}]);
  assert.deepEqual(JSON.parse(JSON.stringify(b.ctx.TameshkInventoryProfiles.lotDiscrepancies())),[]);
});

test('reports both discrepancy directions with the signed quantity and does not mutate stock or lots',()=>{
  const products=[{id:'short',name:'کمبود محموله',stock:7,lots:[lot('a',3),lot('b',2)]},{id:'excess',name:'مازاد محموله',stock:4,lots:[lot('c',5),lot('d',2)]}];
  const b=boot(products),before=JSON.stringify(products);
  const rows=JSON.parse(JSON.stringify(b.ctx.TameshkInventoryProfiles.lotDiscrepancies()));
  assert.deepEqual(rows.map(x=>[x.productId,x.stock,x.lotBalance,x.delta,x.direction]),[['short',7,5,2,'missing-lots'],['excess',4,7,-3,'excess-lots']]);
  assert.equal(JSON.stringify(products),before);
});

test('inventory panel rendering is side-effect free',()=>{
  const products=[{id:'p',name:'کالا',stock:5,lots:[lot('l',3)]}],b=boot(products),before=JSON.stringify(b.state);
  const host={innerHTML:'',insertAdjacentHTML(_where,html){this.innerHTML+=html}};
  b.ctx.inventoryPage(host);
  assert.match(host.innerHTML,/مغایرت موجودی و ریزمحموله‌ها/);
  assert.match(host.innerHTML,/بررسی و اصلاح دستی/);
  assert.equal(JSON.stringify(b.state),before);
});

test('confirmed missing-lot correction adds a reconciliation lot without changing stock',()=>{
  const b=boot([{id:'p',name:'کالا',stock:6,lots:[lot('a',4)]}]);
  const closed=b.closed,renders=b.renders;
  b.ctx.TameshkInventoryProfiles.confirmLotDiscrepancy('p');
  const p=b.state.products[0],persisted=JSON.parse(b.store.get('tameshk-profile-profile-test'));
  assert.equal(p.stock,6);assert.equal(p.lots.reduce((s,x)=>s+x.remainingQty,0),6);
  assert.equal(p.lots.at(-1).moves[0].note,'اصلاح دستی مغایرت موجودی و ریزمحموله‌ها');
  assert.equal(persisted.products[0].lots.reduce((s,x)=>s+x.remainingQty,0),6);assert.equal(b.closed,closed+1);assert.equal(b.renders,renders+1);
});

test('confirmed excess-lot correction is expiry-first and records every movement',()=>{
  const b=boot([{id:'p',name:'کالا',stock:5,lots:[lot('later',4,'2027-12-31'),lot('sooner',3,'2026-02-01')]}]);
  b.ctx.TameshkInventoryProfiles.confirmLotDiscrepancy('p');
  const p=b.state.products[0];
  assert.equal(p.stock,5);assert.equal(p.lots.find(x=>x.id==='sooner').remainingQty,1);assert.equal(p.lots.find(x=>x.id==='later').remainingQty,4);
  assert.equal(p.lots.find(x=>x.id==='sooner').moves.at(-1).source,'manual-lot-reconciliation');
  assert.equal(p.lots.reduce((s,x)=>s+x.remainingQty,0),5);
});

test('canceling a discrepancy correction leaves all data unchanged',()=>{
  const b=boot([{id:'p',name:'کالا',stock:5,lots:[lot('a',3)]}],{confirm:()=>false});
  const before=JSON.stringify(b.state),closed=b.closed,renders=b.renders;b.ctx.TameshkInventoryProfiles.confirmLotDiscrepancy('p');
  assert.equal(JSON.stringify(b.state),before);assert.equal(b.closed,closed);assert.equal(b.renders,renders);
});

test('a discrepancy changed before confirmation is refused without any additional mutation',()=>{
  let b,expected;const confirm=()=>{b.state.products[0].lots[0].remainingQty=1;expected=JSON.stringify(b.state);return true};
  b=boot([{id:'p',name:'کالا',stock:5,lots:[lot('a',4),lot('b',3)]}],{confirm});const closed=b.closed,renders=b.renders;
  b.ctx.TameshkInventoryProfiles.confirmLotDiscrepancy('p');
  assert.equal(JSON.stringify(b.state),expected);assert.match(b.toasts.at(-1),/مغایرت هنگام تأیید تغییر کرد/);
  assert.equal(b.closed,closed);assert.equal(b.renders,renders);
});

test('failed partial excess-lot allocation leaves every lot unchanged',()=>{
  const b=boot([{id:'p',name:'کالا',stock:1,lots:[lot('first',1,'2026-02-01'),lot('bad-second',2,'2026-12-31')]}]);b.state.products[0].lots.find(x=>x.id==='bad-second').moves=null;
  const before=JSON.stringify(b.state),closed=b.closed,renders=b.renders;b.ctx.TameshkInventoryProfiles.confirmLotDiscrepancy('p');
  assert.equal(JSON.stringify(b.state),before);assert.match(b.toasts.at(-1),/هیچ تغییری اعمال نشد/);
  assert.equal(b.closed,closed);assert.equal(b.renders,renders);
});

test('if the second profile-state write fails, storage and memory both roll back',()=>{
  const b=boot([{id:'p',name:'کالا',stock:5,lots:[lot('a',3)]}],{storageFailure:'stateOnly'});
  const before=JSON.stringify(b.state),persistedBefore=b.store.get('tameshk-profile-profile-test');
  b.ctx.TameshkInventoryProfiles.confirmLotDiscrepancy('p');
  assert.equal(JSON.stringify(b.state),before);assert.equal(b.store.get('tameshk-profile-profile-test'),persistedBefore);assert.equal(b.store.has('tameshk-state'),false);
});

test('failed persistence rolls a confirmed correction back in memory',()=>{
  const b=boot([{id:'p',name:'کالا',stock:5,lots:[lot('a',3)]}],{storageFailure:true});
  const before=JSON.stringify(b.state),closed=b.closed,renders=b.renders;b.ctx.TameshkInventoryProfiles.confirmLotDiscrepancy('p');
  assert.equal(JSON.stringify(b.state),before);assert.equal(b.closed,closed);assert.equal(b.renders,renders);
});

test('unnamed profiles get localized, unique sequential names and initials',()=>{
  const api=boot([]).ctx.TameshkInventoryProfiles;
  assert.deepEqual(JSON.parse(JSON.stringify(api.nextUserProfile('fa',[]))),{name:'کاربر',index:0});
  assert.deepEqual(JSON.parse(JSON.stringify(api.nextUserProfile('fa',[{name:'کاربر'}]))),{name:'کاربر ۲',index:2});
  assert.deepEqual(JSON.parse(JSON.stringify(api.nextUserProfile('fa',[{name:'کاربر'},{name:'کاربر ۲'}]))),{name:'کاربر ۳',index:3});
  assert.deepEqual(JSON.parse(JSON.stringify(api.nextUserProfile('en',[{name:'User'}]))),{name:'User 2',index:2});
  assert.deepEqual(JSON.parse(JSON.stringify(api.nextUserProfile('en',[{name:'user'},{name:'USER 2'}]))),{name:'User 3',index:3});
  assert.match(api.userLabel('ar',0),/مستخدم/);
  assert.equal(api.initialFor('User','en'),'U');
  assert.equal(api.initialFor('User 2','en'),'U 2');
  assert.equal(api.initialFor('ali','en'),'A');
  assert.equal(api.initialFor('کاربر ۲','fa'),'ک ۲');
  assert.equal(api.profileManagementLabel('Ali','en'),'Management: Ali');
  assert.equal(api.profileManagementLabel('علی','fa'),'مدیریت: علی');
  assert.equal(api.profileManagementLabel('المستخدم','ar'),'إدارة: المستخدم');
});
