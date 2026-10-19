/* Tabular boundary localization. Never translate saved catalog text or JSON keys. */
(function(root){
'use strict';
if(!root||root.TameshkTabular)return;
const languages=['fa','en','ar'];
function language(){const s=typeof state!=='undefined'?state:root.state;const value=s?.settings?.language||root.document?.documentElement?.lang;return languages.includes(value)?value:'fa'}
const labels={
 kind:['نوع','Type','النوع'],code:['شناسه/کد','Identifier/code','المعرّف/الرمز'],id:['شناسه','Identifier','المعرّف'],
 name:['عنوان کالا/خدمت','Item/service name','اسم السلعة/الخدمة'],category:['دسته','Category','الفئة'],
 barcode:['بارکد','Barcode','الباركود'],unit:['واحد پایه','Base unit','الوحدة الأساسية'],stock:['موجودی','Stock','المخزون'],
 price:['قیمت فروش','Sale price','سعر البيع'],cost:['بهای تمام‌شده','Cost price','سعر التكلفة'],ancillary:['هزینه‌های جانبی','Ancillary cost','التكاليف الإضافية'],
 product:['کالا','Product','سلعة'],service:['خدمت','Service','خدمة'],expenseItem:['مورد هزینه','Expense item','بند مصروف'],
 sale:['فروش','Sale','بيع'],expense:['هزینه','Expense','مصروف'],numberTitle:['شماره/عنوان','Number/title','الرقم/العنوان'],
 selectedDate:['تاریخ با تقویم انتخابی','Date in selected calendar','التاريخ بالتقويم المحدد'],isoDate:['تاریخ استاندارد میلادی ISO','ISO Gregorian date','التاريخ الميلادي ISO'],
 customerCategory:['نام مشتری/دسته','Customer/category','العميل/الفئة'],amount:['مبلغ','Amount','المبلغ'],note:['یادداشت','Note','ملاحظة'],
 catalogSheet:['فهرست کالاها و خدمات','Products and services','السلع والخدمات'],walkIn:['مشتری گذری','Walk-in customer','عميل عابر']
};
const schemas={rate:['kind','code','name','category','price','cost','ancillary','stock'],catalog:['kind','id','name','category','barcode','unit','stock','cost','price','ancillary'],report:['kind','numberTitle','selectedDate','isoDate','customerCategory','amount','note']};
function text(key,lang=language()){const entry=labels[key];return entry?entry[languages.indexOf(lang)>=0?languages.indexOf(lang):0]:key}
function number(value,lang=language()){const raw=String(value??'');if(lang==='en')return raw;const digits=lang==='ar'?'٠١٢٣٤٥٦٧٨٩':'۰۱۲۳۴۵۶۷۸۹';return raw.replace(/[0-9]/g,c=>digits[Number(c)]).replace(/\./g,'٫')}
function currencySymbol(record){if(typeof root.TameshkCurrency?.symbol==='function')return root.TameshkCurrency.symbol(record);const s=typeof state!=='undefined'?state:root.state;return s?.settings?.currency==='USD'?'$':s?.settings?.currency==='SAR'?'ريال':'تومان'}
function headers(schema,lang=language(),record){if(!schemas[schema])throw new Error('Unknown tabular schema');return schemas[schema].map(k=>text(k,lang)+(['price','cost','ancillary','amount'].includes(k)?` (${currencySymbol(record)})`:''))}
function localizeRows(rows,schema,{lang=language(),numeric=true,record}={}){
 if(!schemas[schema])throw new Error('Unknown tabular schema');
 const typeKeys=schema==='report'?{فروش:'sale',هزینه:'expense',Sale:'sale',Expense:'expense',بيع:'sale',مصروف:'expense'}:{کالا:'product',خدمت:'service','مورد هزینه':'expenseItem',Product:'product',Service:'service','Expense item':'expenseItem',سلعة:'product',خدمة:'service','بند مصروف':'expenseItem'};
 const numericColumns=schema==='report'?[5]:schema==='catalog'?[6,7,8,9]:[4,5,6,7];
 return rows.map((row,i)=>{if(i===0)return headers(schema,lang,record);const out=row.slice();if(Object.hasOwn(typeKeys,out[0]))out[0]=text(typeKeys[out[0]],lang);if(numeric)for(const col of numericColumns)if(typeof out[col]==='number')out[col]=number(out[col],lang);return out});
}
// This mutates only the producer's transient row matrix, not record objects.
function localizeRowsInPlace(rows,schema,options){const localized=localizeRows(rows,schema,options);rows.splice(0,rows.length,...localized);return rows}
function rateRows(lang=language()){return [headers('rate',lang)]}
function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n'}
root.TameshkTabular=Object.freeze({language,text,number,currencySymbol,headers,localizeRows,localizeRowsInPlace,rateRows,csv});
})(typeof window!=='undefined'?window:globalThis);
