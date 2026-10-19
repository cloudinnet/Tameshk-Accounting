'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'desktop-widget.js'),'utf8');

test('detached invoice route guarantees orientation, page size, margin and direct-download controls',()=>{
  assert.match(source,/function ensureInvoiceOptions\(id\)/);
  assert.match(source,/\[data-invoice-control="orientation"\]/);
  assert.match(source,/\[data-invoice-control="size"\]/);
  assert.match(source,/\[data-invoice-control="margin"\]/);
  assert.match(source,/\.invoice-download-button/);
  assert.match(source,/root\.updateInvoicePrintOptions\?\.\(\)/);
  assert.match(source,/root\.downloadInvoicePdf\?\.\(id,event\.currentTarget\)/);
  assert.match(source,/root\.showInvoice\?\.\(id,[\s\S]*?ensureInvoiceOptions\(id\)/);
});

test('widget panels shrink form grids and invoice controls without forcing child fields wider than the window',()=>{
  assert.match(source,/grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,210px\),1fr\)\)!important/);
  assert.match(source,/\.widget-panel-body \.invoice-options\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,245px\),1fr\)\)/);
  assert.match(source,/\.widget-panel-body input:not\(\[type=checkbox\]\):not\(\[type=radio\]\),\.widget-panel-body select,\.widget-panel-body textarea\{min-width:0;max-width:100%\}/);
  assert.match(source,/@media\(max-width:540px\)\{\.widget-panel-body \.form-grid\{grid-template-columns:minmax\(0,1fr\)!important\}\}/);
  assert.match(source,/@media\(max-width:380px\)/);
});

test('opening and reopening detached panels never explicitly shows or focuses the main window',()=>{
  const manager=fs.readFileSync(path.join(__dirname,'..','..','desktop','widget-manager.cjs'),'utf8');
  assert.match(manager,/function showAuxInactive\(w\)/);
  assert.match(manager,/w\.setFocusable\(false\)/);
  assert.match(manager,/w\.showInactive\(\)/);
  assert.match(manager,/setTimeout\(\(\)=>\{if\(!w\.isDestroyed\(\)\)try\{w\.setFocusable\(true\)/);
  assert.match(manager,/function showPanel\(w\)[\s\S]*?w\.setFocusable\(false\)[\s\S]*?w\.showInactive\(\)[\s\S]*?w\.setFocusable\(true\)/);
  assert.match(manager,/else showPanel\(existing\)/);
  assert.match(manager,/w\.once\('ready-to-show',\(\)=>\{if\(toolbar\)reconcileToolbar\(\);else showPanel\(w\)\}\)/);
  assert.match(manager,/ipcMain\.on\('tameshk:widget-open-panel'/);
  assert.doesNotMatch(manager,/openPanel\([^;]*?\.show\(\)|openPanel\([^;]*?\.focus\(\)/);
});
