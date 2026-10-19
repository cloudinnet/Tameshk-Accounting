'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'template-manager.js'),'utf8');

test('invoice print margin has a safe zero edge and a dynamic size/orientation-specific ceiling',()=>{
  assert.match(source,/setInvoicePrintOptions=function\(orientation,size,marginMm=0\)/);
  assert.match(source,/normalizedMargin\(raw,size,orientation\)/);
  assert.match(source,/maximumMargin\(size\.value,orientation\.value\)/);
  assert.match(source,/margin\.max=String\(max\)/);
  assert.match(source,/type="number" data-invoice-control="margin" aria-label="مجموع حاشیه چاپ"[^>]*min="0" max="\$\{marginMax\}"/);
  assert.match(source,/value="\$\{marginValue\}"/);
  assert.doesNotMatch(source,/\[10,20,30\]\.includes/);
});

test('print call preserves a saved zero margin rather than replacing it with a fallback',()=>{
  assert.match(source,/\?\.value\?\?saved\.marginMm\?\?0/);
});

test('print controls are located by stable roles rather than translated accessibility captions',()=>{
  for(const role of ['orientation','size','margin'])assert.ok(source.includes(`[data-invoice-control="${role}"]`));
  assert.doesNotMatch(source,/querySelector\([^\n]*\[aria-label=/);
});

test('upgrade resets only the legacy margin once and preserves orientation, size, and other settings',()=>{
  assert.match(source,/invoicePrintMarginMigration!=='1\.5\.22'/);
  assert.match(source,/invoicePrintOptions=\{\.\.\.prior,orientation:\['portrait','landscape'\]\.includes\(prior\.orientation\)\?prior\.orientation:'portrait',size:\['A4','A5','Letter'\]\.includes\(prior\.size\)\?prior\.size:'A4',marginMm:0\}/);
  assert.match(source,/invoicePrintMarginMigration='1\.5\.22'/);
});
