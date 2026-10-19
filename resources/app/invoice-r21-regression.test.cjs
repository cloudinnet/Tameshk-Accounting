'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/template-manager.js','utf8');
const layout=require('./invoice-print-layout.js');
test('invoice photo is last in both header and every row, without moving row discounts',()=>{
 const fn=source.match(/function renderItems\(t,label,noTranslate=false\)\{[\s\S]*?\n  \}/)[0];
 const ctx={state:{settings:{},products:[],quickCatalog:[]},money:String,esc:String};ctx.window=ctx;
 const currencyHelper=source.match(/function currencySymbol\(record\)\{[^\n]+/)[0];
 vm.runInNewContext(currencyHelper+'\n'+fn+'\nthis.render=renderItems',ctx);
 const html=ctx.render({items:[{name:'Item',price:100,qty:2,lineDiscount:15,imageData:'data:image/png;base64,AA==',includeImage:true}]},'Items');
 assert.match(html,/<th>مبلغ ردیف \(تومان\)<\/th><th class="tm-image-column">تصویر<\/th><\/tr>/);
 assert.match(html,/<td class="tm-line-total-cell">200<small[^>]*>تخفیف کل قلم: 15 تومان<\/small><\/td><td class="tm-image-column">/);
});
test('print stamp is centered and signature stays left in the same explicit grid row',()=>{
 const css=layout.buildCss({size:'A4'});
 assert.match(css,/\.tm-stamp\{grid-column:2!important;grid-row:1!important/);
 assert.match(css,/\.tm-signature\{grid-column:3!important;grid-row:1!important/);
 assert.match(css,/width:min\(135px,100%\)!important;min-width:0!important/);
});
test('larger sheets increase stamp width and height by fifteen percent while A5 retains baseline',()=>{
 for(const orientation of ['portrait','landscape']){
  assert.match(layout.buildCss({size:'A5',orientation}),/width:min\(135px,100%\)!important;height:88px!important/);
  for(const size of ['A4','Letter'])assert.match(layout.buildCss({size,orientation}),/width:min\(155.25px,100%\)!important;height:101.2px!important/);
 }
});
test('desktop padding is suppressed by a stronger print selector and portrait metadata does not wrap label/value',()=>{
 assert.match(layout.buildCss(),/@media print\{html,html body\{[^}]*padding:0!important/);
 assert.match(layout.buildCss(),/html\[data-tameshk-print-orientation=portrait\] \.invoice-paper \.invoice-meta \.tm-field\{display:inline-flex!important;flex:0 1 auto!important;flex-wrap:nowrap!important/);
 assert.doesNotMatch(layout.buildCss(),/html\[data-tameshk-print-orientation=landscape\] \.invoice-paper \.invoice-meta \.tm-field\{display:flex/);
});
