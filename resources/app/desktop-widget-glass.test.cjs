'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'desktop-widget.js'),'utf8');
test('widget glass slider maps its range to a visibly changing dark translucent tint',()=>{
  assert.match(source,/function glassAlpha\(pct\).*\.24\+\(\(value-40\)\/60\)\*\.52/);
  const helper=source.match(/function glassAlpha\(pct\)\{[^}]+\}/)?.[0];
  const glassAlpha=vm.runInNewContext(`${helper};glassAlpha`);
  assert.equal(glassAlpha(40),.24);assert.equal(glassAlpha(100),.76);assert.equal(glassAlpha(70),.5);
  assert.match(source,/setProperty\('--widget-glass-alpha',String\(glassAlpha\(pct\)\)\)/);
  assert.match(source,/background:rgba\(11,18,32,var\(--widget-glass-alpha/);
  assert.match(source,/backdrop-filter:blur\(9px\) saturate\(1\.12\)/);
  assert.match(source,/color:#F3F7FC/);
  assert.match(source,/\.widget-action\{[^}]*background:rgba\(32,49,70,\.72\);color:#F3F7FC/);
  assert.match(source,/\.widget-action:focus-visible\{outline:2px solid #64B5FF/);
  assert.doesNotMatch(source,/backdrop-filter:blur\(22px\)/);
});
test('toolbar retains a genuinely transparent native surface and keeps text opacity independent',()=>{
  assert.match(source,/html,body\{margin:0;min-width:0;background:transparent!important/);
  assert.match(source,/body\.widget-toolbar-body\{overflow:hidden\}/);
  assert.match(source,/#desktopWidget\{[^}]*background:rgba\(11,18,32,var\(--widget-glass-alpha/);
  assert.doesNotMatch(source,/#desktopWidget\{[^}]*background(?:-color)?:\s*(?:#fff|white|rgb\(255,255,255\))/i);
});
