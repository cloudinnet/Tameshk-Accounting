'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sourceRoot=fs.existsSync(path.join(root,'desktop/main.cjs'))?root:path.resolve(root,'..');
const main=fs.readFileSync(path.join(sourceRoot,'desktop/main.cjs'),'utf8');
const htmlPath=fs.existsSync(path.join(root,'resources/app/index.html'))?path.join(root,'resources/app/index.html'):path.join(root,'index.html');
const html=fs.readFileSync(htmlPath,'utf8');

test('desktop chrome stays below dialogs and is excluded from invoice printing',()=>{
  assert.match(main,/#tameshkDesktopTitlebar\{[^}]*z-index:6!important/);
  assert.match(main,/\.topbar\{top:62px!important;z-index:8!important\}/);
  assert.match(main,/\.tameshk-window-resize-handle\{[^}]*z-index:9!important/);
  assert.match(html,/\.modal-backdrop\{[^}]*z-index:20/);
  assert.match(main,/@media print\{html body\{padding-top:0!important;margin-top:0!important\}#tameshkDesktopTitlebar,\.tameshk-window-resize-handle,\.topbar\{display:none!important/);
  assert.match(html,/#tameshkDesktopTitlebar,.tameshk-window-resize-handle,.topbar,aside,.footer-note\{display:none!important/);
});

test('modal wheel routing captures wheel events while the overlay is open',()=>{
  assert.match(html,/document\.addEventListener\('wheel',[\s\S]*?\{capture:true,passive:false\}\)/);
  assert.match(html,/inner\.scrollTop=Math\.max\(0,Math\.min\(inner\.scrollHeight-inner\.clientHeight,inner\.scrollTop\+dy\)\)/);
});

test('widget wheel routing leaves time spinners interactive',()=>{
  const widget=fs.readFileSync(path.join(sourceRoot,'resources/app/desktop-widget.js'),'utf8');
  const calendar=fs.readFileSync(path.join(sourceRoot,'resources/app/calendar-fields.js'),'utf8');
  assert.match(widget,/if\(e\.target\?\.closest\?\.\('\.time-spin-column'\)\)return;const factor=/);
  assert.match(calendar,/function wheelIncrement\(deltaY\)\{return deltaY<0\?-1:deltaY>0\?1:0\}/);
  assert.match(calendar,/col\.addEventListener\('wheel',e=>\{e\.preventDefault\(\);e\.stopPropagation\(\);move\(wheelIncrement\(e\.deltaY\)\)\},\{passive:false\}\)/);
  assert.doesNotMatch(widget,/returne\.preventDefault/);
});

test('widget date picker is a fixed popup above inline entry panels',()=>{
  const widget=fs.readFileSync(path.join(sourceRoot,'resources/app/desktop-widget.js'),'utf8');
  assert.match(widget,/\.widget-panel-body \.calendar-picker-backdrop\.open\{position:fixed!important;inset:0!important;z-index:10000!important;display:flex!important/);
  assert.match(widget,/\.widget-panel-body \.calendar-picker-backdrop\.open>\.modal\{position:relative!important/);
});

test('transaction widget calendar is promoted to the topmost viewport popup',()=>{
  const widget=fs.readFileSync(path.join(sourceRoot,'resources/app/desktop-widget.js'),'utf8');
  assert.match(widget,/if\(route==='transaction'\)d\.body\.classList\.add\('widget-transaction-body'\)/);
  assert.match(widget,/\.widget-panel-body\.widget-transaction-body #calendarPickerBackdrop\.calendar-picker-backdrop\.open\{position:fixed!important;inset:0!important;z-index:2147483647!important;display:flex!important/);
  assert.match(widget,/\.widget-panel-body\.widget-transaction-body #calendarPickerBackdrop\.calendar-picker-backdrop\.open>#calendarPickerInner\{position:relative!important/);
});
