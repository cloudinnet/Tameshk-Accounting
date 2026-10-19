'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=__dirname;
const layout=fs.readFileSync(path.join(base,'transaction-form-layout.js'),'utf8');
const template=fs.readFileSync(path.join(base,'template-manager.js'),'utf8');
const match=layout.match(/function formatCustomerPhone\(value\)\{[^\n]+\}/);
assert.ok(match,'customer phone formatter is available for testing');
const context={};vm.createContext(context);vm.runInContext(`${match[0]};this.formatCustomerPhone=formatCustomerPhone`,context);

test('customer phones use the requested 4-3-4 grouping then groups of four',()=>{
  assert.equal(context.formatCustomerPhone('0913'),'0913');
  assert.equal(context.formatCustomerPhone('09133'),'0913-3');
  assert.equal(context.formatCustomerPhone('0913305'),'0913-305');
  assert.equal(context.formatCustomerPhone('09133058'),'0913-305-8');
  assert.equal(context.formatCustomerPhone('0913-305-8180-9913-2256-11'),'0913-305-8180-9913-2256-11');
  assert.equal(context.formatCustomerPhone('۰۹۱۳۳۰۵۸'),'۰۹۱۳-۳۰۵-۸');
  assert.equal(context.formatCustomerPhone(''),'');
});

test('customer phone mask is delegated for entry and invoice phone is formatted for printed template output',()=>{
  assert.match(layout,/d\.addEventListener\('input',apply\);d\.addEventListener\('change',apply\);d\.addEventListener\('focusin',apply\)/);
  assert.match(template,/'customer\.phone':window\.TameshkTransactionFormLayout\?\.formatCustomerPhone\?\.\(t\.phone\)\|\|t\.phone\|\|'—'/);
});
