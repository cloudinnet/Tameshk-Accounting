'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sources=new Map();
function load(c,name){if(!sources.has(name))sources.set(name,fs.readFileSync(path.join(__dirname,name),'utf8'));vm.runInContext(sources.get(name),c,{filename:name});}
function boot(settings={},extra={}){
 const fields=new Map(),selectors=new Map(),rows=[];
 const element=()=>({value:'',dataset:{},classList:{toggle(){},remove(){}},addEventListener(){},setAttribute(){},closest(){return null;},querySelector(){return null;},querySelectorAll(){return [];}});
 const c={state:{settings,transactions:[],products:[],expenses:[],...extra},Intl,Math,Number,Object,Date,console,
 document:{head:{appendChild(){}},body:{},activeElement:null,createElement:element,addEventListener(){},getElementById(id){return fields.get(id)||null;},querySelector(sel){return selectors.get(sel)||null;},querySelectorAll(sel){return sel==='#content #items .item-row'?rows:[];}},
 MutationObserver:class{observe(){}},titles:{},menuLabels:{},currentPage:'other',setTimeout(){},save(){},closeModal(){},render(){},showToast(s){c.toast=s;},openModal(s){c.modal=s;}};
 c.window=c;vm.createContext(c);load(c,'currency-locale-1.50.4.js');load(c,'ancillary-accounting.js');
 return {c,fields,selectors,rows,element};
}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
test('text-only monetary fields accept Persian, Arabic and English digits/separators without converting amounts',()=>{
 const {c,fields}=boot({language:'fa',currency:'USD',currencyDecimals:4});load(c,'transaction-form-layout.js');
 for(const value of ['۱۲٬۳۴۵٫۶۷۸۹','١٢٬٣٤٥٫٦٧٨٩','12,345.6789'])assert.equal(c.TameshkCurrency.parse(value),12345.6789);
 assert.ok(Number.isNaN(c.TameshkCurrency.parse('not money')));assert.equal(c.TameshkCurrency.parse('−۱٫۲۵'),-1.25);
 for(const locale of ['fa-IR','ar-SA','en-US'])assert.equal(c.TameshkCurrency.parse(new Intl.NumberFormat(locale).format(-1234.567)),-1234.567);
 fields.set('invoiceDiscountValue',{value:'۰٫۱۲۳۴'});assert.equal(c.TameshkTransactionFormLayout.currentTotals().discount,0.1234);
});
for(const currency of ['IRT','SAR','USD'])for(let decimals=0;decimals<=4;decimals++)test(`transaction tax, manual ancillary tax and display: ${currency}/${decimals}`,()=>{
 const {c,fields,selectors,element}=boot({language:'en',currency,currencyDecimals:decimals});load(c,'transaction-form-layout.js');
 const item={qty:0.5,price:12.3456,lineDiscount:0.1234,taxOn:true,taxPercent:10};
 const x=c.TameshkTransactionFormLayout.moneyTotals([item],0.2234,1.2345,true,10);
 close(x.subtotal,6.1728);close(x.lineDiscount,0.1234);close(x.discount,0.2234);
 assert.equal(x.tax,c.TameshkCurrency.round(0.60494));assert.equal(x.ancillaryTax,c.TameshkCurrency.round(0.12345));
 close(x.total,6.1728-0.2234+x.tax+1.2345+x.ancillaryTax);
 const manual=c.TameshkTransactionFormLayout.moneyTotals([item],0.2234,1.2345,true,10,0.0123456);
 assert.equal(manual.ancillaryTax,0.0123456,'explicit historical/manual ancillary amounts remain exact');
 for(const [id,value]of [['txAncillaryCost','12.3456'],['txAncillaryTaxPercent','10'],['txAncillaryTaxAmount','']]){const e=element();e.value=value;fields.set(id,e);}
 const toggle=element();toggle.checked=true;fields.set('txAncillaryTaxOn',toggle);
 const costLabel=element(),taxLabel=element();selectors.set('label[for="txAncillaryCost"]',costLabel);selectors.set('label[for="txAncillaryTaxAmount"]',taxLabel);
 c.TameshkTransactionFormLayout.syncAncillaryTaxFields('transaction','rate');
 assert.equal(Number(fields.get('txAncillaryTaxAmount').value),c.TameshkCurrency.round(1.23456));
 assert.equal(fields.get('txAncillaryCost').step,c.TameshkCurrency.inputStep());assert.equal(fields.get('txAncillaryTaxAmount').step,c.TameshkCurrency.inputStep());
 assert.equal(costLabel.textContent,`Ancillary charge (${c.TameshkCurrency.symbol()})`);
});
test('saved exactTotals and explicit ancillary amounts survive currency/precision/language changes without record mutation',()=>{
 const original={id:'tx',discount:0.123456,items:[{qty:0.123456,price:12.345678,taxOn:true,taxPercent:10}],ancillaryTaxOn:true,ancillaryTaxPercent:10,exactTotals:{subtotal:1.524147,discount:0.123456,lineDiscount:0,taxable:1.400691,tax:0.1400691,total:2.00012345,ancillaryCost:0.4,ancillaryTax:0.05936335,ancillaryTotal:0.45936335}};
 const {c}=boot({language:'en',currency:'USD',currencyDecimals:4},{transactions:[original]});load(c,'transaction-form-layout.js');const before=JSON.stringify(original);
 for(const language of ['fa','ar','en'])for(let d=0;d<=4;d++){c.state.settings.language=language;c.TameshkCurrency.setConfig('SAR',d);assert.equal(c.totalTx(original),2.00012345);assert.equal(c.taxTx(original),0.1400691);assert.equal(c.TameshkTransactionFormLayout.calcSaved(original).ancillaryTax,0.05936335);c.TameshkCurrency.amount(c.totalTx(original));assert.equal(JSON.stringify(original),before);}
});
test('transaction save persists cent taxes/exactTotals and no unrelated item text changes',()=>{
 const {c,fields,rows,element}=boot({language:'en',currency:'USD',currencyDecimals:2});
 const item={name:'نام کاربر / user',qty:0.5,price:12.34,lineDiscount:0.12};
 c.saveTransaction=()=>c.state.transactions.push({id:'saved',date:'2026-01-01',items:[{...item}],discount:0.22});
 const controls={'.item-tax-on':{checked:true},'.item-tax-rate':{value:'10'},'.item-bg-color':{dataset:{}}};rows.push({querySelector(s){return controls[s];}});
 for(const [id,value]of [['txAncillaryCost','1.25'],['txAncillaryTaxPercent','10'],['txAncillaryTaxAmount','0.13']]){const e=element();e.value=value;fields.set(id,e);}
 fields.set('txAncillaryTaxOn',{checked:true});load(c,'transaction-form-layout.js');c.saveTransaction(false);
 const saved=c.state.transactions[0];assert.equal(saved.items[0].name,item.name);assert.equal(saved.items[0].taxAmount,0.61);assert.equal(saved.exactTotals.tax,0.61);close(saved.exactTotals.total,7.94);assert.equal(saved.exactTotals.ancillaryTax,0.13);
});
function installment(c,fields,values,record=''){for(const [key,value]of Object.entries(values))fields.set('fin_'+key,{value:String(value)});c.tameshkFinanceSaveInstallment('sale',record);return c.state.installments.at(-1);}
for(let d=0;d<=4;d++)test(`minor-unit installment allocation cannot produce negative final payment (${d}dp)`,()=>{
 const {c,fields}=boot({currency:'SAR',currencyDecimals:d,language:'en'},{installments:[]});load(c,'financial-modules.js');
 const total=2*10**(-d),plan=installment(c,fields,{party:'Buyer',total,count:4,start:'2026-01-01',cadence:'monthly'});
 assert.ok(plan,c.toast);assert.ok(plan.parts.every(p=>p.amount>=0));close(plan.parts.reduce((s,p)=>s+p.amount,0),total);
});
test('reducing precision retains paid/fixed historical installment amounts and exact remainder',()=>{
 const old={id:'old',kind:'sale',active:true,total:10,parts:[{id:'paid',amount:1.2345,status:'paid',paidAt:'2026-01-01T00:00:00Z'},{id:'open',amount:8.7655,status:'unpaid'}]};
 const {c,fields}=boot({currency:'IRT',currencyDecimals:0,language:'fa'},{installments:[old]});load(c,'financial-modules.js');
 const plan=installment(c,fields,{party:'Buyer',total:10,count:2,start:'2026-01-01',cadence:'monthly'},'old');
 assert.notEqual(plan.id,'old',c.toast);assert.equal(old.parts[0].amount,1.2345);assert.equal(plan.parts[0].amount,1.2345);assert.equal(plan.parts[0].immutablePaid,true);close(plan.parts.reduce((s,p)=>s+p.amount,0),10);assert.ok(plan.parts.every(p=>p.amount>=0));
});
for(let d=0;d<=4;d++)test(`sales returns use configured ${d}dp and exclude tax, invoice discount and ancillary charges`,()=>{
 const tx={id:'sale',discount:1,items:[{name:'User service',qty:1,price:12.3456}],taxOn:true,taxPercent:10,ancillaryCost:1.2345,ancillaryTaxOn:true,ancillaryTaxPercent:10};
 const historical={id:'e',title:'User expense',amount:1.234567};
 const {c,fields}=boot({currency:'USD',currencyDecimals:d,language:'en'},{transactions:[tx],expenses:[historical]});load(c,'returns-management.js');
 fields.set('ledgerReturnQty',{value:'1'});fields.set('ledgerReturnNote',{value:'User note'});fields.set('ledgerRestock',{checked:false});
 const expected=c.TameshkCurrency.round(12.3456,tx);
 assert.ok(c.TameshkReturnsManagement.submitLegacyTransactionReturn('sale',0),c.toast);assert.equal(c.state.transactionReturns[0].refundAmount,expected);assert.equal(historical.amount,1.234567);
 const html=c.TameshkReturnsManagement.expensePanel();assert.ok(html.includes('$'));assert.ok(!html.includes('تومان'));
});
test('4dp expense return input accepts a single minor unit and cap updates never round above refund limit',()=>{
 const {c,fields,element}=boot({currency:'USD',currencyDecimals:4,language:'en'},{expenses:[{id:'expense',amount:0.0001}],transactions:[{id:'sale',items:[{qty:1,price:1.23456}]}]});load(c,'returns-management.js');
 for(const [id,value]of [['erExpense','expense'],['erAmount','0.0001'],['erDate','2026-01-01'],['rmQty','1'],['rmAmount','2']])fields.set(id,{...element(),value});
 c.tameshkExpenseReturn('expense');assert.equal(fields.get('erAmount').step,'0.0001');assert.equal(fields.get('erAmount').min,'0.0001');
 c.tameshkUpdateTransactionRefund('sale',0);assert.ok(Number(fields.get('rmAmount').value)<=1.23456);
 assert.ok(c.tameshkCreateExpenseReturn(),c.toast);assert.equal(c.state.expenseReturns[0].amount,0.0001);assert.equal(c.state.expenses.find(e=>e.returnRecordId).amount,-0.0001);
});
test('inventory ledger uses selected currency for cost/value while event count remains an integer',()=>{
 const {c}=boot({currency:'USD',currencyDecimals:2,language:'en'},{products:[{id:'p',name:'User item',stock:2,cost:1.25,price:2,baseUnit:'unit',history:[]}]});
 c.inventoryPage=()=>{};load(c,'inventory-ledger.js');const host={innerHTML:''};c.inventoryPage(host);
 assert.ok(host.innerHTML.includes('$1.25'));assert.ok(host.innerHTML.includes('$2.50'));
 assert.ok(host.innerHTML.includes('<div class="label">Events</div><div class="value">1</div>'));
 assert.ok(!host.innerHTML.includes('toman'));assert.equal(c.state.products[0].cost,1.25);
});
