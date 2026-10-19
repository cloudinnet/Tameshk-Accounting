const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'finance-accounting.js'), 'utf8');

test('legacy purchase report augmentation matches stable ids with incomplete provenance, not equal expense values',()=>{
 const expenses=Array.from({length:6},(_,i)=>({id:`legacy-${i}`,title:'Identical legitimate purchase',date:'2025-01-04',amount:100,financeSource:'purchase'}));
 Object.assign(expenses[1],{financeKind:'credit'});
 Object.assign(expenses[2],{financeRecordId:'source-two'});
 Object.assign(expenses[3],{financeKind:'credit',financeRecordId:'source-three'});
 Object.assign(expenses[4],{financeKind:'credit',financeRecordId:''});
 Object.assign(expenses[5],{financeKind:'credit',financeRecordId:0});
 const state={transactions:[],expenses,creditRecords:[],installments:[],expenseReturns:[]},before=JSON.stringify(expenses),root=load(state);
 for(let i=0;i<3;i++){const report=root.reportData();assert.equal(report.ex.length,6);assert.equal(new Set(report.ex.map(x=>x.id)).size,6);assert.equal(report.expenses,600)}
 assert.equal(JSON.stringify(expenses),before);
});

test('augmentation preserves distinct ids sharing purchase provenance and equal values',()=>{
 const expenses=['first','second','third'].map(id=>({id,title:'Same',date:'2025-01-04',amount:100,financeSource:'purchase',financeKind:'credit',financeRecordId:'same-source'}));
 const state={expenses,creditRecords:[],installments:[],expenseReturns:[]},before=JSON.stringify(state);
 const root=load(state,()=>({tx:[],ex:[{...expenses[0]}],expenses:100,revenue:0,discount:0,tax:0}));
 for(let i=0;i<3;i++){const report=root.reportData();assert.deepEqual(Array.from(report.ex,x=>x.id),['first','second','third']);assert.equal(report.expenses,300)}
 assert.equal(JSON.stringify(state),before);
});

test('idless purchases match by reference only and keep distinct equal records',()=>{
 const expenses=Array.from({length:3},()=>({title:'Same',date:'2025-01-04',amount:100,financeSource:'purchase'}));
 const state={expenses,creditRecords:[],installments:[],expenseReturns:[]},before=JSON.stringify(state);
 const root=load(state,()=>({tx:[],ex:[expenses[0]],expenses:100,revenue:0,discount:0,tax:0}));
 const report=root.reportData();assert.equal(report.ex.length,3);assert.equal(report.expenses,300);
 assert.equal(JSON.stringify(state),before);
});

function load(state, baseReport) {
  const sandbox = { state, console, Date };
  sandbox.reportData = baseReport || (() => ({
    tx: state.transactions || [],
    ex: (state.expenses || []).filter(x => String(x.date || '') >= '0000' && String(x.date || '') <= '9999'),
    revenue: (state.transactions || []).reduce((sum, x) => sum + Number(x.total || 0), 0),
    discount: 0,
    tax: 0,
    expenses: (state.expenses || []).reduce((sum, x) => sum + Number(x.amount || 0), 0),
  }));
  sandbox.save = () => {};
  sandbox.document = undefined;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'finance-accounting.js' });
  return sandbox;
}

test('archived installment versions never duplicate report rows, cash flow, due-linked purchase expenses',()=>{
  const state={transactions:[],expenses:[{id:'purchase-exp-old',financeSource:'purchase',financeKind:'installment',financeRecordId:'purchase-v1',title:'نسخهٔ اولیه',category:'خرید اقساطی',date:'2025-01-01',amount:80}],expenseReturns:[],creditRecords:[],installments:[
    {id:'sale-v1',chainId:'sale-chain',version:1,active:false,archived:true,kind:'sale',recordDate:'2025-01-02',party:'Buyer',total:100,parts:[{id:'sp1',amount:40,paidAt:'2025-01-03T10:00:00.000Z',paymentMethod:'نقدی'}]},
    {id:'sale-v2',chainId:'sale-chain',version:2,active:true,kind:'sale',recordDate:'2025-01-02',party:'Buyer',total:120,parts:[{id:'sp2',amount:25,paidAt:'2025-01-04T10:00:00.000Z',paymentMethod:'نقدی'}]},
    {id:'purchase-v1',chainId:'purchase-chain',version:1,active:false,archived:true,kind:'purchase',recordDate:'2025-01-05',party:'Supplier',total:80,parts:[{id:'pp1',amount:80,paidAt:'2025-01-06T10:00:00.000Z',paymentMethod:'نقدی'}]},
    {id:'purchase-v2',chainId:'purchase-chain',version:2,active:true,kind:'purchase',recordDate:'2025-01-05',party:'Supplier',total:50,parts:[{id:'pp2',amount:20,paidAt:'2025-01-07T10:00:00.000Z',paymentMethod:'نقدی'}]}
  ]};
  const root=load(state),report=root.reportData();
  assert.deepEqual(JSON.parse(JSON.stringify(report.financeSales.map(x=>x.id))),['sale-v2']);assert.equal(report.financeRevenue,120);
  assert.deepEqual(JSON.parse(JSON.stringify(root.TameshkFinanceAccounting.cashFlows())),{income:25,expenses:20});
  assert.equal(report.financePurchaseExpenses.length,1);assert.equal(report.financePurchaseExpenses[0].financeRecordId,'purchase-v2');
  assert.equal(state.expenses.filter(x=>x.financeSource==='purchase').length,1);assert.equal(state.expenses[0].financeRecordId,'purchase-v2');assert.equal(state.expenses[0].amount,50);
});

test('finance report integration adds sales to report rows/count/chart and purchase expenses once', () => {
  const state = {
    transactions: [],
    expenses: [{ id: 'charity-1', title: 'Charity', category: 'خیریه', date: '2025-01-05', amount: 75, financeSource: 'charity' }],
    expenseReturns: [],
    creditRecords: [
      { id: 'credit-sale', kind: 'sale', recordDate: '2025-01-02', party: 'Buyer', total: 300, tax: 0, lines: [{ name: 'Service', qty: 1, price: 300, discount: 0 }] },
      { id: 'credit-purchase', kind: 'purchase', recordDate: '2025-01-04', party: 'Supplier', total: 500 },
    ],
    installments: [
      { id: 'installment-sale', kind: 'sale', recordDate: '2025-01-03', party: 'Buyer 2', total: 400, parts: [{ amount: 200 }, { amount: 200 }] },
      { id: 'installment-purchase', kind: 'purchase', recordDate: '2025-01-06', party: 'Supplier 2', total: 400, parts: [{ amount: 200 }, { amount: 200 }] },
    ],
  };
  const root = load(state);
  const report = root.reportData();

  assert.equal(report.financeRevenue, 700);
  assert.equal(report.tx.length, 2);
  assert.deepEqual(report.tx.map(x => x.financeRecordId), ['credit-sale', 'installment-sale']);
  assert.equal(report.revenue, 700);
  assert.equal(report.financePurchaseExpenses.length, 2);
  assert.equal(report.ex.filter(x => x.financeSource === 'purchase').length, 2);
  assert.equal(report.expenses, 975);
  assert.equal(report.ex.filter(x => x.financeSource === 'charity').length, 1);
  assert.equal(new Set(report.ex.map(x => x.id)).size, report.ex.length);

  // Calling reportData again must not create another expense or transaction row.
  const again = root.reportData();
  assert.equal(again.tx.length, 2);
  assert.equal(again.ex.filter(x => x.financeSource === 'purchase').length, 2);
  assert.equal(again.expenses, 975);
});
