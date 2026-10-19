'use strict';
// Focused regression tests for the canonical sales-return writer.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ledgerSource = fs.readFileSync(path.join(__dirname, 'inventory-ledger.js'), 'utf8');
const returnsSource = fs.readFileSync(path.join(__dirname, 'returns-management.js'), 'utf8');
const controls = Object.create(null);
const ctx = {
  console, Date, Math, Number, Map, Set, Object, Array, JSON, String, Intl,
  state: {
    settings: {language:'fa'},
    products: [{id:'p1', name:'کالا', stock:0, cost:5, avgCost:5, inventoryValue:0}],
    transactions: [{id:'t1', no:'1', date:'2026-09-28', items:[
      {name:'کالای تخفیف‌دار', productId:'p1', qty:2, baseQty:2, price:100, lineDiscount:20}
    ]}],
    expenses: []
  },
  document: {getElementById(id) { return controls[id] || null; }},
  localStorage: {setItem(){}},
  save(){}, closeModal(){}, render(){}, showToast(){},
  todayISO(){ return '2026-09-28'; },
  money(x){ return String(Math.round(Number(x) || 0)); },
  esc(x){ return String(x); },
  uiText(x){ return x; }
};
ctx.window = ctx;
vm.createContext(ctx);
// Loading the legacy module first reproduces the production script order.
vm.runInContext(ledgerSource, ctx, {filename:'inventory-ledger.js'});
vm.runInContext(returnsSource, ctx, {filename:'returns-management.js'});

const api = ctx.TameshkReturnsManagement;
assert.ok(api, 'returns management API is exposed');

// The refund principal is the item's own price less its per-line discount only.
// Invoice discounts, item/invoice tax, ancillary charges and ancillary tax are excluded.
const mixedTx = {
  id:'refund-mixed', discount:10, taxOn:true, taxPercent:12,
  ancillaryCost:120, ancillaryTaxOn:true, ancillaryTaxPercent:8,
  exactTotals:{tax:21600, ancillaryTax:9.6, total:300200},
  items:[
    {name:'خودکار آبی', qty:10, baseQty:10, price:18000, priceAtSale:18000, lineDiscount:180},
    {name:'کاغذ A4', qty:1, baseQty:1, price:2610, lineDiscount:0}
  ]
};
assert.equal(api.unitRefundBase(mixedTx,0),17982,
  '10 pens at 18000 less 180 line discount returns 17982 per pen, ignoring invoice discount/tax/ancillary items');
assert.equal(api.unitRefundBase(mixedTx,1),2610,
  'other invoice fields must not change the refund principal for another line');
const fivePack = {id:'refund-five',items:[{name:'خودکار',qty:5,baseQty:5,price:18000,lineDiscount:30}]};
assert.equal(api.unitRefundBase(fivePack,0),17994,
  'five units with 30 line discount return 17994 per unit');
const convertedPack = {id:'refund-base-unit',items:[{name:'بسته',qty:2,baseQty:10,price:90000,lineDiscount:100}]};
assert.equal(api.unitRefundBase(convertedPack,0),17990,
  'when sale quantities map to base units, the net line principal is spread across base quantity');
ctx.state.transactions.push({...mixedTx,id:'t-exclude-charges',no:'EXCLUDE-CHARGES',date:'2026-09-28'});
const immutableSource = JSON.stringify(ctx.state.transactions.find(t=>t.id==='t-exclude-charges'));
Object.assign(controls,{rmQty:{value:'1'},rmAmount:{value:'17982'},rmDate:{value:'2026-09-28'},rmTime:{value:'09:30:00'},rmNote:{value:'refund principal regression'},rmRestock:{checked:false},rmRefundToCash:{checked:false}});
assert.equal(api.submitTransactionReturn('t-exclude-charges',0),true,
  'refund at the line-only amount should be accepted even with invoice tax and ancillary charges');
assert.equal(ctx.state.transactionReturns.at(-1).refundAmount,17982,
  'stored refund amount should be price less per-item discount only');
assert.equal(ctx.state.transactionReturns.at(-1).quantity,1);
assert.equal(JSON.stringify(ctx.state.transactions.find(t=>t.id==='t-exclude-charges')),immutableSource,
  'recording the return must not edit the source transaction');

// Clearing the quantity then entering it again must recalculate the amount.
// A manual edit is allowed until the quantity changes again.
ctx.state.transactions.push({id:'t-auto-refund',no:'AUTO-REFUND',date:'2026-09-28',discount:999, taxOn:true, taxPercent:15,
  ancillaryCost:500, ancillaryTaxOn:true, ancillaryTaxPercent:8,
  items:[{name:'خودکار آبی',qty:5,baseQty:5,price:18000,priceAtSale:18000,lineDiscount:30}]});
Object.assign(controls,{rmQty:{value:''},rmAmount:{value:''}});
ctx.tameshkUpdateTransactionRefund('t-auto-refund',0);
assert.equal(controls.rmAmount.value,'0','empty return quantity should make the calculated amount zero');
controls.rmQty.value='3';
ctx.tameshkUpdateTransactionRefund('t-auto-refund',0);
assert.equal(controls.rmAmount.value,'53982','entering a quantity after clearing must recalculate the refund');
controls.rmAmount.value='52000';
assert.equal(controls.rmAmount.value,'52000','the amount field remains manually editable after calculation');
controls.rmQty.value='2';
ctx.tameshkUpdateTransactionRefund('t-auto-refund',0);
assert.equal(controls.rmAmount.value,'35988','changing quantity again recalculates the amount and resets a manual override');
controls.rmQty.value='';
ctx.tameshkUpdateTransactionRefund('t-auto-refund',0);
assert.equal(controls.rmAmount.value,'0');
controls.rmQty.value='1';
ctx.tameshkUpdateTransactionRefund('t-auto-refund',0);
assert.equal(controls.rmAmount.value,'17994','quantity can be restored after being blanked to zero');

// Per-line discounts reduce the refundable principal instead of being ignored.
Object.assign(controls, {
  rmQty: {value:'2'}, rmAmount: {value:'180'}, rmDate: {value:'2026-09-28'}, rmTime: {value:'09:15:30'},
  rmNote: {value:''}, rmRestock: {checked:false}
});
assert.equal(api.submitTransactionReturn('t1', 0), true);
const t1Return = ctx.state.transactionReturns.find(r => r.transactionId === 't1');
assert.equal(t1Return.refundAmount, 180);
assert.equal(t1Return.quantity, 2);
assert.equal(t1Return.returnTime, '09:15:30');
assert.equal(t1Return.occurredAt, new Date(2026, 8, 28, 9, 15, 30).toISOString());
assert.equal(ctx.state.inventoryLedger.events.find(e => e.type === 'sale_return' && e.sourceId === 't1').occurredAt, t1Return.occurredAt);

// The old inventory-ledger entry point delegates to the canonical writer. A
// second call through the new entry point is rejected by the shared quantity cap.
ctx.state.transactions[0].items[0].lineDiscount = 0;
ctx.state.transactions.push({id:'t2', no:'2', date:'2026-09-28', items:[
  {name:'کالا', productId:'p1', qty:1, baseQty:1, price:50}
]});
Object.assign(controls, {
  ledgerReturnQty: {value:'1'}, ledgerReturnDate: {value:'2026-09-28'}, ledgerReturnTime: {value:'14:12:05'}, ledgerReturnRestock: {checked:true},
  ledgerRestock: {checked:true}, ledgerReturnNote: {value:'legacy'}
});
assert.equal(ctx.inventoryLedgerSubmitReturn('t2', 0), true);
assert.equal(ctx.state.transactionReturns.filter(r => r.transactionId === 't2').length, 1);
assert.equal(ctx.state.inventoryLedger.events.filter(e => e.type === 'sale_return' && e.sourceId === 't2').length, 1);
assert.equal(ctx.state.transactionReturns.find(r => r.transactionId === 't2').returnTime, '14:12:05');
assert.equal(ctx.state.inventoryLedger.events.find(e => e.type === 'sale_return' && e.sourceId === 't2').occurredAt, new Date(2026, 8, 28, 14, 12, 5).toISOString());
Object.assign(controls, {
  rmQty: {value:'1'}, rmAmount: {value:'50'}, rmDate: {value:'2026-09-28'},
  rmNote: {value:'duplicate'}, rmRestock: {checked:true}
});
assert.equal(api.submitTransactionReturn('t2', 0), false);
assert.equal(ctx.state.transactionReturns.filter(r => r.transactionId === 't2').length, 1);
assert.equal(ctx.state.inventoryLedger.events.filter(e => e.type === 'sale_return' && e.sourceId === 't2').length, 1);

// Legacy whole-toman rounding remains accepted for the old modal (29.7 -> 30).
ctx.state.transactions.push({id:'t3', no:'3', date:'2026-09-28', discount:10, taxOn:true, taxPercent:10, items:[
  {name:'کالای مشمول', productId:'p1', qty:2, baseQty:2, price:30},
  {name:'خدمت', qty:1, price:40}
]});
Object.assign(controls, {
  ledgerReturnQty: {value:'1'}, ledgerRestock: {checked:false}, ledgerReturnNote: {value:'rounded'}
});
assert.equal(ctx.inventoryLedgerSubmitReturn('t3', 0), true);
assert.equal(ctx.state.transactionReturns.find(r => r.transactionId === 't3').refundAmount, 30);

console.log('returns-management tests passed');


// A previous refund must not be subtracted a second time after its quantity
// has already been excluded from the remaining refundable quantity.
ctx.state.transactions.push({id:'t4',no:'4',date:'2026-09-28',items:[{name:'کالا',qty:2,price:100}]});
ctx.state.transactionReturns.push({id:'prior-t4',transactionId:'t4',lineIndex:0,quantity:1,refundAmount:20,returnDate:'2026-09-28'});
assert.equal(api.lineDue(ctx.state.transactions.find(t=>t.id==='t4'),0),100);

// Explicit cash refunds are recorded separately; non-cash refunds must not
// affect the cash wallet by default.
Object.assign(controls, {rmQty:{value:'1'},rmAmount:{value:'100'},rmDate:{value:'2026-09-28'},rmNote:{value:''},rmRestock:{checked:false},rmRefundToCash:{checked:true}});
assert.equal(api.submitTransactionReturn('t4',0),true);
assert.equal(ctx.state.transactionReturns.at(-1).refundToCash,true);

// Aggregation exposes date- and currency-scoped return adjustments to charts;
// the underlying sale record is not edited to reflect the refund.
const sourceSale = ctx.state.transactions[0];
const sourceSnapshot = JSON.stringify(sourceSale);
ctx.state.transactionReturns = [
  {id:'chart-return-1',transactionId:sourceSale.id,refundAmount:30,returnDate:'2026-09-30',currency:'USD',currencyDecimals:2},
  {id:'out-of-range',transactionId:sourceSale.id,refundAmount:99,returnDate:'2026-10-02',currency:'USD',currencyDecimals:2},
];
ctx.state.expenses = [
  {id:'legacy-chart-return',date:'2026-09-30',amount:5,category:'مرجوعی فروش',note:'older unmatched return'},
  {id:'ordinary-expense',date:'2026-09-30',amount:15,category:'ملزومات'}
];
const chartAdjustments = api.reportRefundAdjustments('2026-09-30','2026-09-30');
assert.deepEqual(Array.from(chartAdjustments, x => [x.kind,x.date,x.amount]), [
  ['transaction','2026-09-30',30], ['legacy','2026-09-30',5]
]);
assert.equal(JSON.stringify(sourceSale), sourceSnapshot, 'return aggregation must not mutate the source sale');
assert.equal(api.reportRefundAdjustments('2026-10-01','2026-10-31').length,1, 'only adjustments within the selected period are returned');
