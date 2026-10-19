'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=__dirname;
const source=fs.readFileSync(path.join(base,'workflow-polish.js'),'utf8');
const document={head:{appendChild(){}},querySelectorAll(){return[]},getElementById(){return null},createElement(){return{style:{},classList:{add(){},remove(){}},appendChild(){},replaceChildren(){},setAttribute(){}}}};
const window={document};
const context={window,document,setTimeout,clearTimeout,Date,Map,Array,Number,String,Object,Math,state:{settings:{language:'fa',transactionCalendar:'شمسی'}}};
vm.runInNewContext(fs.readFileSync(path.join(base,'calendar-input.js'),'utf8'),context);
vm.runInNewContext(source,context);
const api=window.TameshkWorkflow;

test('numeric entry accepts localized digits and separators but keeps canonical numeric values',()=>{
  assert.equal(api.normalizeNumericEntry('۱۲۳٬۴۵۶٫۷'),'123456.7');
  assert.equal(api.normalizeNumericEntry('١٢٣٤٥٦٫٧'),'123456.7');
  assert.equal(api.normalizeNumericEntry('1,25'),'1.25');
  assert.equal(api.normalizeNumericEntry('not a number'),null);
});

test('numeric display follows an explicit associated calendar, not unrelated ancestor dates',()=>{
  const input={dataset:{calendar:'قمری'}};
  assert.match(api.formatNumericValue(1234567,input),/[٠-٩]/);
  const unrelated={parentElement:{querySelector:()=>({dataset:{calendar:'قمری'}}),parentElement:null}};
  assert.match(api.formatNumericValue(1234567,unrelated),/[۰-۹]/);
  assert.match(api.formatNumericValue(1234567),/[۰-۹]/);
  assert.equal(api.formatNumericValue('not a number'),'not a number');
});

test('weekday labels use the actual local calendar date instead of a shifted instant',()=>{
  assert.match(api.weekdayLabel(new Date(2026,9,5),'fa'),/دوشنبه/);
  assert.match(api.weekdayLabel('2026-10-05','en'),/Mon/i);
  assert.match(api.weekdayLabel('2026-10-05','ar'),/الاثنين/);
  assert.equal(api.weekdayLabel('not-a-date','fa'),'');
});

test('weekly labels are ordered Saturday through Friday in Persian and Arabic, Monday through Sunday in English',()=>{
  const days=['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11'].map(key=>({key}));
  assert.deepEqual(Array.from(api.orderWeekdays(days,'fa'),x=>x.key),['2026-10-10','2026-10-11','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
  assert.deepEqual(Array.from(api.orderWeekdays(days,'ar'),x=>x.key),['2026-10-10','2026-10-11','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
  assert.deepEqual(Array.from(api.orderWeekdays(days,'en'),x=>x.key),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11']);
});

test('weekly activity aggregates sales and expenses across the trailing seven calendar dates',()=>{
  const week=api.weekStats([
    {date:'2026-09-28',total:120},
    {date:'2026-10-04',total:75},
    {date:'2026-10-05',total:999},
  ],[
    {date:'2026-09-28',amount:20},
    {date:'2026-10-04',amount:15},
    {date:'2026-10-05',amount:100},
  ],new Date(2026,9,4),t=>t.total);
  assert.equal(week.length,7);
  assert.equal(week[0].key,'2026-09-28');
  assert.equal(week[0].sales,120);
  assert.equal(week[0].saleCount,1);
  assert.equal(week[6].key,'2026-10-04');
  assert.equal(week[6].sales,75);
  assert.equal(week[6].expense,15);
  assert.equal(week[6].expenseCount,1);
});

test('weekly activity subtracts return adjustments on their return date without mutating or removing the original sale',()=>{
  const sale={id:'sale-1',date:'2026-10-04',total:100};
  const returned=api.weekStats([sale],[],new Date(2026,9,4),t=>t.total,[
    {date:'2026-10-04',amount:30,record:{dateCalendar:'میلادی'}},
    {date:'2026-10-03',amount:20,record:{dateCalendar:'میلادی'}}
  ]);
  const day=returned.find(x=>x.key==='2026-10-04');
  assert.equal(day.sales,70);
  assert.equal(day.refunds,30);
  assert.equal(day.returnCount,1);
  assert.equal(day.saleCount,1,'a return is an adjustment, not an extra deletion of the source transaction');
  assert.equal(sale.total,100,'the original transaction remains unchanged');
});

test('weekly activity can display a net negative day when a return exceeds that day sales',()=>{
  const week=api.weekStats([],[],new Date(2026,9,4),t=>t.total,[{date:'2026-10-04',amount:25,record:{dateCalendar:'میلادی'}}]);
  const day=week.find(x=>x.key==='2026-10-04');
  assert.equal(day.sales,-25);
  assert.equal(day.refunds,25);
  assert.equal(day.saleCount,0);
});

test('weekly activity includes the six preceding days even across a Monday week boundary',()=>{
  const week=api.weekStats([{date:'2026-10-04',total:80},{date:'2026-10-05',total:120}],
    [{date:'2026-10-04',amount:12},{date:'2026-10-05',amount:18}],new Date(2026,9,5),t=>t.total);
  assert.equal(week[0].key,'2026-09-29');
  assert.equal(week[5].key,'2026-10-04');
  assert.equal(week[5].sales,80);
  assert.equal(week[5].expense,12);
  assert.equal(week[6].key,'2026-10-05');
  assert.equal(week[6].sales,120);
  assert.equal(week[6].expense,18);
});

test('mixed-calendar historical record dates normalize to Gregorian ISO for search and reports',()=>{
  assert.equal(api.dateToISO('۱۴۰۴/۱/۱','شمسی'),'2025-03-21');
  assert.equal(api.dateToISO('١٤٤٦/٩/٢١','قمری'),'2025-03-21');
  const old={date:'۱۴۰۴/۱/۱',dateCalendar:'شمسی',no:'legacy'};
  assert.equal(api.searchMatch(old,['date'],'2025-03-21',api.itemVals),true);
  const mixed=api.weekStats([old],[],new Date(2025,2,21),()=>1);
  assert.equal(mixed.find(x=>x.key==='2025-03-21')?.saleCount,1);
});

test('search uses selected fields and supports partial invoice and normalized Persian digits',()=>{
  const t={no:'T-00125',customer:'علی ن',items:[{name:'کاغذ A4',qty:2,price:1200}],date:'2026-10-04'};
  assert.equal(api.searchMatch(t,['invoice'],'۱۲۵',api.itemVals),true);
  assert.equal(api.searchMatch(t,['customer'],'کاغذ',api.itemVals),false);
  assert.equal(api.searchMatch(t,['items'],'کاغذ a4',api.itemVals),true);
});

test('expense search exposes amount, category, date, details, quantity, price, and payment method',()=>{
  const x={title:'خرید کاغذ',category:'ملزومات',date:'2026-10-04',note:'فاکتور ۱۳۲',amount:2400,qty:2,unitPrice:1200,paymentMethod:'نقدی'};
  assert.equal(api.searchMatch(x,['amount'],'2400',api.expenseVals),true);
  assert.equal(api.searchMatch(x,['note'],'۱۳۲',api.expenseVals),true);
  assert.equal(api.searchMatch(x,['paymentMethod'],'نقدی',api.expenseVals),true);
});

test('save and expense forms retain a shared expense time and show a blank per-row slot',()=>{
  const html=fs.readFileSync(path.join(base,'transaction-enhancements.js'),'utf8');
  const workflow=source;
  const layout=fs.readFileSync(path.join(base,'transaction-form-layout.js'),'utf8');
  assert.match(html,/id="exTime" type="time" step="1"/);
  assert.match(html,/createdAt,qty:x\.qty/);
  assert.doesNotMatch(html,/class="ex-created-at"/);
  assert.match(workflow,/expense-created-at-spacer/);
  assert.match(layout,/tm\.step='1'/);
  assert.match(layout,/const normalizedTime=\/\^\\d\{2\}:\\d\{2\}\$\/\.test\(time\)/);
});

test('newestFirst sorts by real timestamps and uses insertion order only as a tie-breaker',()=>{
  const rows=[{id:'old',createdAt:'2026-01-01T00:00:00Z'},{id:'new',createdAt:'2026-03-01T00:00:00Z'},{id:'same1',date:'2026-02-01'},{id:'same2',date:'2026-02-01'}];
  assert.deepEqual(Array.from(api.newestFirst(rows),x=>x.id),['new','same2','same1','old']);
});

test('clearing a catalog item captures the empty value before legacy sync can restore a default',()=>{
  assert.ok(source.includes("const explicitlyCleared=!!input&&!String(input.value||'').trim();const out=oldSyncItem.apply(this,arguments);if(explicitlyCleared&&input){input.value=''}"));
  assert.match(source,/row\.dataset\.productId='';row\.dataset\.serviceId='';row\.dataset\.catalogType=''/);
});

test('time-only calendar controls also receive the hour-minute-second spinner',()=>{
  const fields=fs.readFileSync(path.join(base,'calendar-fields.js'),'utf8');
  assert.match(fields,/enhanceTimeSpinner\(clock,wrap,input\)\}else/);
  assert.match(fields,/time-spin-separator/);
});
