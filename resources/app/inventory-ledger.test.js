'use strict';
// Self-contained Node tests: `node --test resources/app/inventory-ledger.test.js`
// The original inline-app globals and just the DOM controls read by wrapped handlers are mocked below.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const modulePath = path.join(__dirname, 'inventory-ledger.js');
const source = fs.readFileSync(modulePath, 'utf8');
const controls = Object.create(null);
const ctx = {
  console,
  Date,
  Math,
  Number,
  Map,
  Set,
  Object,
  Array,
  JSON,
  String,
  Intl,
  state: {
    settings:{language:'fa'}, products:[{id:'p1',name:'کالا',category:'عمومی',unit:'عدد',baseUnit:'عدد',packUnits:[],stock:10,cost:2,price:12,history:[]}],
    transactions:[], expenses:[]
  },
  localStorage:{setItem(){}},
  document:{getElementById(id){ return controls[id] || null; }},
  saved:0,
  toastMessages:[],
  modalHtml:'',
  renderCount:0,
  save(){ this.saved++; },
  showToast(message){ this.toastMessages.push(message); },
  openModal(html){ this.modalHtml=html; },
  closeModal(){},
  render(){ this.renderCount++; },
  todayISO(){ return '2026-09-28'; },
  money(value){ return String(Math.round(Number(value)||0)); },
  esc(value){ return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  addStock(id){
    const p=this.state.products.find(x=>x.id===id);
    const n=Number(this.document.getElementById('stockAdd').value);
    const factor=this.document.getElementById('stockUnit').value==='pack'?5:1;
    if (!p || !Number.isFinite(n) || n<=0) return;
    p.stock+=n*factor; this.save(); return true;
  },
  saveTransaction(){
    const p=this.state.products[0];
    const tx={id:'t-sale-1',no:'101',date:'2026-09-28',createdAt:'2026-09-28T10:00:00.000Z',items:[{name:'کالا',productId:p.id,qty:3,baseQty:3,unit:'عدد',baseUnit:'عدد',price:12,priceAtSale:12}]};
    p.stock-=3; this.state.transactions.push(tx); this.save(); return tx;
  },
  saveProduct(id){
    const p=this.state.products.find(x=>x.id===id);
    p.stock=Number(this.document.getElementById('pStock').value);
    p.cost=Number(this.document.getElementById('pCost').value);
    const price=this.document.getElementById('pPrice'); if(price) p.price=Number(price.value);
    this.save(); return p;
  },
  transactionsPage(el){el.innerHTML='<div>transactions</div>';},
  inventoryPage(el){el.innerHTML='<div>inventory</div>';}
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(source,ctx,{filename:modulePath});
const api=ctx.InventoryLedger;
assert.ok(api, 'module exposes InventoryLedger API');

// One-time legacy migration builds opening balances and average/value snapshots.
let p=ctx.state.products[0];
assert.equal(p.avgCost,2);
assert.equal(p.inventoryValue,20);
assert.equal(api.getEvents().filter(e=>e.type==='opening_balance').length,1);
const stockUp=api.setStockFromBulkImport('p1',13,{unitCost:3,persist:false,sourceId:'bulk-test-in'});
assert.equal(stockUp.ok,true);assert.equal(stockUp.delta,3);assert.equal(p.stock,13);assert.equal(p.inventoryValue,29);
const stockDown=api.setStockFromBulkImport('p1',9,{persist:false,sourceId:'bulk-test-out'});
assert.equal(stockDown.ok,true);assert.equal(stockDown.delta,-4);assert.equal(p.stock,9);assert.ok(Math.abs(p.inventoryValue-20.076923076923077)<1e-9);
assert.deepEqual(JSON.parse(JSON.stringify(api.getEvents().slice(-2).map(e=>[e.type,e.direction,e.sourceId]))),[['stock_adjustment','in','bulk-test-in'],['stock_adjustment','out','bulk-test-out']]);
vm.runInContext(source,ctx,{filename:modulePath}); // same script loaded twice must not wrap or migrate twice
assert.equal(api.getEvents().length,3);
// Restore the fixture before the independent purchase/sale scenarios below.
ctx.state.inventoryLedger.events=ctx.state.inventoryLedger.events.filter(e=>e.type==='opening_balance');p.stock=10;p.avgCost=2;p.inventoryValue=20;

// Purchase: 10 @ 2 plus 5 @ 4 yields weighted average 8/3.
Object.assign(controls,{
  stockAdd:{value:'5'}, stockUnit:{value:'عدد'}, ledgerUnitCost:{value:'4'}, ledgerSupplier:{value:'تأمین‌کننده الف'}, packNote:{value:'رسید ۱'}
});
assert.equal(ctx.addStock('p1'),true);
p=ctx.state.products[0];
assert.equal(p.stock,15);
assert.ok(Math.abs(p.avgCost-(40/15))<1e-10);
assert.equal(p.cost,4);
const purchase=api.getEvents().find(e=>e.type==='purchase_receipt');
assert.equal(purchase.quantity,5);
assert.equal(purchase.totalCost,20);
assert.match(purchase.note,/تأمین‌کننده الف/);

// Sale snapshots the pre-sale average cost before decreasing inventory value.
ctx.saveTransaction();
const sale=ctx.state.transactions[0].items[0];
assert.ok(Math.abs(sale.costAtSale-(40/15))<1e-10);
assert.ok(Math.abs(sale.cogs-8)<1e-10);
assert.ok(Math.abs(p.inventoryValue-32)<1e-10);
assert.equal(api.getEvents().filter(e=>e.type==='sale').length,1);

// Partial physical return refunds proportionally and restores stock at sale-time cost.
controls.ledgerReturnQty={value:'2'};
controls.ledgerRestock={checked:true};
controls.ledgerReturnNote={value:'بسته‌بندی باز نشده'};
assert.equal(api.submitReturn('t-sale-1',0),true);
assert.equal(p.stock,14);
assert.ok(Math.abs(p.inventoryValue-(32+2*(40/15)))<1e-10);
assert.equal(ctx.state.expenses.at(-1).category,'مرجوعی فروش');
assert.equal(ctx.state.expenses.at(-1).amount,24);
assert.equal(api.getEvents().filter(e=>e.type==='sale_return').length,1);

// Enforce remaining cap despite stale UI, without writing expense/event side effects.
controls.ledgerReturnQty={value:'2'};
const eventCountBefore=api.getEvents().length, expenseCountBefore=ctx.state.expenses.length;
assert.equal(api.submitReturn('t-sale-1',0),false);
assert.equal(api.getEvents().length,eventCountBefore);
assert.equal(ctx.state.expenses.length,expenseCountBefore);

// Return the remaining unit and verify full quantity has now been accounted for.
controls.ledgerReturnQty={value:'1'};
assert.equal(api.submitReturn('t-sale-1',0),true);
assert.equal(p.stock,15);
assert.ok(Math.abs(p.inventoryValue-40)<1e-10);
assert.equal(api.getEvents().filter(e=>e.type==='sale_return').reduce((n,e)=>n+e.quantity,0),3);

// Legacy sales without cost snapshots are explicitly marked estimated.
ctx.state.transactions.push({id:'t-legacy',items:[{name:'کالای قدیمی',productId:'p1',qty:1,baseQty:1,price:12}]});
controls.ledgerReturnQty={value:'1'};
assert.equal(api.submitReturn('t-legacy',0),true);
assert.equal(api.getEvents().at(-1).estimated,true);

// The legacy fallback refunds the item's own price less only its line discount.
// Invoice discount, item/invoice tax, ancillary charge and ancillary tax do not
// change the refund amount, even when returns-management.js has not loaded yet.
const fallbackSale = {id:'t-discount',no:'103',date:'2026-09-28',discount:10,taxOn:true,taxPercent:10,
  ancillaryCost:250,ancillaryTaxOn:true,ancillaryTaxPercent:12,items:[
  {name:'کالای مشمول',productId:'p1',qty:2,baseQty:2,price:30,lineDiscount:4},
  {name:'خدمت',productId:null,qty:1,price:40}
]};
ctx.state.transactions.push(fallbackSale);
const fallbackSaleBefore = JSON.stringify(fallbackSale);
controls.ledgerReturnQty={value:'1'}; controls.ledgerRestock={checked:false}; controls.ledgerReturnNote={value:'refund excludes invoice charges'};
assert.equal(api.submitReturn('t-discount',0),true);
assert.equal(ctx.state.expenses.at(-1).amount,28); // (2*30 - 4) / 2; no invoice tax/discount/ancillary charge
assert.equal(JSON.stringify(fallbackSale),fallbackSaleBefore, 'legacy return must not rewrite the sale transaction');

// Stock reduction uses the existing moving average; events are append-only via the public API.
controls.pStock={value:'14'}; controls.pCost={value:'9'}; controls.pPrice={value:'18'};
ctx.saveProduct('p1');
assert.equal(p.stock,14);
assert.ok(Math.abs(p.avgCost-(40/15))<1e-10);
assert.equal(api.getEvents().at(-1).type,'price_change');
assert.ok(api.getEvents().some(e=>e.type==='stock_adjustment'));
ctx.state.transactions.push({id:'t-new-price',no:'104',date:'2026-09-28',createdAt:new Date().toISOString(),items:[{name:'کالا',productId:'p1',qty:4,baseQty:4,price:18,priceAtSale:18}]});
const inventoryHost={innerHTML:'',insertAdjacentHTML(_where,html){this.innerHTML+=html;}};
ctx.inventoryPage(inventoryHost);
assert.match(inventoryHost.innerHTML,/فروش به تفکیک دورهٔ قیمت/);
assert.match(inventoryHost.innerHTML,/<td>[۴4] عدد<\/td>/);
const eventCount=api.getEvents().length;
const exposedCopy=api.getEvents(); exposedCopy.pop();
assert.equal(api.getEvents().length,eventCount);
assert.equal(typeof api.deleteEvent,'undefined');
assert.equal(typeof api.removeEvent,'undefined');

// Simulate a fresh page load from the persisted state: the migration marker prevents duplicate openings.
const persisted=JSON.parse(JSON.stringify(ctx.state));
const ctx2={state:persisted,window:null,document:{getElementById(){return null;}},localStorage:{setItem(){}},save(){},showToast(){},Date,Math,Number,Map,Set,Object,Array,JSON,String,Intl};
ctx2.window=ctx2; vm.createContext(ctx2); vm.runInContext(source,ctx2,{filename:modulePath});
assert.equal(ctx2.InventoryLedger.getEvents().length,eventCount);
assert.equal(ctx2.InventoryLedger.getEvents().filter(e=>e.type==='opening_balance').length,1);

// Multiple sale lines for one product must accumulate COGS rather than overwrite inventory value.
const ctxDup={
  state:{settings:{},products:[{id:'dup',name:'دوخطی',stock:10,cost:5}],transactions:[],expenses:[]},
  window:null,Date,Math,Number,Map,Set,Object,Array,JSON,String,Intl,
  save(){},
  saveTransaction(){
    const p=this.state.products[0]; p.stock-=2;
    this.state.transactions.push({id:'t-dup',items:[
      {name:'دوخطی',productId:'dup',qty:1,baseQty:1,price:10},
      {name:'دوخطی',productId:'dup',qty:1,baseQty:1,price:10}
    ]});
  }
};
ctxDup.window=ctxDup; vm.createContext(ctxDup); vm.runInContext(source,ctxDup,{filename:modulePath}); ctxDup.saveTransaction();
assert.equal(ctxDup.state.products[0].stock,8);
assert.equal(ctxDup.state.products[0].inventoryValue,40);
assert.equal(ctxDup.InventoryLedger.getEvents().filter(e=>e.type==='sale').reduce((n,e)=>n+e.totalCost,0),10);

// The legacy handler keeps the same per-line discount behavior when the
// canonical returns module is not loaded yet.
ctx.state.transactions.push({id:'t-line-discount-legacy',items:[
  {name:'تخفیف‌دار',productId:'p1',qty:2,baseQty:2,price:100,lineDiscount:20}
]});
controls.ledgerReturnQty={value:'1'};
controls.ledgerRestock={checked:false};
controls.ledgerReturnNote={value:'legacy discount'};
assert.equal(ctx.inventoryLedgerSubmitReturn('t-line-discount-legacy',0),true);
assert.equal(ctx.state.expenses.at(-1).amount,90);

// Bulk decreases reconcile legacy/underallocated expiry lots before consuming them,
// so the physical lot balance follows the imported stock target.
ctx.TameshkInventoryProfiles = {
  ensureState() {},
  addLot(product, quantity) {
    product.lots = product.lots || [];
    product.lots.push({id:`reconcile-${quantity}`, remainingQty:quantity, qtyIn:quantity});
  },
  moveLots(product, quantity) {
    let left=quantity;
    for (const lot of product.lots || []) {
      const take=Math.min(left, lot.remainingQty);
      lot.remainingQty-=take; left-=take;
      if (left<=1e-9) break;
    }
  }
};
p.stock=10; p.inventoryValue=20; p.avgCost=2;
p.lots=[{id:'underallocated',remainingQty:4,qtyIn:4}];
const bulkLotFix=api.setStockFromBulkImport('p1',6,{persist:false,sourceId:'bulk-lot-fix'});
assert.equal(bulkLotFix.lotBalanceConsistent,true);
assert.equal(p.lots.reduce((sum,lot)=>sum+lot.remainingQty,0),6);

console.log('inventory-ledger tests passed');
