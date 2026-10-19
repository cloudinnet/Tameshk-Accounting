'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,syncShortfallExpense,rateFromAmount}=require('./ancillary-accounting.js');
test('ancillary charge and its optional tax are neutral; only uncovered amount is expense',()=>{
 const zero=calculate({cost:150,taxOn:true,taxPercent:10,taxAmount:15,finalTotal:0});assert.equal(zero.total,165);assert.equal(zero.revenue,0);assert.equal(zero.shortfall,165);
 const under=calculate({cost:150,taxOn:true,taxPercent:10,taxAmount:15,finalTotal:163});assert.equal(under.revenue,0);assert.equal(under.shortfall,2);
 const exact=calculate({cost:150,taxOn:true,taxPercent:10,taxAmount:15,finalTotal:165});assert.equal(exact.revenue,0);assert.equal(exact.shortfall,0);
 const above=calculate({cost:150,taxOn:true,taxPercent:10,taxAmount:15,finalTotal:5000});assert.equal(above.revenue,4835);assert.equal(above.shortfall,0);
});
test('ancillary tax rate is constrained to four decimal places and manual amount remains authoritative',()=>{
 assert.equal(calculate({cost:2400,taxOn:true,taxPercent:5.123456,taxAmount:120,finalTotal:500}).taxPercent,5.1235);
 assert.equal(calculate({cost:2400,taxOn:true,taxPercent:5,taxAmount:123,finalTotal:500}).taxAmount,123);
 assert.equal(calculate({cost:2400,taxOn:false,taxPercent:5,taxAmount:120,finalTotal:500}).taxAmount,0);
 assert.equal(rateFromAmount(2400,120),5);
 assert.equal(rateFromAmount(3,1),33.3333);
 assert.equal(rateFromAmount(0,120),0);
});
test('ancillary tax rates above 100 percent are retained and calculated without changing item tax rules',()=>{
 const result=calculate({cost:200,taxOn:true,taxPercent:125,finalTotal:450});
 assert.equal(result.taxPercent,125);
 assert.equal(result.taxAmount,250);
 assert.equal(result.total,450);
 assert.equal(rateFromAmount(200,250),125);
});

test('shortfall expense is upserted with invoice/date/customer and removed when fully covered',()=>{
 const state={expenses:[]},tx={id:'t1',no:'T-1',date:'2026-10-03',customer:'Ali',paymentMethod:'نقدی'};
 const b=calculate({cost:150,taxOn:true,taxPercent:10,taxAmount:15,finalTotal:163});
 const expense=syncShortfallExpense(state,tx,b);assert.equal(expense.amount,2);assert.equal(expense.title,'تخفیف/نگرفتن هزینه جانبی');assert.match(expense.note,/T-1.*2026-10-03.*Ali/);syncShortfallExpense(state,tx,b);assert.equal(state.expenses.length,1);
 syncShortfallExpense(state,tx,calculate({cost:150,taxOn:true,taxPercent:10,taxAmount:15,finalTotal:5000}));assert.equal(state.expenses.length,0);
});
