/* Freeze legacy test records once; each monetary record keeps its own currency. */
(function(root){
'use strict';
if(!root||root.TameshkCurrencyRecords1506)return;
const C=root.TameshkCurrency,S=()=>typeof state!=='undefined'?state:(root.state||{});
const monetaryArrays=['transactions','products','services','quickCatalog','consolidatedInvoices','creditRecords','installments','charityRecords','installmentAmendments','checks','checkbooks','entrustments','assets','financialRecords','financials','payments','receipts','expenses','inventoryReturns','transactionReturns','expenseReturns','inventoryEvents','assetRecords','debtRecords','loanRecords','installmentRecords','checkRecords','entrustmentRecords'];
const nestedArrays=['items','lines','history','parts','payments','installments','schedule','events','priceHistory','returns'];
let busy=false;
function migrate(target=S()){
 if(!C||!target?.settings||target.settings.currencyDefaultsPending===true)return false;
 let changed=false;
 const stamp=(record,source)=>{
  if(!record||typeof record!=='object'||Array.isArray(record))return;
  if(!C.validCurrency(record.currency)||!C.validDecimals(record.currencyDecimals)){
   // A linked legacy source may not have been visited yet (for example a
   // refund adjustment preceding its expense). Never fall back to the active
   // UI profile when migrating another profile's state.
   const defaults={currency:C.validCurrency(source?.currency)?source.currency:C.validCurrency(target.settings.currency)?target.settings.currency:'IRT',currencyDecimals:C.validDecimals(source?.currencyDecimals)?source.currencyDecimals:C.validDecimals(target.settings.currencyDecimals)?target.settings.currencyDecimals:0};
   C.snapshot(record,defaults);changed=true;
  }
  for(const key of nestedArrays)for(const child of Array.isArray(record[key])?record[key]:[])stamp(child,record);
 };
 for(const key of monetaryArrays)for(const record of Array.isArray(target[key])?target[key]:[]){
  let source=key==='transactionReturns'||key==='expenseReturns'?(key==='transactionReturns'?target.transactions:target.expenses)?.find(x=>String(x.id)===String(record.transactionId||record.expenseId)):null;
  if(key==='inventoryReturns'||key==='inventoryEvents')source=target.products?.find(x=>String(x.id)===String(record.productId));
  if(key==='quickCatalog'&&record.kind==='service')source=target.services?.find(x=>String(x.id)===String(record.id));
  if(key==='installmentAmendments')source=target.installments?.find(x=>String(x.id)===String(record.sourceVersionId));
  if(key==='expenses'&&record.financeSource==='charity')source=target.charityRecords?.find(x=>String(x.id)===String(record.financeRecordId));
  if(key==='expenses'&&record.financeSource==='purchase')source=(record.financeKind==='installment'?target.installments:target.creditRecords)?.find(x=>String(x.id)===String(record.financeRecordId));
  if(key==='expenses'&&record.returnRecordId){const returned=target.expenseReturns?.find(x=>String(x.id)===String(record.returnRecordId));source=target.expenses?.find(x=>String(x.id)===String(returned?.expenseId))||returned||source;}
  stamp(record,source);
  if(key==='installmentAmendments'){stamp(record.snapshot,record);stamp(record.changes,record)}
 }
 for(const event of target.inventoryLedger?.events||[])stamp(event,target.products?.find(p=>String(p.id)===String(event.productId)));
 if(target.settings.currencyRecordsVersion!==1){target.settings.currencyRecordsVersion=1;changed=true}
 return changed;
}
function persistMigration(){if(busy)return;busy=true;try{if(migrate()){const persist=typeof save==='function'?save:root.save;if(typeof persist==='function')persist()}}finally{busy=false}}
const priorRender=root.render;if(typeof priorRender==='function')root.render=function(){persistMigration();return priorRender.apply(this,arguments)};
persistMigration();
root.TameshkCurrencyRecords1506=Object.freeze({migrate,persistMigration});
})(typeof window!=='undefined'?window:globalThis);
