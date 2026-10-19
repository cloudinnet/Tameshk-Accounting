'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = __dirname;
function makeCalendar() {
  const document = { createElement: () => ({ setAttribute() {}, style: {}, appendChild() {} }), head: { appendChild() {} }, getElementById() { return null; } };
  const context = { window: { document }, document, Intl, Date, Map, Set, String, Number, Math, RegExp, Array, Object, Event, state: { settings: { language: 'fa', transactionCalendar: 'شمسی' } }, console };
  vm.runInNewContext(fs.readFileSync(path.join(base, 'calendar-input.js'), 'utf8'), context, { filename: 'calendar-input.js' });
  return context.window.TameshkCalendar;
}
const cal = makeCalendar();
const names = ['شمسی', 'میلادی', 'قمری'];
function dateString(d) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; }
test('calendar round-trips ISO dates across years and month boundaries', () => {
  for (let year = 1990; year <= 2050; year += 3) {
    for (let month = 1; month <= 12; month++) {
      const date = new Date(Date.UTC(year, month - 1, 1, 12));
      for (const offset of [0, 13, 27]) {
        const d = new Date(+date + offset * 86400000);
        const iso = dateString(d);
        for (const name of names) assert.equal(cal.parse(cal.format(iso, name), name), iso, `${iso} (${name})`);
      }
    }
  }
});
test('leap day and Persian leap-year end are validated', () => {
  assert.equal(cal.fromParts(2024, 2, 29, 'میلادی'), '2024-02-29');
  assert.equal(cal.fromParts(2023, 2, 29, 'میلادی'), null);
  assert.equal(cal.fromParts(1403, 12, 30, 'شمسی'), '2025-03-20');
  assert.equal(cal.fromParts(1402, 12, 30, 'شمسی'), null);
});
test('localized digits round-trip and separators normalize', () => {
  const iso = '2025-03-21';
  for (const name of names) assert.equal(cal.parse(cal.format(iso, name).replaceAll('/', '-'), name), iso);
  assert.equal(cal.normalizeDigits('۱۴۰۴/٠٩/٢١'), '1404/09/21');
});
test('month/day range validation rejects invalid dates', () => {
  assert.equal(cal.fromParts(1446, 13, 1, 'قمری'), null);
  assert.equal(cal.fromParts(1446, 1, 31, 'قمری'), null);
});
test('closing or selecting a nested picker preserves its parent form',()=>{
  const nodes=new Map();
  const classes=(initial=[])=>{const set=new Set(initial);return{add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)}};
  const element=()=>{let id='';const node={dataset:{},style:{},children:[],classList:classes(),setAttribute(){},getAttribute(){return null},removeAttribute(){},appendChild(child){this.children.push(child);child.parentElement=this},addEventListener(){},querySelector(selector){if(selector==='#calendarPickerInner')return this.children.find(x=>x.id==='calendarPickerInner')||null;if(selector==='.calendar-pick-btn')return null;return null},closest(){return null},dispatchEvent(){},innerHTML:''};Object.defineProperty(node,'id',{get(){return id},set(value){id=value;nodes.set(value,node)}});return node};
  const input=element();input.id='date';input.value='';input.dataset.calendar='شمسی';input.dataset.snapshot='';
  const modal=element();modal.id='modal';modal.classList=classes(['open']);
  const document={createElement:element,head:{appendChild(){}},body:{appendChild(node){nodes.set(node.id,node)}},getElementById:id=>nodes.get(id)||null};
  const window={document,closeModal(){throw new Error('parent modal should remain open')}};
  const context={window,document,Intl,Date,Map,Set,String,Number,Math,RegExp,Array,Object,Event,state:{settings:{language:'fa',transactionCalendar:'شمسی'}}};
  vm.runInNewContext(fs.readFileSync(path.join(base,'calendar-input.js'),'utf8'),context);
  const api=window.TameshkCalendar;
  assert.equal(typeof api.closePicker,'function');
  api.openPicker('date');
  assert.equal(nodes.get('calendarPickerBackdrop').classList.contains('open'),true);
  api.setPickerCalendar('میلادی');
  api.choose('date','2026-10-05');
  assert.equal(input.dataset.iso,'2026-10-05');
  assert.equal(modal.classList.contains('open'),true);
  assert.equal(nodes.get('calendarPickerBackdrop').classList.contains('open'),false);
});

test('visible calendar digits match the selected calendar', () => {
  assert.match(cal.format('2025-03-21', 'شمسی'), /[۰-۹]/);
  assert.match(cal.format('2025-03-21', 'قمری'), /[٠-٩]/);
  assert.match(cal.format('2025-03-21', 'میلادی'), /[0-9]/);
});
