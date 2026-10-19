'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'financial-modules.js'),'utf8');
const match=source.match(/function localDateTimeInput\(value\)\{[^\n]+\}/);
assert.ok(match,'finance date-time formatter is present');
const context={Date};
vm.createContext(context);
vm.runInContext(`${match[0]};this.localDateTimeInput=localDateTimeInput`,context);

test('entrustment record time defaults to local current time and includes editable seconds',()=>{
  const before=new Date();
  const value=context.localDateTimeInput('');
  const after=new Date();
  assert.match(value,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  const parsed=new Date(value);
  assert.ok(parsed>=new Date(before.getTime()-1000)&&parsed<=new Date(after.getTime()+1000));
});

test('received and deposited new entrustments share the current recorded-time control while future return remains blank',()=>{
  const form=source.match(/function entrustForm\(direction,r\)\{[^\n]+/);
  assert.ok(form);
  assert.match(form[0],/field\('زمان ثبت','at',localDateTimeInput\(r\?\.at\),'datetime-local','step="1"'\)/);
  assert.match(form[0],/field\('زمان برگشت \/ دریافت','returnAt',r\?\.returnAt\?localDateTimeInput\(r\.returnAt\):''/);
});

test('existing entrustment timestamp is preserved as local editable datetime with seconds',()=>{
  const stored=new Date('2026-02-03T04:05:06.000Z');
  const p=x=>String(x).padStart(2,'0');
  const expected=`${stored.getFullYear()}-${p(stored.getMonth()+1)}-${p(stored.getDate())}T${p(stored.getHours())}:${p(stored.getMinutes())}:${p(stored.getSeconds())}`;
  assert.equal(context.localDateTimeInput(stored.toISOString()),expected);
  assert.equal(context.localDateTimeInput('invalid'), '');
});
