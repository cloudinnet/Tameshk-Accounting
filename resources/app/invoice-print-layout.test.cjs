'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {pageDimensions,contentDimensions,buildCss,normalizedMargin,maximumMargin,pageMargins}=require('./invoice-print-layout.js');
const fs=require('node:fs');
const templateManager=fs.readFileSync(require('node:path').join(__dirname,'template-manager.js'),'utf8');
const workflowPolish=fs.readFileSync(require('node:path').join(__dirname,'workflow-polish.js'),'utf8');

test('paper dimensions honor portrait and landscape for every paper size',()=>{
  assert.equal(pageDimensions('A4','portrait'),'210mm 297mm');
  assert.equal(pageDimensions('A4','landscape'),'297mm 210mm');
  assert.equal(pageDimensions('A5','landscape'),'210mm 148mm');
  assert.equal(pageDimensions('Letter','landscape'),'279.4mm 215.9mm');
});

test('every sheet keeps a safe edge at zero margin and limits user margin by paper size',()=>{
  assert.equal(normalizedMargin(0,'A4','portrait'),0);
  assert.equal(normalizedMargin(15,'A4','portrait'),15);
  assert.equal(maximumMargin('A5','portrait'),14.8);
  assert.equal(normalizedMargin(100,'A5','portrait'),14.8);
  assert.equal(normalizedMargin(-2,'A4','portrait'),0);
  assert.equal(normalizedMargin(100,'A4','landscape'),21);
  assert.deepEqual(pageMargins('A4','portrait',0),{top:4,side:4,bottom:9});
  assert.deepEqual(contentDimensions('A4','landscape',0),['289mm','197mm']);
  assert.deepEqual(contentDimensions('A4','landscape',17),['272mm','180mm']);
  assert.deepEqual(contentDimensions('A4','portrait',30),['181mm','263mm']);
  assert.deepEqual(contentDimensions('A5','portrait',100),['125.2mm','182.2mm']);
});

test('landscape reflows rather than rotates and keeps the table within a bounded print area',()=>{
  const landscape=buildCss({size:'A4',orientation:'landscape',marginMm:30,language:'fa'});
  const portrait=buildCss({size:'A4',orientation:'portrait',marginMm:17,language:'en'});
  const zero=buildCss({size:'A4',orientation:'landscape',marginMm:0,language:'ar'});
  assert.match(landscape,/^@counter-style tameshk-persian/);
  assert.match(landscape,/@page\{size:297mm 210mm;margin:14.5mm 14.5mm 19.5mm;@bottom-center\{content:"برگه " counter\(page,tameshk-persian\) " از " counter\(pages,tameshk-persian\)/);
  assert.match(landscape,/width:min\(100%,268mm\)!important;inline-size:min\(100%,268mm\)!important;max-width:100%!important/);
  assert.match(zero,/@page\{size:297mm 210mm;margin:4mm 4mm 9mm;@bottom-center\{content:"برگه " counter\(page,tameshk-arabic\)/);
  assert.match(portrait,/@bottom-center\{content:"Page " counter\(page,decimal\) " of " counter\(pages,decimal\)/);
  assert.match(portrait,/width:min\(100%,185mm\)!important/);
  assert.match(landscape,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(landscape,/\.tm-signatures\{gap:12px!important;margin-top:8px!important\}/);
  assert.match(landscape,/\.tm-note\{padding:4px!important\}/);
  assert.match(landscape,/table-layout:fixed!important/);
  assert.match(landscape,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(landscape,/table:not\(:has\(thead th:nth-child\(8\)\)\).*nth-child\(1\).*width:10%!important/);
  assert.match(landscape,/table:not\(:has\(thead th:nth-child\(8\)\)\).*nth-child\(2\).*width:29%!important/);
  assert.match(landscape,/table:has\(thead th:nth-child\(8\)\).*nth-child\(1\).*width:8%!important/);
  assert.match(landscape,/table:has\(thead th:nth-child\(8\)\).*nth-child\(2\).*width:27%!important/);
  assert.doesNotMatch(landscape,/\b(?:rotate|transform)\s*:/i);
});

test('print css isolates the invoice, suppresses all other dialogs and notifications, and allows page breaks',()=>{
  const css=buildCss({size:'A5',orientation:'landscape',marginMm:20});
  assert.match(css,/body>\.modal-backdrop:not\(#modal\)\{display:none!important;visibility:hidden!important\}/);
  assert.match(css,/\.modal-backdrop:not\(#modal\)\{display:none!important\}/);
  assert.match(css,/#toast,body>\.modal-backdrop:not\(#modal\)/);
  assert.match(css,/#profileOverlay\{display:none!important;visibility:hidden!important\}/);
  assert.match(css,/#modalInner>:not\(\.invoice-paper\)\{display:none!important\}/);
  assert.match(css,/break-inside:auto!important;page-break-inside:auto!important/);
  assert.match(css,/break-inside:avoid!important;page-break-inside:avoid!important/);
  assert.match(css,/overflow-wrap:anywhere!important/);
  assert.match(css,/word-break:break-word!important/);
  assert.match(css,/max-width:100%!important/);
  assert.match(css,/orphans:3;widows:3/);
});

test('detached widget print overrides screen cascade and removes modal containment',()=>{
  const css=buildCss();
  assert.match(css,/body\.widget-panel-body\{height:auto!important;min-height:0!important;overflow:visible!important;background:#fff!important\}/);
  assert.match(css,/\.app,body\.widget-panel-body \.app\{display:none!important\}/);
  assert.doesNotMatch(css,/\.modal #modalInner\{/);
  assert.match(css,/#modalInner\{[^}]*container-type:normal!important;container-name:none!important;contain:none!important;content-visibility:visible!important/);
  assert.match(css,/#modalInner\{[^}]*background:#fff!important;border:0!important/);
});

test('invoice date uses the saved transaction calendar, never the display-both date mode',()=>{
  assert.match(templateManager,/function invoiceDateValue\(t\)/);
  assert.match(templateManager,/\['شمسی','میلادی','قمری'\]\.includes\(t\?\.dateCalendar\)/);
  assert.match(templateManager,/TameshkCalendar\?\.format\(t\?\.date,savedCalendar\)/);
  assert.doesNotMatch(templateManager,/'invoice\.date':faDate\(t\.date\)/);
});

test('print preparation validates populated paper before calling the desktop print route',()=>{
  assert.match(templateManager,/const waitForPaper=async\(\)=>\{/);
  assert.match(templateManager,/if\(!paper\|\|!paper\.innerText\?\.trim\(\)\)/);
  assert.match(templateManager,/document\.fonts\?\.ready/);
  assert.match(templateManager,/nativePrint\(\{orientation:opts\.orientation,size:opts\.size,marginMm:opts\.marginMm\}\)/);
  assert.match(workflowPolish,/safeSuccessToast\('تراکنش ثبت شد'\)/);
  assert.match(templateManager,/const result=await bridge\.saveInvoicePdf/);
});
