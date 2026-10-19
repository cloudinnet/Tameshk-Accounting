'use strict';
// Standalone: node resources/app/tabular-locale-1.50.4.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {deflateRawSync}=require('node:zlib');
const {chromium}=require(process.env.TAMESHK_PLAYWRIGHT||process.env.PLAYWRIGHT_MODULE||'/tmp/tameshk-qa/node_modules/playwright-core');
const app=__dirname;
const langs=['fa','en','ar'];
let checks=0;
function ok(value,message){assert.ok(value,message);checks++}
function eq(value,expected,message){assert.deepEqual(value,expected,message);checks++}
// Stored/deflated ZIP fixtures exercise the production XLSX reader, including
// inline text, numeric cells, localized digits, and shared strings.
function workbook(rows,shared=false){
 const column=index=>{let label='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;return label};
 const xml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const strings=[],cells=rows.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>{const ref=column(j)+(i+1);if(typeof v==='number')return `<c r="${ref}"><v>${v}</v></c>`;if(shared){strings.push(v);return `<c r="${ref}" t="s"><v>${strings.length-1}</v></c>`}return `<c r="${ref}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`}).join('')}</row>`).join('');
 const files=[['xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Fixture" sheetId="1" r:id="rId1"/></sheets></workbook>'],['xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'],['xl/worksheets/sheet1.xml',`<worksheet><sheetData>${cells}</sheetData></worksheet>`]];
 if(shared)files.push(['xl/sharedStrings.xml',`<sst>${strings.map(v=>`<si><t>${xml(v)}</t></si>`).join('')}</sst>`]);
 const parts=[],central=[];let offset=0;
 for(const [name,text]of files){const nb=Buffer.from(name),raw=Buffer.from(text),data=shared?deflateRawSync(raw):raw;let crc=0xffffffff;for(const byte of raw){crc^=byte;for(let i=0;i<8;i++)crc=(crc&1)?0xedb88320^(crc>>>1):crc>>>1}crc=(crc^0xffffffff)>>>0;const h=Buffer.alloc(30+nb.length);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(shared?8:0,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(nb.length,26);nb.copy(h,30);parts.push(h,data);const c=Buffer.alloc(46+nb.length);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(shared?8:0,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(nb.length,28);c.writeUInt32LE(offset,42);nb.copy(c,46);central.push(c);offset+=h.length+data.length}
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(central.reduce((n,b)=>n+b.length,0),12);end.writeUInt32LE(offset,16);return Buffer.concat([...parts,...central,end]);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.TAMESHK_CHROMIUM||process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({acceptDownloads:true});
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.evaluate(()=>{window.state={settings:{language:'fa'},products:[],services:[],quickCatalog:[]};window.save=()=>{};window.__captured=[];const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.__captured.push(blob);return original.call(this,blob)}});
  for(const file of ['tabular-locale-1.50.4.js','bulk-price-import.js'])await page.addScriptTag({content:fs.readFileSync(path.join(app,file),'utf8')});
  const downloads={};
  for(const lang of langs){
   const downloadEvent=page.waitForEvent('download');
   await page.evaluate(lang=>{state.settings.language=lang;TameshkBulkPrices.template()},lang);
   const download=await downloadEvent;
   eq(download.suggestedFilename(),'tameshk-catalog-upsert-template.csv','actual download filename');
   const downloadedBytes=fs.readFileSync(await download.path());
   ok(downloadedBytes.subarray(0,3).equals(Buffer.from([239,187,191])),'actual downloaded UTF-8 BOM');
   const captured=await page.evaluate(async()=>({text:await __captured.at(-1).text(),type:__captured.at(-1).type}));
   downloads[lang]=downloadedBytes.toString('utf8');
   eq(downloads[lang].replace(/^\uFEFF/,''),captured.text,'downloaded file equals generated blob');
   eq(captured.type,'text/csv;charset=utf-8','download MIME');
   const expectations={fa:['نوع','عنوان کالا/خدمت','قیمت فروش'],en:['Type','Item/service name','Sale price'],ar:['النوع','اسم السلعة/الخدمة','سعر البيع']};
   for(const token of expectations[lang])ok(captured.text.includes(token),`${lang} downloaded template token ${token}`);
   eq(captured.text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).length,1,'raw catalog import template contains headers only');
   ok(!/مثال کالا|مثال خدمت|Example product|Example service|مثال سلعة|مثال خدمة/.test(captured.text),'raw catalog template contains no example records');
  }
  for(const ui of langs)for(const source of langs){
   const result=await page.evaluate(({ui,csv})=>{state.settings.language=ui;state.products=[];state.services=[];state.quickCatalog=[];const rows=TameshkBulkPrices.csvRows(csv),plan=TameshkBulkPrices.buildPlan(rows);TameshkBulkPrices.applyPlan(plan);return {created:plan.summary.created,products:state.products.length,services:state.services.length}},{ui,csv:downloads[source]});
   eq(result.created,0,`empty ${source} template import under ${ui} creates no records`);eq([result.products,result.services],[0,0],'template import keeps empty catalogs empty');
  }
  for(const ui of langs)for(const source of langs){
   const csv=await page.evaluate(source=>TameshkTabular.csv([TameshkTabular.headers('rate',source),[TameshkTabular.text('product',source),'P-1','Type, "خدمة"\nSale','Category',TameshkTabular.number(12.75,source),TameshkTabular.number(6.25,source),TameshkTabular.number(1.5,source),TameshkTabular.number(99,source)]]),source);
   const data=await page.evaluate(({ui,csv})=>{state.settings.language=ui;state.products=[{id:'p1',stableCode:'P-1',name:'Type, "خدمة"\nSale',category:'Category',unit:'Service',stock:7,price:2,cost:1,ancillaryPrice:0,opaque:{value:'Type'},history:[]}];state.services=[];state.quickCatalog=[];const result=TameshkBulkPrices.buildPlan(TameshkBulkPrices.csvRows(csv));TameshkBulkPrices.applyPlan(result);return {record:state.products[0],blocked:result.summary.blocked}},{ui,csv});
   eq([data.record.price,data.record.cost,data.record.ancillaryPrice],[12.75,6.25,1.5],`${source}->${ui} exact cents`);eq(data.record.stock,7,'stock-safe existing product');eq(data.blocked,1,'unsafe stock request blocked');eq(data.record.opaque,{value:'Type'},'unknown saved fields preserved');eq([data.record.name,data.record.category,data.record.unit],['Type, "خدمة"\nSale','Category','Service'],'dictionary-collision user text untouched');
   const rows=await page.evaluate(source=>[TameshkTabular.headers('rate',source),[TameshkTabular.text('product',source),'X-1','Sale','Service',TameshkTabular.number(13.85,source),2.25,TameshkTabular.number(0.5,source),3]],source);
   for(const shared of [false,true]){
    const bytes=workbook(rows,shared);
    const imported=await page.evaluate(async({ui,bytes})=>{state.settings.language=ui;state.products=[];state.services=[];state.quickCatalog=[];const file=new File([new Uint8Array(bytes)],'test.xlsx'),rows=await TameshkBulkPrices.xlsxRows(file),result=TameshkBulkPrices.buildPlan(rows);TameshkBulkPrices.applyPlan(result);return {created:result.summary.created,record:state.products[0]}},{ui,bytes:[...bytes]});
    eq(imported.created,1,`${source}->${ui} ${shared?'shared':'inline'} XLSX`);eq([imported.record.price,imported.record.cost,imported.record.ancillaryPrice,imported.record.stock],[13.85,2.25,0.5,3],'XLSX cents and stock retained');eq([imported.record.name,imported.record.category],['Sale','Service'],'XLSX arbitrary text unchanged');
   }
  }
  const validation=await page.evaluate(()=>{state.products=[];state.services=[];state.quickCatalog=[];return {invalid:TameshkBulkPrices.buildPlan([['Type','Item/service name','Sale price'],['Product','A','-1'],['Service','B','NaN'],['wrong','C',1]]).summary.invalid,amounts:['۱۲٫۷۵','١٢٫٧٥','12.75','۰','٠','-','/','∞'].map(v=>TameshkBulkPrices.parseAmount(v)),badHeader:(()=>{try{TameshkBulkPrices.buildPlan([['garbage'],['x']]);return false}catch{return true}})()}});
  eq(validation.invalid,3,'invalid rows rejected');ok(validation.badHeader,'unsupported schema rejected');eq(validation.amounts,[{kind:'set',value:12.75},{kind:'set',value:12.75},{kind:'set',value:12.75},{kind:'keep'},{kind:'keep'},{kind:'set',value:0},{kind:'set',value:0},{kind:'invalid'}],'localized decimal and zero semantics');
  const quoted=await page.evaluate(()=>({
   semicolon:TameshkBulkPrices.csvRows('"Type, quoted, header";"Name";"Price"\r\n"Product";"=SUM(1,2)";"12.75"'),
   multiline:TameshkBulkPrices.csvRows('"Type\nwith, commas"\t"Name"\t"Price"\r\n"Product"\t"a; b, c"\t"12.75"'),
   formulas:TameshkBulkPrices.csvRows(TameshkTabular.csv([['Name','Price'],['=SUM(1,2)',12.75],['+literal\n"quoted"',1.5]]))
  }));
  eq(quoted.semicolon,[['Type, quoted, header','Name','Price'],['Product','=SUM(1,2)','12.75']],'quoted commas never override semicolon delimiter; formula-shaped text stays literal');
  eq(quoted.multiline,[['Type\nwith, commas','Name','Price'],['Product','a; b, c','12.75']],'multiline quoted first record supports TSV');
  eq(quoted.formulas,[['Name','Price'],['=SUM(1,2)','12.75'],['+literal\n"quoted"','1.5']],'CSV quoting roundtrip preserves arbitrary formula-shaped user strings');
  const wideHeaders=Array(28).fill(''),wideRow=Array(28).fill('');wideHeaders[0]='Type';wideHeaders[26]='Item/service name';wideHeaders[27]='Sale price';wideRow[0]='Product';wideRow[26]='Wide worksheet';wideRow[27]=12.75;
  const wide=await page.evaluate(async bytes=>{state.products=[];state.services=[];state.quickCatalog=[];const rows=await TameshkBulkPrices.xlsxRows(new File([new Uint8Array(bytes)],'wide.xlsx'));const plan=TameshkBulkPrices.buildPlan(rows);TameshkBulkPrices.applyPlan(plan);return{cells:rows[1].slice(26),name:state.products[0].name,price:state.products[0].price}},[...workbook([wideHeaders,wideRow])]);
  eq(wide,{cells:['Wide worksheet','12.75'],name:'Wide worksheet',price:12.75},'XLSX columns AA/AB retain distinct indexes and exact cents');
  for(const lang of langs){
   const localized=await page.evaluate(lang=>{state.settings.language=lang;const rows=[['old'],['کالا','ID-123','Type','Service','٠١٢٣','Unit-7',4,1.25,12.75,0.5]],before=JSON.stringify(rows),out=TameshkTabular.localizeRows(rows,'catalog'),xlsx=TameshkTabular.localizeRows(rows,'catalog',{numeric:false}),report=TameshkTabular.localizeRows([['old'],['فروش','INV-123','۱۴۰۵/۰۱/۰۱','2026-03-21','Sale',12.75,'Type']], 'report');return {out,xlsx,report,unchanged:before===JSON.stringify(rows)}},lang);
   ok(localized.unchanged,'central adapter input not mutated');eq(localized.out[1].slice(1,6),['ID-123','Type','Service','٠١٢٣','Unit-7'],'only known header/type/numeric columns localized');eq(localized.xlsx[1].slice(6),[4,1.25,12.75,0.5],'XLSX typed numeric values retained');eq(localized.report[1].slice(1,5),['INV-123','۱۴۰۵/۰۱/۰۱','2026-03-21','Sale'],'calendar/ISO/customer untouched');eq(localized.report[1][6],'Type','notes untouched');
  }
  for(const lang of langs)for(const currency of ['IRT','SAR','USD']){
   const currencyResult=await page.evaluate(({lang,currency})=>{state.settings={language:lang,currency,currencyDecimals:0};const symbol=TameshkTabular.currencySymbol(),headers=TameshkTabular.headers('rate'),report=TameshkTabular.headers('report');const rows=[headers,[TameshkTabular.text('product'),'M','Fraction','',TameshkTabular.number(12.7543),TameshkTabular.number(1.2345),'','']];state.products=[];state.services=[];state.quickCatalog=[];state.settings.currency=currency==='USD'?'SAR':'USD';const result=TameshkBulkPrices.buildPlan(TameshkBulkPrices.csvRows(TameshkTabular.csv(rows)));TameshkBulkPrices.applyPlan(result);return {symbol,priceHeader:headers[4],reportHeader:report[5],price:state.products[0].price,cost:state.products[0].cost}},{lang,currency});
   eq(currencyResult.symbol,currency==='USD'?'$':currency==='SAR'?'ريال':'تومان','independent selected currency');ok(currencyResult.priceHeader.endsWith(`(${currencyResult.symbol})`),'rate header selected currency');ok(currencyResult.reportHeader.endsWith(`(${currencyResult.symbol})`),'report header selected currency');eq([currencyResult.price,currencyResult.cost],[12.7543,1.2345],'precision zero/current currency do not round or convert imports');
  }
  const currencyApi=await page.evaluate(()=>{window.TameshkCurrency={symbol:()=>'$'};const value=TameshkTabular.headers('catalog')[8];delete window.TameshkCurrency;return value});ok(currencyApi.endsWith('($)'),'central header uses currency public API');
  // Also read an actual workbook from the existing catalog producer.
  await page.evaluate(()=>{state.settings={language:'fa',themes:[{id:'a',opacity:{background:100,sidebar:100,card:100}}],activeThemeId:'a'};state.products=[{id:'real-fixture',name:'Type',category:'Service',unit:'Product',stock:3,price:12.75,cost:6.25,ancillaryPrice:0.5}];state.quickCatalog=[]});
  await page.addScriptTag({content:fs.readFileSync(path.join(app,'feature-controls.js'),'utf8')});
  const actual=await page.evaluate(async()=>{exportTameshkCatalogXlsx(false);const blob=__captured.at(-1);return TameshkBulkPrices.xlsxRows(new File([blob],'catalog.xlsx'))});
  eq(actual[1].slice(1),['real-fixture','Type','Service','','Product','3','6.25','12.75','0.5'],'actual catalog XLSX decoded without cent loss');
  console.log(`tabular locale 1.50.4: ${checks} checks passed; 3 captured downloads, 9 template cross-language imports, 9 quoted CSV cross-language imports, 18 inline/shared XLSX cross-language imports, 1 actual catalog XLSX.`);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
