'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const calendarFile = path.join(__dirname, 'calendar-input.js');
const fieldsFile = path.join(__dirname, 'calendar-fields.js');
function makeApi() {
  const document = { createElement: () => ({ setAttribute() {}, style: {}, appendChild() {} }), head: { appendChild() {} }, getElementById() { return null; } };
  const root = { document };
  const context = { window: root, document, Intl, Date, Map, Set, String, Number, Math, RegExp, Array, Object, Event, MutationObserver: undefined, state: { settings: { language: 'fa', transactionCalendar: 'شمسی' } }, console };
  vm.runInNewContext(fs.readFileSync(calendarFile, 'utf8'), context, { filename: 'calendar-input.js' });
  document.readyState = 'loading';
  document.addEventListener = () => {};
  vm.runInNewContext(fs.readFileSync(fieldsFile, 'utf8'), context, { filename: 'calendar-fields.js' });
  return root.TameshkDateFields;
}
const fields = makeApi();
test('time field accepts Persian and Arabic digits and stores HH:mm:ss', () => {
  assert.equal(fields.canonicalTime('۰۹:۰۵:۳۷'), '09:05:37');
  assert.equal(fields.canonicalTime('٠٩:٠٥:٣٧'), '09:05:37');
  assert.equal(fields.canonicalTime('9:5'), '09:05:00');
});
test('time field rejects out-of-range values', () => {
  assert.equal(fields.canonicalTime('24:00:00'), null);
  assert.equal(fields.canonicalTime('12:60:00'), null);
  assert.equal(fields.canonicalTime('12:00:60'), null);
});
test('time spinner captures mouse wheel on each whole unit column',()=>{
  const source=fs.readFileSync(fieldsFile,'utf8');
  assert.match(source,/col\.addEventListener\('wheel',e=>\{e\.preventDefault\(\);e\.stopPropagation\(\);move\(wheelIncrement\(e\.deltaY\)\)\},\{passive:false\}\)/);
  assert.equal(fields.wheelIncrement(-1),-1,'wheel up decrements the selected time unit');
  assert.equal(fields.wheelIncrement(1),1,'wheel down increments the selected time unit');
  assert.equal(fields.wheelIncrement(0),0,'no vertical wheel delta does not change the time');
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  assert.match(html,/if\(e\.target\.closest\?\.\('\.time-spin-column'\)\)return/);
});

test('spinner value CSS rule is closed before invalid-state styling',()=>{
  const source=fs.readFileSync(fieldsFile,'utf8');
  assert.match(source,/width:48px!important;min-width:48px!important;height:27px;padding:2px 2px!important;[^}]*letter-spacing:0!important\}\.time-spin-value\[aria-invalid=true\]\{border-color:#bd4e4e!important;background:#fff6f5!important\}/);
});

test('native and inline calendar wrappers shrink to their form cell instead of overlapping adjacent time controls',()=>{
  const source=fs.readFileSync(calendarFile,'utf8');
  assert.match(source,/\.calendar-entry-wrap\{[^}]*width:100%;min-width:0;max-width:100%;box-sizing:border-box\}/);
  assert.match(source,/\.calendar-entry-wrap input\{flex:1 1 0;min-width:0;box-sizing:border-box\}/);
});

test('detached transaction date picker uses an independent nested overlay without an open parent modal',()=>{
  const source=fs.readFileSync(calendarFile,'utf8');
  assert.match(source,/nested:!!modal\?\.classList\.contains\('open'\)\|\|\(root\.__tameshkWidgetRoute==='transaction'&&root\.document\.body\?\.classList\.contains\('widget-panel-body'\)\)/);
  assert.match(source,/function nestedPickerLayer\(\)[\s\S]*root\.document\.body\.appendChild\(layer\)/);
});

test('date/time controls reflow without overlap and keep hour-minute-second order in every language',()=>{
  const source=fs.readFileSync(fieldsFile,'utf8');
  assert.match(source,/calendar-native-bridge\.calendar-native-date-time\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(source,/wrap\.classList\.add\('calendar-native-date-time'\)/);
  assert.match(source,/wrap\.classList\.add\('transaction-filter-date'\)/);
  assert.match(source,/\.calendar-native-bridge\.transaction-filter-date\{width:min\(190px,100%\)/);
  assert.match(source,/calendar-time-spinner\{display:flex;direction:ltr/);
  assert.match(source,/\['hour','minute','second'\]/);
  assert.match(source,/@media\(max-width:720px\)\{\.calendar-native-bridge\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('registration dates auto-fill but search ranges and future dates stay empty', () => {
  assert.equal(fields.shouldAutoFill({id:'expenseDate'}, 'تاریخ هزینه'), true);
  assert.equal(fields.shouldAutoFill({id:'txCreatedAt'}, 'زمان ثبت تراکنش'), true);
  for (const [id,label] of [['txFrom','از تاریخ'],['reportTo','تا تاریخ'],['dueDate','تاریخ سررسید'],['returnAt','زمان برگشت'],['expiryDate','تاریخ انقضا']]) {
    assert.equal(fields.shouldAutoFill({id},label), false, id);
  }
});
