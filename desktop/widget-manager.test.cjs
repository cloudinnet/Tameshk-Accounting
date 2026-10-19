'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createWidgetManager } = require('./widget-manager.cjs');

class FakeWebContents extends EventEmitter {
  constructor() { super(); this.url = ''; }
  setWindowOpenHandler(fn) { this.openHandler = fn; }
  send(channel, payload) { this.lastMessage = { channel, payload }; }
}
class FakeWindow extends EventEmitter {
  constructor(options) { super(); this.options = options; this.webContents = new FakeWebContents(); this.visible = !!options.show; this.minimized = false; this.destroyed = false; this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height }; this.opacity = 1; this.showCalls=0; this.showInactiveCalls=0; this.focusCalls=0; this.focusableChanges=[]; }
  isDestroyed() { return this.destroyed; }
  isVisible() { return this.visible; }
  isMinimized() { return this.minimized; }
  show() { this.showCalls++; this.visible = true; this.emit('show'); }
  showInactive() { this.showInactiveCalls++; this.visible = true; }
  setFocusable(value) { this.focusableChanges.push(!!value); }
  hide() { this.visible = false; this.emit('hide'); }
  focus() { this.focusCalls++; }
  restore() { this.minimized = false; this.visible = true; this.emit('restore'); }
  setSkipTaskbar(value) { this.skip = value; }
  setAlwaysOnTop(value) { this.top = value; }
  setOpacity(value) { this.opacity = value; }
  getBounds() { return { ...this.bounds }; }
  setBounds(value) { this.bounds = value; }
  loadURL(value) { this.webContents.url = value; return Promise.resolve(); }
  close() { this.destroy(); }
  destroy() { this.destroyed = true; this.visible = false; this.emit('closed'); }
}
function fixture(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tam-widget-'));
  const handlers = new Map(), windows = [];
  const ipcMain = { on: (key, fn) => handlers.set(key, fn), handle: (key, fn) => handlers.set(key, fn) };
  const main = new FakeWindow({ show: true, x: 0, y: 0, width: 1000, height: 700 });
  const BrowserWindow = class extends FakeWindow { constructor(options) { super(options); windows.push(this); } };
  const display = { id: 1, workArea: { x: 0, y: 0, width: 1280, height: 800 } };
  const screen = { getPrimaryDisplay: () => display, getDisplayNearestPoint: () => display };
  const manager = createWidgetManager({ app: {}, BrowserWindow, screen, ipcMain, baseUrl: 'http://127.0.0.1:43822/', preloadPath: 'preload.cjs', iconPath: 'icon.png', dataDir: dir, getMainWindow: () => main, log: () => {}, ...options });
  manager.onMainCreated(main);
  return { dir, handlers, windows, manager, main };
}
function enable(f) {
  f.handlers.get('tameshk:widget-settings')({ sender: f.main.webContents }, { enabled: true, opacity: 73, panels: { transaction: true, expense: true, charity: true, history: true }, panelOpacity: { transaction: 80 } });
}
function hideMain(f) { f.main.visible = false; f.main.minimized = true; f.manager.reconcileToolbar(); }
function requestPanel(f,sender,payload){f.handlers.get('tameshk:widget-open-panel')({sender},payload);return new Promise(resolve=>setImmediate(resolve))}

test('frameless Windows 11 toolbar keeps a transparent client surface instead of opaque DWM Acrylic', () => {
  // The capability is detectable, but Electron 37 cannot compose the native
  // material through this frameless client area. The regression contract is
  // that the toolbar remains a real alpha window on every Windows build.
  const f = fixture({ platform:'win32', osRelease:'10.0.22631' }); enable(f);
  assert.equal(f.windows.length, 0);
  hideMain(f);
  const bar = f.windows[0];
  assert.ok(bar); assert.equal(bar.visible, true); assert.equal(bar.options.frame, false); assert.equal(bar.options.alwaysOnTop, true); assert.equal(bar.opacity, 1);
  assert.equal(bar.options.transparent, true); assert.equal(bar.options.backgroundColor, '#00000000'); assert.equal(bar.options.backgroundMaterial, undefined); assert.equal(bar.options.hasShadow, false);
  assert.match(bar.webContents.url, /tameshkWidget=toolbar/);
  const saved = JSON.parse(fs.readFileSync(path.join(f.dir, 'desktop-widget.json'), 'utf8'));
  assert.equal(saved.opacity, 73); assert.equal(saved.panels.expense, true);
  f.manager.dispose();
});

test('older Windows uses the same transparent toolbar path',()=>{
  const f=fixture({platform:'win32',osRelease:'10.0.19045'});enable(f);hideMain(f);const bar=f.windows[0];
  assert.equal(bar.options.frame,false);assert.equal(bar.options.transparent,true);assert.equal(bar.options.backgroundColor,'#00000000');assert.equal(bar.options.backgroundMaterial,undefined);f.manager.dispose();
});

test('detached panels use native window controls and persist resized geometry', async () => {
  const f = fixture(); enable(f); hideMain(f); const bar = f.windows[0];
  await requestPanel(f,bar.webContents,{ type: 'expense' });
  const panel = f.windows.find(w => w.webContents.url.includes('tameshkPanel=expense'));
  assert.ok(panel); assert.equal(panel.options.resizable, true); assert.equal(panel.options.minimizable, true); assert.equal(panel.options.maximizable, true); assert.equal(panel.options.skipTaskbar, false);
  panel.bounds = { x: 111, y: 121, width: 700, height: 710 }; panel.emit('move');
  const prefs = JSON.parse(fs.readFileSync(path.join(f.dir, 'desktop-widget.json'), 'utf8'));
  assert.equal(prefs.panelBounds.expense.x, 111); assert.equal(prefs.panelBounds.expense.height, 710);
  f.manager.dispose();
});

test('every detached panel appears without activating the minimized main window',async()=>{
  const f=fixture({platform:'win32'});enable(f);hideMain(f);const bar=f.windows[0];
  for(const type of ['transaction','expense','charity','history','invoice']){
    await requestPanel(f,bar.webContents,{type,id:type==='invoice'?'tx-1':''});
    const panel=f.windows.find(w=>w.webContents.url.includes(`tameshkPanel=${type}`));
    assert.ok(panel,`${type} panel exists`);
    if(type==='invoice')assert.match(panel.webContents.url,/record=tx-1/);
    panel.emit('ready-to-show');
    assert.equal(panel.isVisible(),true);assert.equal(panel.showCalls,0);assert.equal(panel.focusCalls,0);assert.equal(panel.showInactiveCalls,1);assert.deepEqual(panel.focusableChanges,[false]);await new Promise(resolve=>setTimeout(resolve,140));assert.deepEqual(panel.focusableChanges,[false,true]);
    assert.equal(panel.options.minWidth,type==='invoice'?560:480);assert.equal(panel.options.minHeight,420);
    assert.equal(f.main.isMinimized(),true);assert.equal(f.main.isVisible(),false);assert.equal(f.main.showCalls,0);assert.equal(f.main.focusCalls,0);
    await requestPanel(f,bar.webContents,{type,id:type==='invoice'?'tx-1':''});
    assert.equal(panel.showCalls,0);assert.equal(panel.focusCalls,0);assert.equal(panel.showInactiveCalls,2);assert.deepEqual(panel.focusableChanges,[false,true,false]);await new Promise(resolve=>setTimeout(resolve,140));assert.deepEqual(panel.focusableChanges,[false,true,false,true]);
    assert.equal(f.main.isMinimized(),true);assert.equal(f.main.isVisible(),false);
  }
  f.manager.dispose();
});

test('toolbar Open Main remains the explicit path that restores the application',async()=>{
  const f=fixture();enable(f);hideMain(f);const bar=f.windows[0];
  await requestPanel(f,bar.webContents,{type:'transaction'});
  const panel=f.windows.find(w=>w.webContents.url.includes('tameshkPanel=transaction'));
  panel.emit('ready-to-show');
  f.handlers.get('tameshk:widget-open-main')({sender:bar.webContents});
  assert.equal(f.main.isVisible(),true,'the dedicated Open Main control still opens the application');
  assert.equal(f.main.focusCalls,1);
  f.manager.dispose();
});

test('panel opacity is applied live, echoed to its slider, and retained for transaction/history after reopen', async () => {
  const f = fixture(); enable(f); hideMain(f); const bar = f.windows[0];
  for (const [type, value] of [['transaction',73],['history',68]]) {
    await requestPanel(f,bar.webContents,{ type });
    let panel = f.windows.find(w => w.webContents.url.includes(`tameshkPanel=${type}`));
    panel.webContents.emit('did-finish-load');
    f.handlers.get('tameshk:widget-opacity')({ sender: panel.webContents }, { value });
    assert.equal(panel.opacity, value/100);
    assert.equal(panel.webContents.lastMessage.channel, 'tameshk:widget-settings-native');
    assert.equal(panel.webContents.lastMessage.payload.panelOpacity[type], value);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'desktop-widget.json'), 'utf8')).panelOpacity[type], value);
    panel.close();
    await requestPanel(f,bar.webContents,{ type });
    panel = f.windows.filter(w => w.webContents.url.includes(`tameshkPanel=${type}`)).at(-1);
    panel.webContents.emit('did-finish-load');
    assert.equal(panel.opacity, value/100);
    assert.equal(panel.webContents.lastMessage.payload.panelOpacity[type], value);
  }
  f.manager.dispose();
});

test('native and renderer opacity limits match for all non-invoice panels', async () => {
  const f=fixture(); enable(f); hideMain(f); const bar=f.windows[0];
  await requestPanel(f,bar.webContents,{type:'transaction'});
  const panel=f.windows.find(w=>w.webContents.url.includes('tameshkPanel=transaction'));
  f.handlers.get('tameshk:widget-opacity')({sender:panel.webContents},{value:100});
  assert.equal(panel.opacity,1);
  assert.equal(panel.webContents.lastMessage.payload.panelOpacity.transaction,100);
  assert.match(fs.readFileSync(path.join(__dirname,'../resources/app/desktop-widget.js'),'utf8'),/max=100/);
  assert.match(fs.readFileSync(path.join(__dirname,'../resources/app/desktop-widget.js'),'utf8'),/onWidgetSettings\?\.\(settings=>syncPanelOpacityFromNative/);
  f.manager.dispose();
});

test('auxiliary windows block navigation away from the local app origin', async () => {
  const f = fixture(); enable(f); hideMain(f); const bar = f.windows[0];
  await requestPanel(f,bar.webContents,{ type: 'history' });
  const panel = f.windows.find(w => w.webContents.url.includes('tameshkPanel=history'));
  let blocked = false, allowed = false;
  panel.webContents.emit('will-navigate', { preventDefault() { blocked = true; } }, 'https://example.org/');
  panel.webContents.emit('will-navigate', { preventDefault() { allowed = true; } }, 'http://127.0.0.1:43822/');
  assert.equal(blocked, true); assert.equal(allowed, false);
  f.manager.dispose();
});

test('an enabled widget always retains at least one shortcut', () => {
  const f = fixture();
  f.handlers.get('tameshk:widget-settings')({ sender: f.main.webContents }, { enabled: true, panels: { transaction: false, expense: false, charity: false, history: false } });
  assert.equal(f.manager.getSettings().panels.transaction, true);
  f.manager.dispose();
});
