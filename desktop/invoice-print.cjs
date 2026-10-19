'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SIZES = Object.freeze({ A4: [210000, 297000], A5: [148000, 210000], Letter: [215900, 279400] });

function normalizeInvoicePrintOptions(raw = {}) {
  const size = Object.hasOwn(SIZES, raw.size) ? raw.size : 'A4';
  const orientation = raw.orientation === 'landscape' ? 'landscape' : 'portrait';
  const [portraitWidth, portraitHeight] = SIZES[size];
  // CSS @page owns orientation and reflows the invoice. Give Chromium a sheet
  // with those same physical dimensions and never also ask the driver to rotate.
  const width = orientation === 'landscape' ? portraitHeight : portraitWidth;
  const height = orientation === 'landscape' ? portraitWidth : portraitHeight;
  return {
    silent: false,
    printBackground: true,
    landscape: false,
    pageSize: { width, height },
    margins: { marginType: 'none' }
  };
}

function isInvoicePrintSender(sender, mainContents, appOrigin = 'http://127.0.0.1:43822', isWidgetRenderer = () => false) {
  if (!sender) return false;
  if (sender === mainContents) return true;
  try {
    const url = new URL(sender.getURL());
    return url.origin === appOrigin && url.pathname === '/' && url.searchParams.get('tameshkPanel') === 'invoice' && isWidgetRenderer(sender) === true;
  } catch { return false; }
}

function registerInvoicePrint(ipcMain, allowSender = () => false) {
  ipcMain.handle('tameshk:invoice-print', (event, raw) => {
    if (!allowSender(event.sender)) return { success: false, error: 'unauthorized' };
    const contents = event.sender;
    if (typeof contents.print !== 'function') return { success: false, error: 'print-unavailable' };
    return new Promise(resolve => contents.print(normalizeInvoicePrintOptions(raw), (success, failureReason) => resolve({ success: !!success, error: failureReason || '' })));
  });
}

function normalizeInvoicePdfOptions(raw = {}) {
  const print = normalizeInvoicePrintOptions(raw);
  return {
    printBackground: true,
    landscape: false,
    pageSize: print.pageSize,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    preferCSSPageSize: true
  };
}

function formatInvoicePdfFilename({ orientation, invoiceNumber, language, timestamp } = {}) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp == null ? Date.now() : timestamp);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid invoice download timestamp');
  const locale = language === 'fa' ? 'en-u-ca-persian-nu-latn' : language === 'ar' ? 'en-u-ca-islamic-umalqura-nu-latn' : 'en-CA-u-ca-gregory-nu-latn';
  const parts = Object.fromEntries(new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(x => [x.type, x.value]));
  const dateText = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const timeParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(x => [x.type, x.value]));
  const timeText = `${timeParts.hour}-${timeParts.minute}-${timeParts.second}`;
  const number = String(invoiceNumber || '').trim().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
  if (!number) throw new TypeError('Invalid invoice number');
  const direction = orientation === 'landscape' ? 'L' : 'P';
  return `${direction}___${number}__${dateText}__${timeText}.pdf`;
}

function registerInvoicePdfSave(ipcMain, allowSender = () => false, getDownloadsPath = () => '') {
  ipcMain.handle('tameshk:invoice-save-pdf', async (event, raw = {}) => {
    if (!allowSender(event.sender)) return { success: false, error: 'unauthorized' };
    const contents = event.sender;
    if (typeof contents.printToPDF !== 'function') return { success: false, error: 'pdf-unavailable' };
    let filename;
    try {
      const requestedAt = raw.requestedAt == null ? Date.now() : Number(raw.requestedAt);
      filename = formatInvoicePdfFilename({ orientation: raw.orientation, invoiceNumber: raw.invoiceNumber, language: raw.language, timestamp: requestedAt });
      const downloadsPath = getDownloadsPath();
      if (typeof downloadsPath !== 'string' || !downloadsPath) return { success: false, error: 'downloads-unavailable' };
      const folder = path.join(downloadsPath, "Tameshk Accounting Invoice's");
      await fs.promises.mkdir(folder, { recursive: true });
      const pdf = await contents.printToPDF(normalizeInvoicePdfOptions(raw));
      for (let suffix = 1; ; suffix++) {
        const candidate = suffix === 1 ? filename : filename.replace(/\.pdf$/i, ` (${suffix}).pdf`);
        try {
          await fs.promises.writeFile(path.join(folder, candidate), pdf, { flag: 'wx' });
          return { success: true, filename: candidate };
        } catch (error) { if (error?.code !== 'EEXIST') throw error; }
      }
    } catch (error) { return { success: false, error: error?.message || 'save-failed' }; }
  });
}

module.exports = { normalizeInvoicePrintOptions, normalizeInvoicePdfOptions, formatInvoicePdfFilename, registerInvoicePrint, registerInvoicePdfSave, isInvoicePrintSender };
