'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function boot(language = 'en') {
  const handlers = {}, content = { innerHTML: '' }, bodyNodes = [];
  const nav = { querySelector: () => null, appendChild(button) { this.button = button; } };
  const doc = {
    readyState: 'complete',
    head: { appendChild() {} },
    body: { children: bodyNodes, appendChild(node) { node.parentNode = this; bodyNodes.push(node); }, removeChild(node) { const i=bodyNodes.indexOf(node);if(i>=0)bodyNodes.splice(i,1);node.parentNode=null; } },
    getElementById(id) { return id === 'nav' ? nav : id === 'content' ? content : null; },
    querySelector(selector) { return selector === '#nav [data-page="donation"].active' ? null : null; },
    createElement() { return { dataset: {}, style: {}, attributes:{}, lastElementChild: { textContent: '' }, setAttribute(k,v){this.attributes[k]=v}, querySelector(sel){return sel==='[data-close-qr]'?{focus(){}}:null}, focus(){this.focused=true}, remove(){this.parentNode?.removeChild(this)} }; },
    addEventListener(type, callback) { (handlers[type] ||= []).push(callback); },
    execCommand() { return true; }
  };
  const toasts = [];
  const context = {
    document: doc, state: { settings: { language } }, navigator: { clipboard: { async writeText(value) { context.copied = value; } } },
    showToast(value) { toasts.push(value); }, render() {}, go() {}, console, String, Object, Array, Promise, Set, Map, Math, JSON
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'donation-page.js'), 'utf8'), context, { filename: 'donation-page.js' });
  return { context, content, nav, toasts, doc, handlers, bodyNodes };
}

test('donation page shows the four named network cards, matching wallet addresses, icons, and bundled QR files', async () => {
  const { context, content } = boot('en');
  const wallets = context.TameshkDonation.wallets;
  assert.deepEqual(JSON.parse(JSON.stringify(wallets.map(({ id, address, qr }) => [id, address, qr]))), [
    ['bitcoin', 'bc1qxnmf3uud608lfvrsg3gfgmg2kwuheefz2tgupt', 'wallet-qr/bitcoin.png'],
    ['ethereum', '0x1353c563E8e9DF44DfCE0D6f9b61aFe55f06dD3b', 'wallet-qr/ethereum.png'],
    ['litecoin', 'ltc1qf80un55tm9ykne4qmfgh7a3zctqwwq5detzzls', 'wallet-qr/litecoin.png'],
    ['solana', 'EmRi8vPu6vHLt7Wsy3XZitsg2qvHZYzxS5Qvbp9e1d1P', 'wallet-qr/solana.png']
  ]);
  context.TameshkDonation.render();
  assert.equal((content.innerHTML.match(/class="panel donation-wallet"/g) || []).length, 4);
  assert.equal((content.innerHTML.match(/class="donation-qr"/g) || []).length, 4);
  assert.equal((content.innerHTML.match(/<svg viewBox=/g) || []).length, 4);
  for (const wallet of wallets) {
    assert.ok(content.innerHTML.includes(wallet.address));
    assert.ok(fs.existsSync(path.join(__dirname, wallet.qr)));
  }
  assert.match(content.innerHTML, /wrong network may result in loss of funds/i);
  assert.equal(await context.TameshkDonation.copy('bitcoin'), true);
  assert.equal(context.copied, wallets[0].address);
});

test('donation panel labels and details are localized while wallet names and addresses remain unchanged', () => {
  const fa = boot('fa'); fa.context.TameshkDonation.render();
  assert.match(fa.content.innerHTML, /کمک مالی به پروژه/);
  assert.match(fa.content.innerHTML, /کپی آدرس/);
  assert.match(fa.content.innerHTML, /شبکه · Bitcoin/);
  assert.match(fa.content.innerHTML, /Bitcoin · آدرس/);
  assert.doesNotMatch(fa.content.innerHTML, />Address</);
  const ar = boot('ar'); ar.context.TameshkDonation.render();
  assert.match(ar.content.innerHTML, /المساعدة في دعم المشروع/);
  assert.match(ar.content.innerHTML, /نسخ العنوان/);
  assert.match(ar.content.innerHTML, /الشبكة · Bitcoin/);
  assert.match(ar.content.innerHTML, /Bitcoin · العنوان/);
  assert.doesNotMatch(ar.content.innerHTML, />Address</);
  for (const wallet of ar.context.TameshkDonation.wallets) assert.ok(ar.content.innerHTML.includes(wallet.address));
});

test('each donation QR opens in a larger accessible dialog and closes independently of the page', () => {
  const { context, bodyNodes, handlers } = boot('en');
  for (const wallet of context.TameshkDonation.wallets) {
    assert.equal(context.TameshkDonation.openQr(wallet.id), true);
    assert.equal(bodyNodes.length, 1);
    assert.match(bodyNodes[0].innerHTML, /role="dialog" aria-modal="true"/);
    assert.match(bodyNodes[0].innerHTML, /data-close-qr/);
    assert.ok(bodyNodes[0].innerHTML.includes(wallet.qr));
    if (wallet.id === 'bitcoin') { const close={closest(selector){return selector==='[data-close-qr]'?this:null}};for(const listener of handlers.click)listener({target:close,preventDefault(){}}); }
    else if (wallet.id === 'ethereum') { for(const listener of handlers.keydown)listener({key:'Escape',preventDefault(){}}); }
    else assert.equal(context.TameshkDonation.closeQr(), true);
    assert.equal(bodyNodes.length, 0);
  }
  assert.equal(context.TameshkDonation.openQr('unknown'), false);
});
