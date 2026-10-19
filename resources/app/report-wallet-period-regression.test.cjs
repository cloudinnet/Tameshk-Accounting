'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture({from='2026-10-10',to='2026-10-12'}={}) {
  const fields = {
    reportFrom: { value: from, dataset: { iso: from, calendar: 'میلادی', snapshot: from } },
    reportTo: { value: to, dataset: { iso: to, calendar: 'میلادی', snapshot: to } },
  };
  const state = {settings:{currency:'IRT',currencyDecimals:0,walletOpeningBalance:1000,walletOpeningCurrencyRecord:{currency:'IRT',currencyDecimals:0},transactionCalendar:'میلادی'},products:[],
    transactions:[
      {id:'before',date:'2026-10-09',dateCalendar:'میلادی',paymentMethod:'نقدی',total:300,currency:'IRT',currencyDecimals:0},
      {id:'in-a',date:'2026-10-10',dateCalendar:'میلادی',paymentMethod:'نقدی',total:100,currency:'IRT',currencyDecimals:0},
      {id:'in-b',date:'2026-10-11',dateCalendar:'میلادی',paymentMethod:'نقدی',total:200,currency:'IRT',currencyDecimals:0},
      {id:'after',date:'2026-10-13',dateCalendar:'میلادی',paymentMethod:'نقدی',total:999,currency:'IRT',currencyDecimals:0},
      {id:'card',date:'2026-10-11',dateCalendar:'میلادی',paymentMethod:'کارت',total:777,currency:'IRT',currencyDecimals:0},
    ],
    expenses:[
      {id:'exp-before',itemNumber:'E-000001',date:'2026-10-08',amount:100,paymentMethod:'نقدی',currency:'IRT',currencyDecimals:0},
      {id:'exp-range',itemNumber:'E-000002',date:'2026-10-11',amount:20,paymentMethod:'نقدی',currency:'IRT',currencyDecimals:0},
      {id:'exp-card',itemNumber:'E-000003',date:'2026-10-11',amount:99,paymentMethod:'کارت',currency:'IRT',currencyDecimals:0},
      {id:'exp-after',itemNumber:'E-000004',date:'2026-10-13',amount:500,paymentMethod:'نقدی',currency:'IRT',currencyDecimals:0},
    ],
    transactionReturns:[
      {id:'return-range',returnDate:'2026-10-12',refundAmount:10,refundToCash:true,currency:'IRT',currencyDecimals:0},
      {id:'return-after',returnDate:'2026-10-13',refundAmount:50,refundToCash:true,currency:'IRT',currencyDecimals:0},
    ],
    expenseReturns:[{id:'exp-return-range',returnDate:'2026-10-11',receivedAt:'2026-10-11T14:00:00.000Z',receivedToCash:true,amount:5,currency:'IRT',currencyDecimals:0}],
    creditRecords:[
      {id:'finance-before',kind:'sale',settledAt:'2026-10-08T10:00:00.000Z',paymentMethod:'نقدی',total:50,currency:'IRT',currencyDecimals:0},
      {id:'finance-expense',kind:'purchase',settledAt:'2026-10-11T10:00:00.000Z',paymentMethod:'نقدی',total:5,currency:'IRT',currencyDecimals:0},
      {id:'finance-after',kind:'sale',settledAt:'2026-10-13T10:00:00.000Z',paymentMethod:'نقدی',total:900,currency:'IRT',currencyDecimals:0},
    ],
    installments:[
      {id:'inst-before',kind:'sale',active:true,currency:'IRT',currencyDecimals:0,parts:[{paidAt:'2026-10-09T09:00:00.000Z',paymentMethod:'نقدی',amount:30}]},
      {id:'inst-expense',kind:'purchase',active:true,currency:'IRT',currencyDecimals:0,parts:[{paidAt:'2026-10-12T09:00:00.000Z',paymentMethod:'نقدی',amount:4}]},
      {id:'inst-archived',kind:'purchase',active:false,currency:'IRT',currencyDecimals:0,parts:[{paidAt:'2026-10-11T09:00:00.000Z',paymentMethod:'نقدی',amount:800}]},
    ]};
  const document = {head:{appendChild(){}},createElement(){return {style:{},classList:{add(){},remove(){}},appendChild(){},setAttribute(){}}},querySelectorAll(){return[]},getElementById(id){return fields[id]||null},activeElement:null};
  const TameshkCurrency = {
    config(record){return {currency:record?.currency||state.settings.currency||'IRT',currencyDecimals:record?.currencyDecimals??state.settings.currencyDecimals??0}},
    sameCurrency(a,b){return this.config(a).currency===this.config(b).currency},
    amount(value){return String(value)},
    symbol(){return 'تومان'}
  };
  const TameshkCalendar = {read(input){return input?.dataset?.iso||input?.value||''},parse(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)?value:null},active(){return 'میلادی'}};
  const window = {document,TameshkCurrency,TameshkCalendar,totalTx(t){return t.total}};
  const context = {window,document,state,save(){},setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'report-wallet-numbering.js'),'utf8'),context);
  return {state,window,fields};
}

test('cash-wallet opening balance is the balance before range; receipt/payment totals are limited to selected dates',()=>{
  const {window}=fixture();
  const w=window.TameshkReportWalletNumbering.walletFigures({currency:'IRT',currencyDecimals:0});
  assert.equal(w.opening,1280); // 1000 + 300 + 50 + 30 - 100
  assert.equal(w.income,305); // 100 + 200 + actual cash receipt of 5
  assert.equal(w.expenses,39); // cash expense 20 + cash return 10 + finance purchase 5 + installment 4
  assert.equal(w.balance,1546);
});

test('moving start date includes previous in-range movements in opening balance and excludes out-of-range movements from totals',()=>{
  const {window,fields}=fixture();
  fields.reportFrom.dataset.iso='2026-10-11';fields.reportFrom.value='2026-10-11';fields.reportFrom.dataset.snapshot='2026-10-11';
  const w=window.TameshkReportWalletNumbering.walletFigures({currency:'IRT',currencyDecimals:0});
  assert.equal(w.opening,1380); // the 10 Oct cash sale is now before the report interval
  assert.equal(w.income,205); // 11 Oct sale + 11 Oct actual expense-return receipt
  assert.equal(w.expenses,39); // 11/12 Oct cash movements only
  assert.equal(w.balance,1546);
});

test('editing the displayed period opening balance recalibrates the durable wallet baseline',()=>{
  const {window,state}=fixture({from:'2026-10-11',to:'2026-10-12'});
  assert.equal(window.TameshkReportWalletNumbering.saveWalletOpeningBalance('1500'),true);
  assert.equal(window.TameshkReportWalletNumbering.walletFigures({currency:'IRT',currencyDecimals:0}).opening,1500);
  assert.equal(state.settings.walletOpeningBalance,1120);
});

test('legacy undated cash movements remain visible only for an unbounded all-history report',()=>{
  const {state,window,fields}=fixture();
  state.transactions.push({id:'legacy-undated',paymentMethod:'نقدی',total:25,currency:'IRT',currencyDecimals:0});
  state.expenses.push({id:'legacy-exp',itemNumber:'E-000005',paymentMethod:'نقدی',amount:7,currency:'IRT',currencyDecimals:0});
  const ranged=window.TameshkReportWalletNumbering.walletFigures({currency:'IRT',currencyDecimals:0});
  assert.equal(ranged.income,305);assert.equal(ranged.expenses,39);
  fields.reportFrom.dataset.iso='0000-01-01';fields.reportFrom.value='0000-01-01';fields.reportFrom.dataset.snapshot='0000-01-01';
  fields.reportTo.dataset.iso='9999-12-31';fields.reportTo.value='9999-12-31';fields.reportTo.dataset.snapshot='9999-12-31';
  const all=window.TameshkReportWalletNumbering.walletFigures({currency:'IRT',currencyDecimals:0});
  assert.equal(all.income,2609);assert.equal(all.expenses,696);
});
