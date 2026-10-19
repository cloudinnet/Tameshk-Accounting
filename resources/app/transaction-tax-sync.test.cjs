'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'transaction-form-layout.js'),'utf8');
const syncStart=source.indexOf('function syncAncillaryTaxFields('),syncEnd=source.indexOf('\nfunction calcSaved(',syncStart);
const declaration=source.slice(syncStart,syncEnd);
assert.ok(syncStart>=0&&syncEnd>syncStart,'live ancillary tax sync function exists');
function harness({cost='3000',rate='',amount='',enabled=true}={}){
 const classes={rate:new Set(),amount:new Set()};
 const taxField=(key,value)=>({value,disabled:false,dataset:{},closest(){return{classList:{toggle(name,on){if(on)classes[key].add(name);else classes[key].delete(name)},remove(name){classes[key].delete(name)}}}}});
 const fields={txAncillaryCost:{value:cost},txAncillaryTaxOn:{checked:enabled},txAncillaryTaxPercent:taxField('rate',rate),txAncillaryTaxAmount:taxField('amount',amount)};
 const refreshed=[];
 const document={getElementById:id=>fields[id]||null};
 const root={TameshkWorkflow:{refreshNumericDisplays:el=>refreshed.push(el)},TameshkAncillaryAccounting:{rateFromAmount:(base,value)=>base>0?Math.round(value/base*100*10000)/10000:0}};
 const n=x=>Number(String(x??'').replace(/,/g,''))||0;
 const sync=new Function('root','d','n',`${declaration};return syncAncillaryTaxFields`)(root,document,n);
 return{fields,refreshed,sync,classes};
}
test('typing ancillary tax rate immediately derives the amount without blur',()=>{
 const h=harness({rate:'15.5'});
 h.sync('transaction','rate');
 assert.equal(h.fields.txAncillaryTaxAmount.value,'465');
 assert.equal(h.fields.txAncillaryTaxPercent.value,'15.5');
 assert.equal(h.fields.txAncillaryTaxAmount.disabled,false);
});
test('typing ancillary tax amount immediately derives the rate',()=>{
 const h=harness({amount:'600'});
 h.sync('transaction','amount');
 assert.equal(h.fields.txAncillaryTaxPercent.value,'20');
 assert.equal(h.fields.txAncillaryTaxAmount.value,'600');
 assert.equal(h.fields.txAncillaryTaxAmount.dataset.manual,'1');
});
test('disabled ancillary tax clears only the derived amount and keeps the controls blank',()=>{
 const h=harness({rate:'10',amount:'300',enabled:false});
 h.sync('transaction','rate');
 assert.equal(h.fields.txAncillaryTaxAmount.value,'');
 assert.equal(h.fields.txAncillaryTaxPercent.value,'10');
 assert.equal(h.fields.txAncillaryTaxPercent.disabled,true);
});
test('ancillary tax above 100 percent is accepted, calculated, and colors both values orange',()=>{
 const h=harness({rate:'125'});
 h.sync('transaction','rate');
 assert.equal(h.fields.txAncillaryTaxAmount.value,'3750');
 assert.equal(h.classes.rate.has('ancillary-tax-over-100'),true);
 assert.equal(h.classes.amount.has('ancillary-tax-over-100'),true);
 assert.match(source,/\.ancillary-tax-over-100 input,.ancillary-tax-over-100 \.localized-number-entry\{color:#d97706!important\}/);
 assert.match(source,/id="txAncillaryTaxPercent" type="number" min="0" step=/);
 assert.doesNotMatch(source,/id="txAncillaryTaxPercent"[^>]*max="100"/);
});
test('typing in visible numeric mirrors forwards live ancillary tax changes',()=>{
 assert.match(source,/__txAncillaryMirrorBridge/);
 assert.match(source,/native\?\.id==='txAncillaryTaxPercent'/);
 assert.match(source,/native\?\.id==='txAncillaryTaxAmount'/);
});
