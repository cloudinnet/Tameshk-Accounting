/* Presentation and explicit monetary configuration; never converts stored amounts. */
(function(root){
'use strict';
const codes=['IRT','SAR','USD'];
const stateRef=()=>typeof state!=='undefined'?state:(root.state||{});
const settings=()=>stateRef().settings||{};
const language=()=>['fa','en','ar'].includes(settings().language)?settings().language:'fa';
const validCurrency=x=>typeof x==='string'&&codes.includes(x);
const validDecimals=x=>typeof x==='number'&&Number.isInteger(x)&&x>=0&&x<=4;
function config(record){const s=settings(),r=record&&typeof record==='object'?record:{};return {currency:validCurrency(r.currency)?r.currency:validCurrency(s.currency)?s.currency:'IRT',currencyDecimals:validDecimals(r.currencyDecimals)?r.currencyDecimals:validDecimals(s.currencyDecimals)?s.currencyDecimals:0}}
const locale=()=>({fa:'fa-IR',en:'en-US',ar:'ar-SA'}[language()]);
// Text-only total/discount editors do not have a native numeric mirror. Accept
// all three digit sets and decimal/grouping separators without rounding input.
function parse(value){if(typeof value==='number')return Number.isFinite(value)?value:NaN;if(value==null)return 0;const text=String(value).trim().replace(/[\u061c\u200e\u200f]/g,'').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[٬,\u00a0\u202f]/g,'').replace(/٫/g,'.').replace(/−/g,'-');const result=Number(text);return Number.isFinite(result)?result:NaN}
const number=x=>{const value=parse(x);return Number.isFinite(value)?value:0};
const symbol=record=>({IRT:{fa:'تومان',en:'toman',ar:'تومان'},SAR:{fa:'ریال سعودی',en:'SAR',ar:'ريال سعودي'},USD:{fa:'$',en:'$',ar:'$'}}[config(record).currency][language()]);
function label(code=config().currency,lang=language()){const labels={IRT:{fa:'تومان ایران (IRT)',en:'Iranian toman (IRT)',ar:'تومان إيراني (IRT)'},SAR:{fa:'ریال سعودی (SAR)',en:'Saudi riyal (SAR)',ar:'ريال سعودي (SAR)'},USD:{fa:'دلار آمریکا (USD)',en:'US dollar (USD)',ar:'دولار أمريكي (USD)'}};return labels[validCurrency(code)?code:'IRT'][['fa','en','ar'].includes(lang)?lang:'fa']}
// Decimal exponent shifting avoids the 1.005 * 100 binary tie and relative
// epsilon drift on large values; precision zero retains historical Math.round.
const shift=(n,places)=>{const [coefficient,exponent='0']=String(n).split('e');return Number(`${coefficient}e${Number(exponent)+places}`)};
const round=(value,record)=>{const n=number(value),places=config(record).currencyDecimals;if(!places)return Math.round(n)||0;const shifted=shift(n,places);if(!Number.isFinite(shifted))return n;return shift(Math.round(shifted),-places)||0};
const inputStep=record=>{const places=config(record).currencyDecimals;return places===0?'1':`0.${'0'.repeat(places-1)}1`};
const format=(value,record)=>new Intl.NumberFormat(locale(),{minimumFractionDigits:config(record).currencyDecimals,maximumFractionDigits:config(record).currencyDecimals}).format(round(value,record));
const digits=value=>new Intl.NumberFormat(locale(),{useGrouping:false,maximumFractionDigits:12}).format(number(value));
const amount=(value,record)=>{const cfg=config(record),lang=language(),sym=symbol(record),numberText=format(value,record);if(lang==='en'&&cfg.currency==='USD')return `${sym}${numberText}`;return `${numberText} ${sym}`};
function snapshot(record,source){if(!record||typeof record!=='object')return record;const cfg=config(source);if(!validCurrency(record.currency))record.currency=cfg.currency;if(!validDecimals(record.currencyDecimals))record.currencyDecimals=cfg.currencyDecimals;return record}
const retain=record=>snapshot(record,record);
const sameCurrency=(a,b)=>config(a).currency===config(b).currency;
function groupTotals(records,valueOf=x=>x.amount||0){const groups=new Map();for(const record of records||[]){const cfg=config(record),g=groups.get(cfg.currency)||{...cfg,total:0,count:0};g.total+=number(valueOf(record));g.count++;g.currencyDecimals=Math.max(g.currencyDecimals,cfg.currencyDecimals);groups.set(cfg.currency,g)}return [...groups.values()]}
function groupedAmount(records,valueOf){const groups=groupTotals(records,valueOf);return groups.length?groups.map(g=>amount(g.total,g)).join(' · '):amount(0)}
function setConfig(currency,currencyDecimals,target=stateRef()){if(!validCurrency(currency)||!validDecimals(currencyDecimals))return false;target.settings=target.settings||{};if(target.settings.currencyDefaultsPending!==true)root.TameshkCurrencyRecords1506?.migrate(target);target.settings.currency=currency;target.settings.currencyDecimals=currencyDecimals;delete target.settings.currencyDefaultsPending;return true}
/* Call only at confirmed fresh first selection/new profile, not an upgrade or UI switch. */
function initializeDefaults(lang,{fresh=false,state:target=stateRef()}={}){if(!fresh)return false;const s=target.settings||{};if(s.currencyDefaultsPending!==true&&(Object.prototype.hasOwnProperty.call(s,'currency')||Object.prototype.hasOwnProperty.call(s,'currencyDecimals')))return false;return setConfig(lang==='en'?'USD':lang==='ar'?'SAR':'IRT',lang==='en'?2:0,target)}
const api=Object.freeze({config,symbol,label,format,digits,amount,round,parse,inputStep,setConfig,initializeDefaults,validCurrency,validDecimals,snapshot,retain,sameCurrency,groupTotals,groupedAmount});
root.TameshkCurrency=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
