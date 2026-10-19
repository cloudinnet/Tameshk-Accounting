'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const releaseVersion = require('../../package.json').version;

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) { const next = force === undefined ? !this.values.has(value) : force; next ? this.values.add(value) : this.values.delete(value); return next; }
}

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.listeners = {}; this.attributes = {}; this.children = [];
    this.classList = new FakeClassList(); this.hidden = false; this.parentNode = null; this.isConnected = true;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatchEvent(event) { event.target ||= this; for (const fn of this.listeners[event.type] || []) fn.call(this, event); if (this.parentNode) this.parentNode.dispatchEvent(event); return true; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  closest(selector) {
    if (selector === '[data-help-close]' && this.hasAttribute('data-help-close')) return this;
    if (selector === '[data-help-topic]' && this.hasAttribute('data-help-topic')) return this;
    if (selector === '.tm-help-update' && this.classList.contains('tm-help-update')) return this;
    return null;
  }
  focus() { this.ownerDocument.activeElement = this; this.focused = true; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const all = [];
    const visit = node => {
      for (const child of node.children) {
        const match = selector === '[data-help-close]' ? child.hasAttribute('data-help-close') :
          selector === '[data-help-topic]' ? child.hasAttribute('data-help-topic') :
          selector === '[data-help-panel]' ? child.hasAttribute('data-help-panel') :
          selector.startsWith('[data-help-topic="') ? child.getAttribute('data-help-topic') === selector.slice(18, -2) :
          selector === '.tm-help-update' ? child.classList.contains('tm-help-update') :
          selector === '.tm-help-version' ? child.classList.contains('tm-help-version') : false;
        if (match) all.push(child);
        all.push(...child.querySelectorAll(selector));
      }
    };
    visit(this); return all;
  }
}

class FakeDocument extends FakeNode {
  constructor() {
    super('#document'); this.ownerDocument = this; this.readyState = 'complete'; this.documentElement = { lang: 'fa' };
    this.head = new FakeNode('head'); this.body = new FakeNode('body'); this.modal = new FakeNode('div'); this.modal.id = 'modal';
    this.modalInner = new FakeNode('div'); this.modalInner.id = 'modalInner'; this.modal.appendChild(this.modalInner);
    this.helpButton = new FakeNode('button'); this.helpButton.id = 'helpButton'; this.helpButton.ownerDocument = this;
    for (const node of [this.head, this.body, this.modal, this.helpButton]) node.ownerDocument = this;
    this.activeElement = this.helpButton;
  }
  createElement(tag) { const node = new FakeNode(tag); node.ownerDocument = this; return node; }
  getElementById(id) { return id === 'helpButton' ? this.helpButton : id === 'modal' ? this.modal : id === 'modalInner' ? this.modalInner : null; }
  querySelector(selector) { if (selector === '[data-help-root]') return this.modalInner.helpRoot; if (selector === '[data-help-root] .tm-help-version') return this.modalInner.helpRoot?.querySelector('.tm-help-version') || null; return super.querySelector(selector); }
  createEvent() { return { initEvent(type) { this.type = type; this.detail = {}; } }; }
}

function makeHelpRoot(document) {
  const root = new FakeNode('section'); root.ownerDocument = document;
  const close = new FakeNode('button'); close.ownerDocument = document; close.setAttribute('data-help-close', '');
  const update = new FakeNode('button'); update.ownerDocument = document; update.classList.add('tm-help-update');
  const version = new FakeNode('span'); version.ownerDocument = document; version.classList.add('tm-help-version'); version.textContent = releaseVersion;
  root.appendChild(close); root.appendChild(update); root.appendChild(version);
  for (const id of ['optional-features', 'settings-map', 'batch-price', 'about']) {
    const topic = new FakeNode('a'); topic.ownerDocument = document; topic.setAttribute('data-help-topic', id); topic.setAttribute('aria-selected', id === 'getting-started' ? 'true' : 'false');
    const panel = new FakeNode('section'); panel.ownerDocument = document; panel.setAttribute('data-help-panel', id); panel.hidden = id !== 'optional-features';
    root.appendChild(topic); root.appendChild(panel);
  }
  return root;
}

const document = new FakeDocument();
const updateEvents = [];
const context = {
  document, console, Date, String, Number, Object, Array, Set, Map, Math, RegExp, Error, JSON,
  MutationObserver: undefined,
  CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  uiLanguage: () => 'fa', uiText: source => source,
  tameshkDesktop: { getAppVersion: () => Promise.resolve('2.3.4') },
  dispatchEvent: event => { updateEvents.push(event); },
  openModal: (html, invoice) => {
    assert.equal(invoice, false, 'help opens through openModal(html, false)');
    context.document.modalInner.helpRoot = makeHelpRoot(context.document);
    context.document.modal.classList.add('open');
    context.openedHtml = html;
  },
  closeModal: () => { context.document.modal.classList.remove('open'); context.closed += 1; },
  closed: 0
};
context.window = context;
vm.runInNewContext(fs.readFileSync(__dirname + '/help-center.js', 'utf8'), context, { filename: 'help-center.js' });

assert.ok(context.TameshkHelpCenter, 'module API is registered');
assert.equal(context.openedHtml, undefined, 'module waits for the help button');
document.helpButton.dispatchEvent({ type: 'click', preventDefault() {} });
assert.match(context.openedHtml, /data-help-topic="optional-features"/);
assert.match(context.openedHtml, /data-help-topic="batch-price"/);
assert.match(context.openedHtml, /data-help-topic="about"/);
assert.match(context.openedHtml, /نحوهٔ فعال‌کردن\/غیرفعال‌کردن نمایش قابلیت‌های اضافه/);
assert.match(context.openedHtml, /نحوهٔ واردکردن\/به‌روزرسانی دسته‌ای قیمت کالاها\/خدمات/);
assert.match(context.openedHtml, /دسته‌ها و بارکد/);
assert.match(context.openedHtml, /ساده‌سازی محیط و قابلیت‌های اختیاری/);
assert.match(context.openedHtml, /تغییر موجودی کالای موجود از دفتر رویداد انبار ثبت می‌شود/);
assert.match(context.openedHtml, /فقط تغییرهای آماده در فهرست کالاها و خدمات اعمال می‌شوند/);
assert.match(context.openedHtml, /میانبرها را در پشتیبان و امکانات تنظیم کنید؛ برای هر بخش دکمهٔ ضبط را بزنید/);
assert.match(context.openedHtml, /برای کمک مالی از منوی اصلی وارد بخش کمک مالی شوید/);
assert.match(context.openedHtml, /نسخه:/);
assert.match(context.openedHtml, /شناسه\/کد/);
assert.match(context.openedHtml, /لوازم‌التحریر/);
assert.match(context.openedHtml, /خدمات/);
assert.match(context.openedHtml, /کاغذ A4/);
assert.match(context.openedHtml, /چاپ رنگی/);
assert.doesNotMatch(context.openedHtml, /tr\('/, 'rendered help markup contains translated text, not source expressions');
const helpLocales = fs.readFileSync(__dirname + '/localization.js', 'utf8');
for (const source of ['نسخه', 'بارکد', 'خدمات', 'ابزارک دسکتاپ', 'نام پروفایل و زبان', 'ساده‌سازی محیط و ابزارک دسکتاپ در پیش‌فرض‌ها و قابلیت‌های اختیاری قرار دارد.', 'نمایش تاریخ، تقویم ورود تراکنش و هزینه و تقویم پیش‌فرض گزارش‌ها', 'میانبرها را در پشتیبان و امکانات تنظیم کنید؛ برای هر بخش دکمهٔ ضبط را بزنید. ترکیب‌ها Ctrl + Alt + یک رقم یا F2، F3 و F5 تا F10 هستند. ردیف عددی و صفحه‌کلید عددی معادل‌اند و میانبرها فقط زمانی اجرا می‌شوند که برنامه باز باشد.', 'شناسه/کد', 'عنوان کالا/خدمت', 'قیمت فروش', 'قیمت هزینه‌شده', 'هزینه‌های جانبی', 'موجودی', 'لوازم‌التحریر', 'کاغذ A4', 'چاپ رنگی', 'از پنل مدیریت، بخش دسته‌ها و بارکد، یا از صفحهٔ انبارداری، ابزار به‌روزرسانی دسته‌ای قیمت کالا و خدمت را باز کنید.', 'پس از تأیید، فقط تغییرهای آماده در فهرست کالاها و خدمات اعمال می‌شوند.', 'برای هر بخش، با دکمهٔ ضبط یک میانبر یکتای Ctrl + Alt + رقم یا F2، F3 و F5 تا F10 انتخاب کنید.', 'برای کمک مالی از منوی اصلی وارد بخش کمک مالی شوید؛ پیش از ارسال، شبکه را با آدرس و QR همان کارت تطبیق دهید.']) {
  assert.ok(helpLocales.includes(`'${source}':['`), `visible help text is localized: ${source}`);
}
assert.doesNotMatch(context.openedHtml, /پس از تأیید، گزینه‌های پشتیبانی‌شده/);
assert.match(context.openedHtml, /راهنمای حسابداری تمشک/);
assert.ok(document.head.children.some(node => node.textContent.includes('.tm-help-layout[data-help-language="en"]{grid-template-columns:minmax(0,1.58fr) minmax(155px,.42fr)}')), 'English guide gives the wide column to article content and keeps tabs narrow');
const localeSource = fs.readFileSync(__dirname + '/localization.js', 'utf8');
assert.doesNotMatch(localeSource, /Invoice print font, size, and color are managed/);
assert.match(context.openedHtml, /data-help-topic="settings-map"/);
assert.match(context.openedHtml, /تقویم پیش‌فرض گزارش‌ها/);
assert.match(context.openedHtml, /ردیف عددی و صفحه‌کلید عددی معادل‌اند/);
assert.match(context.openedHtml, /زبان انگلیسی در آغاز پیش‌فرض است و تغییر زبان همان لحظه متن صفحهٔ آغازین را عوض می‌کند/);
assert.equal((context.openedHtml.match(/data-help-topic=/g) || []).length, 4, 'popup has exactly four topic links');
assert.match(context.openedHtml, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
assert.match(context.openedHtml, /tm-help-update/);
assert.equal(document.activeElement.getAttribute('data-help-close'), '', 'focus moves to close control');

const helpRoot = document.modalInner.helpRoot;
const topics = helpRoot.querySelectorAll('[data-help-topic]');
const panels = helpRoot.querySelectorAll('[data-help-panel]');
assert.equal(panels.filter(panel => !panel.hidden).length, 1, 'only the first topic panel is visible by default');
topics[2].dispatchEvent({ type: 'click', target: topics[2], preventDefault() {} });
assert.equal(panels.filter(panel => !panel.hidden).length, 1, 'only one topic panel is visible');
assert.equal(panels[2].hidden, false, 'selected topic becomes visible');
assert.equal(topics[2].getAttribute('aria-selected'), 'true');

const update = helpRoot.querySelector('.tm-help-update');
update.dispatchEvent({ type: 'click', target: update, preventDefault() {} });
assert.equal(updateEvents.length, 1);
assert.equal(updateEvents[0].type, 'tameshk-check-updates');
assert.equal(updateEvents[0].detail.version, releaseVersion);

document.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() {} });
assert.equal(context.closed, 1, 'Escape closes with the existing modal API');
assert.equal(document.activeElement, document.helpButton, 'close restores focus to the help button');

document.helpButton.dispatchEvent({ type: 'click', preventDefault() {} });
document.modal.dispatchEvent({ type: 'click', target: document.modal });
assert.equal(context.closed, 2, 'backdrop closes with the existing modal API');
assert.equal(document.activeElement, document.helpButton, 'backdrop close restores focus');
document.helpButton.dispatchEvent({ type: 'click', preventDefault() {} });

assert.equal(context.TameshkHelpCenter.version(), releaseVersion, 'fallback tracks the current packaged version');
context.TAMESHK_APP_VERSION = '9.8.7';
assert.equal(context.TameshkHelpCenter.version(), '9.8.7', 'explicit app version takes precedence');
const helpSource = fs.readFileSync(__dirname + '/help-center.js', 'utf8');
assert.match(helpSource, /bridge\.getAppVersion/);
assert.match(helpSource, /bridge\.checkUpdates/);
assert.match(helpSource, /bridge\.openExternal/);
const preloadSource = fs.readFileSync(__dirname + '/../../desktop/preload.cjs', 'utf8');
const mainSource = fs.readFileSync(__dirname + '/../../desktop/main.cjs', 'utf8');
assert.match(preloadSource, /getAppVersion: \(\) => ipcRenderer\.invoke\('tameshk:get-app-version'\)/);
assert.match(mainSource, /ipcMain\.handle\('tameshk:get-app-version', event => isTrustedRenderer\(event\) \? app\.getVersion\(\) : ''\)/);
setTimeout(() => {
  try {
    assert.equal(context.TameshkHelpCenter.version(), '2.3.4', 'installed desktop version replaces the fallback asynchronously');
    assert.equal(document.modalInner.helpRoot.querySelector('.tm-help-version').textContent, '2.3.4', 'About shows the version returned by Electron');
    console.log('help center behavior and installed-version lookup: OK');
  } catch (error) { console.error(error); process.exitCode = 1; }
}, 0);
