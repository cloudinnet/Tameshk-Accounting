'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
function canonicalHarness(){
 const src=read('enhancements-146.js');
 const a=src.indexOf('root.saveInvoiceEdits=function(id)'),b=src.indexOf('\nroot.tableTransactions=',a);
 assert.ok(a>=0&&b>a);
 const state={products:[],transactions:[{id:'qa',no:'QA',date:'2026-10-06',items:[{name:'QA',qty:2,price:100,priceAtSale:100,lineDiscount:35,includeImage:true}]}]};
 const fields={invoiceNumber:{value:'QA'},'invoiceItemQty-0':{value:'2'},'invoiceItemPrice-0':{value:'100'},'invoiceItemDiscount-0':{value:'12'},invoiceDiscount:{value:'12'},invoiceTaxOn:{checked:false},invoiceTaxRate:{value:'0'}};
 const counts={persist:0,close:0,render:0,show:0};let validDate=true;
 const root={TameshkCalendar:{read:()=>validDate?'2026-10-06':null,calendarOf:()=> 'میلادی'},showToast(){},closeModal(){counts.close++},render(){counts.render++},showInvoice(){counts.show++}};
 const d={getElementById:id=>fields[id]||null,querySelector:()=>({checked:false})};
 const n=x=>Number(x)||0;
 vm.runInNewContext(src.slice(a,b),{root,d,state,n,esc:String,tr:String,structuredClone,persist(){counts.persist++},calcTotals:()=>({subtotal:200,lineDiscount:12,discount:12,taxable:188,tax:0,total:188}),adjustLotsForEditedSale(){throw new Error('stock path should not be reached')}});
 return {root,state,fields,counts,invalidateDate(){validDate=false}};
}
test('invoice canonical save rejects validation without mutation and reports success explicitly',()=>{
 const h=canonicalHarness(),before=JSON.stringify(h.state);
 h.invalidateDate();assert.equal(h.root.saveInvoiceEdits('qa'),false);assert.equal(JSON.stringify(h.state),before);assert.deepEqual(h.counts,{persist:0,close:0,render:0,show:0});
 assert.equal(h.root.saveInvoiceEdits('missing'),false);
 const valid=canonicalHarness();valid.root.__suppressInvoiceAfterSave=true;assert.equal(valid.root.saveInvoiceEdits('qa'),true);assert.equal(valid.state.transactions[0].items[0].includeImage,false);assert.equal(valid.state.transactions[0].items[0].lineDiscount,12);assert.deepEqual(valid.counts,{persist:1,close:0,render:0,show:0});
});
function layoutHarness(success,suppressed=false){
 const src=read('transaction-form-layout.js');const a=src.indexOf("wrap('saveInvoiceEdits',old=>function(id)"),b=src.indexOf("\nwrap('tableTransactions'",a);assert.ok(a>=0&&b>a);
 const original={id:'qa',items:[{name:'QA',qty:1,price:100,lineDiscount:0}],discount:0};let state={transactions:[original]};
 const counts={persist:0,close:0,render:0,show:0,linkedExpense:0};
 const root={__suppressInvoiceAfterSave:suppressed,closeModal(){counts.close++},render(){counts.render++},showInvoice(){counts.show++},saveInvoiceEdits(){assert.equal(root.__suppressInvoiceAfterSave,true);if(success)state=structuredClone(state);return success}};
 const fields={invoiceDiscount:{value:'35'},invoiceAncillaryCost:{value:'10'},invoiceAncillaryTaxOn:{checked:false}};
 const d={getElementById:id=>fields[id]||null,querySelector:()=>null};
 const moneyTotals=()=>({subtotal:100,lineDiscount:0,discount:35,taxable:100,tax:0,total:75,ancillaryCost:10,ancillaryTax:0,ancillaryTotal:10,taxLines:[{amount:0}]});
 const context={root,d,S:()=>state,n:x=>Number(x)||0,validColor:()=>true,moneyTotals,syncAncillaryExpense(){counts.linkedExpense++},persist(){counts.persist++},wrap(name,fn){root[name]=fn(root[name])}};
 vm.runInNewContext(src.slice(a,b),context);
 return {root,counts,original,get state(){return state}};
}
test('single invoice layout wrapper does not persist or close failed saves and processes refreshed state once',()=>{
 const failure=layoutHarness(false);assert.equal(failure.root.saveInvoiceEdits('qa'),false);assert.deepEqual(failure.counts,{persist:0,close:0,render:0,show:0,linkedExpense:0});assert.equal(failure.root.__suppressInvoiceAfterSave,false);
 const success=layoutHarness(true);assert.equal(success.root.saveInvoiceEdits('qa'),true);assert.deepEqual(success.counts,{persist:1,close:1,render:1,show:1,linkedExpense:1});assert.equal(success.state.transactions[0].discount,35);assert.equal(success.state.transactions[0].ancillaryCost,10);assert.equal(success.original.discount,0,'old object is not mutated after state was replaced');
 const suppressed=layoutHarness(true,true);assert.equal(suppressed.root.saveInvoiceEdits('qa'),true);assert.equal(suppressed.root.__suppressInvoiceAfterSave,true);assert.deepEqual(suppressed.counts,{persist:1,close:0,render:0,show:0,linkedExpense:1});
 assert.ok(!read('transaction-form-layout.js').includes('saveInvoiceEditsAfterLayout'),'redundant save wrapper is absent');
});
