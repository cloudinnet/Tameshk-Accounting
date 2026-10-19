'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('numeric mirrors open the legacy formatter for transaction values and ancillary tax fields',()=>{
  const source=fs.readFileSync(path.join(__dirname,'record-appearance.js'),'utf8');
  assert.match(source,/\.localized-number-entry.*nextElementSibling\?\.matches\('input\[type=number\]'\)/);
  for(const selector of ['#items .item-qty','#items .item-price','#items .item-line-discount','#txAncillaryCost','#txAncillaryTaxPercent','#txAncillaryTaxAmount']) assert.ok(source.includes(selector),`formatter selector ${selector} exists`);
  assert.match(source,/d\.addEventListener\('pointerdown',e=>\{const ctx=matchField\(e\.target\);if\(ctx&&enabled\(\)\)\{clearTimeout\(hideTimer\);setActive\(ctx\);return\}/);
  assert.match(source,/pinnedTop=mobile\?null:Math\.max\(8,Math\.min\(window\.innerHeight-68,top\+5\)\)/);
  assert.match(source,/clamp\(12px,4vw,48px\)/);
});

test('record styling never treats notification or empty tables as expense records', () => {
  const source = fs.readFileSync(path.join(__dirname, 'record-appearance.js'), 'utf8');
  const start = source.indexOf('function addRecordIds()');
  const end = source.indexOf('\nfunction wrap(', start);
  assert.ok(start >= 0 && end > start, 'record-ID assignment helper exists');
  const helper = source.slice(start, end);
  assert.match(helper, /!t\.closest\('\[data-notification-panel\]'\)/);
  assert.match(helper, /!t\.closest\('#notificationCenter,\[data-notification-center\]'\)/);
  assert.match(helper, /tbody tr:not\(\[data-tp-empty\]\):not\(\.empty-row\):not\(\.no-records\)/);
  assert.match(helper, /querySelectorAll\('tbody tr:not\(\[data-tp-empty\]\):not\(\.empty-row\):not\(\.no-records\)'\)/);
});
