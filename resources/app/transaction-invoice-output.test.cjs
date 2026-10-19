'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=path.join(__dirname);
const source=fs.readFileSync(path.join(app,'transaction-invoice-output.js'),'utf8');
const template=fs.readFileSync(path.join(app,'template-manager.js'),'utf8');
const preload=fs.readFileSync(path.join(__dirname,'..','..','desktop','preload.cjs'),'utf8');
const main=fs.readFileSync(path.join(__dirname,'..','..','desktop','main.cjs'),'utf8');
const print=fs.readFileSync(path.join(__dirname,'..','..','desktop','invoice-print.cjs'),'utf8');
test('invoice preview offers a direct named PDF download without changing its print route',()=>{
  assert.match(template,/class="btn soft invoice-download-button" onclick="downloadInvoicePdf\(/);
  assert.match(template,/window\.downloadInvoicePdf=async function/);
  assert.match(template,/invoiceNumber:String\(t\.no\|\|''\)/);
  assert.match(template,/requestedAt/);
  assert.match(template,/window\.printInvoiceWithFilename=window\.printInvoice/);
  assert.match(preload,/saveInvoicePdf: options => ipcRenderer\.invoke\('tameshk:invoice-save-pdf'/);
  assert.match(main,/registerInvoicePdfSave/);
  assert.match(print,/tameshk:invoice-save-pdf/);
  assert.match(print,/Tameshk Accounting Invoice/);
});
test('invoice preview retains normal print action and print IPC only',()=>{
  assert.match(source,/چاپ اختلاف هزینهٔ جانبی/);
  assert.match(template,/چاپ \/ ذخیره PDF/);
  assert.match(print,/tameshk:invoice-print/);
  assert.match(preload,/printInvoice/);
});
