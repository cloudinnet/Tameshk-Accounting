'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'currency-locale-1.50.4.js'),'utf8');
function boot(settings={},extra={}){const ctx={state:{settings,...extra},Intl,Math,Number,Object};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);return ctx;}
for(const language of ['fa','en','ar'])for(const currency of ['IRT','SAR','USD'])for(let currencyDecimals=0;currencyDecimals<=4;currencyDecimals++)test(`${language}/${currency}/${currencyDecimals}: independent format, step and rounding`,()=>{
 const c=boot({language,currency,currencyDecimals}),h=c.TameshkCurrency;
 assert.equal(h.symbol(),{IRT:{fa:'تومان',en:'toman',ar:'تومان'},SAR:{fa:'ریال سعودی',en:'SAR',ar:'ريال سعودي'},USD:{fa:'$',en:'$',ar:'$'}}[currency][language]);
 assert.equal(h.format(12.34567),new Intl.NumberFormat({fa:'fa-IR',en:'en-US',ar:'ar-SA'}[language],{minimumFractionDigits:currencyDecimals,maximumFractionDigits:currencyDecimals}).format(12.34567));
 assert.equal(h.round(12.34567),Number(12.34567.toFixed(currencyDecimals)));assert.equal(h.inputStep(),currencyDecimals===0?'1':`0.${'0'.repeat(currencyDecimals-1)}1`);
 assert.equal(h.digits(1.5),new Intl.NumberFormat({fa:'fa-IR',en:'en-US',ar:'ar-SA'}[language],{useGrouping:false,maximumFractionDigits:12}).format(1.5));
 assert.equal(h.amount(12.34567),language==='en'&&currency==='USD'?`$${h.format(12.34567)}`:`${h.format(12.34567)} ${h.symbol()}`);
});
test('first language initialization is explicit and later language switches/reloads do not reset settings',()=>{
 for(const language of ['fa','en','ar']){const c=boot({language}),h=c.TameshkCurrency;assert.equal(h.config().currency,'IRT');assert.equal(h.initializeDefaults(language,{fresh:true}),true);assert.equal(h.config().currency,{fa:'IRT',en:'USD',ar:'SAR'}[language]);assert.equal(h.config().currencyDecimals,language==='en'?2:0);h.setConfig('SAR',4);c.state.settings.language='en';assert.equal(h.initializeDefaults('en',{fresh:true}),false);const reload=boot(JSON.parse(JSON.stringify(c.state.settings)));assert.equal(reload.TameshkCurrency.config().currency,'SAR');assert.equal(reload.TameshkCurrency.config().currencyDecimals,4);const profile={settings:{language:'en'}};assert.equal(h.initializeDefaults('en',{fresh:true,state:profile}),true);assert.equal(profile.settings.currency,'USD');}
});
test('existing missing config and malformed settings fallback purely, with no historical amount changes',()=>{
 const c=boot({language:'en'},{transactions:[{items:[{qty:0.123456,price:12.3456}],exactTotals:{total:12.3456}}],expenses:[{amount:12.3456}]});const before=JSON.stringify(c.state);assert.equal(c.TameshkCurrency.initializeDefaults('en'),false);assert.equal(c.TameshkCurrency.symbol(),'toman');c.TameshkCurrency.format(12.3456);assert.equal(JSON.stringify(c.state),before);
 for(const currency of ['usd',null,123,{},'EUR'])for(const currencyDecimals of ['2',NaN,Infinity,-1,5,1.5,null]){const x=boot({currency,currencyDecimals}),s=JSON.stringify(x.state);assert.equal(x.TameshkCurrency.config().currency,'IRT');assert.equal(x.TameshkCurrency.config().currencyDecimals,0);x.TameshkCurrency.amount(12.34);assert.equal(JSON.stringify(x.state),s);assert.equal(x.TameshkCurrency.setConfig(currency,currencyDecimals),false);}
 c.TameshkCurrency.setConfig('USD',4);const records=JSON.stringify([c.state.transactions,c.state.expenses]);for(const currency of ['IRT','SAR','USD'])for(let decimals=0;decimals<=4;decimals++){c.TameshkCurrency.setConfig(currency,decimals);c.TameshkCurrency.format(12.3456);assert.equal(JSON.stringify([c.state.transactions,c.state.expenses]),records);}
});
test('cent and four-decimal tax/discount with fractional quantity; explicit ancillary amounts remain exact',()=>{
 const c=boot({currency:'USD',currencyDecimals:2,language:'fa'});vm.runInContext(fs.readFileSync(path.join(__dirname,'ancillary-accounting.js'),'utf8'),c);
 assert.equal(c.TameshkCurrency.round((12.34*0.5-0.12)*0.1),0.61);assert.equal(c.TameshkAncillaryAccounting.taxAmount(12.34,true,10),1.23);
 c.state.settings.currencyDecimals=4;assert.equal(c.TameshkCurrency.round((12.3456*0.5-0.1234)*0.1),0.6049);assert.equal(c.TameshkAncillaryAccounting.taxAmount(12.3456,true,10),1.2346);
 assert.equal(c.TameshkAncillaryAccounting.taxAmount(12.3456,true,10,0.123456),0.123456);
});
test('new installment split supports configured 4dp without changing carried paid history',()=>{
 const fields={party:'Fixture',total:'12.3456',count:'3',start:'2026-01-01',cadence:'monthly'};
 const c=boot({currency:'USD',currencyDecimals:4,language:'en'},{installments:[]});
 Object.assign(c,{document:{head:{appendChild(){}},createElement(){return {}},getElementById(id){if(id==='content')return null;if(id==='nav')return {querySelector(selector){return selector.includes('data-page=\"finance\"')?{}:null},appendChild(){}};return {value:fields[id.replace('fin_','')]||''}},querySelectorAll(){return []}},titles:{},menuLabels:{},currentPage:'other',save(){},closeModal(){},showToast(s){c.toast=s},console,setTimeout(){}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'financial-modules.js'),'utf8'),c);c.tameshkFinanceSaveInstallment('sale','');assert.equal(c.state.installments.length,1,c.toast);assert.deepEqual(Array.from(c.state.installments[0].parts,p=>p.amount),[4.1152,4.1152,4.1152]);
});
test('rounding retains legacy negative ties at precision zero, handles decimal ties and large values without epsilon drift',()=>{
 const c=boot(),h=c.TameshkCurrency;assert.equal(h.round(-1.5),-1);assert.equal(h.round(1.5),2);assert.equal(Object.is(h.round(-0.1),-0),false);
 for(let d=0;d<=4;d++){h.setConfig('USD',d);assert.equal(h.round(0),0);assert.equal(h.round(1e15),1e15);assert.equal(h.round(-1e15),-1e15);assert.equal(Object.is(h.round(-1e-10),-0),false);assert.equal(h.round(Infinity),0);}
 h.setConfig('USD',2);assert.equal(h.round(1.005),1.01);assert.equal(h.round(-1.005),-1);assert.equal(h.round(2.675),2.68);
});
