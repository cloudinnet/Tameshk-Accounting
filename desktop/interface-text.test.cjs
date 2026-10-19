'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {text,normalizeLanguage}=require('./interface-text.cjs');
test('native tray, diagnostics, widget titles and error captions support each interface language',()=>{
 for(const lang of ['fa','en','ar'])for(const key of ['app','toolbar','transaction','expense','charity','history','invoice','openApp','openLogs','logs','logsHint','quit','close','logPath','trayHint'])assert.ok(text(key,lang)&&text(key,lang)!==key);
 assert.equal(text('openApp','en'),'Open Tameshk Accounting');assert.equal(text('expense','ar'),'تسجيل مصروف');
 assert.equal(text('صفحهٔ اصلی برنامه بارگذاری نشد.','en'),'The main application page could not be loaded.');
});
test('language selection is allowlisted and arbitrary diagnostics are not rewritten',()=>{
 assert.equal(normalizeLanguage('invalid'),'en');assert.equal(normalizeLanguage('ar'),'ar');
 assert.equal(text('User supplied diagnostic','ar'),'User supplied diagnostic');
 for(const key of ['constructor','toString','__proto__'])assert.equal(text(key,'en'),key);
});
test('preload remains sandbox-compatible and language IPC is guarded by the main-window sender',()=>{
 const fs=require('node:fs'),preload=fs.readFileSync(__dirname+'/preload.cjs','utf8'),main=fs.readFileSync(__dirname+'/main.cjs','utf8');
 assert.doesNotMatch(preload,/require\(['"]\.\//);
 assert.match(main,/tameshk:interface-language[^\n]+isMainRenderer\(event\)/);
 assert.match(preload,/attributeFilter:\['lang'\]/);
});

test('sandboxed preload updates captions and sends language only on a change without changing button actions',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const listeners=new Map(),buttons=new Map(),sent=[],invoked=[];let observeCallback;
 const document={documentElement:{lang:'en'},getElementById:id=>buttons.get(id),querySelector:()=>target,createElement:()=>({style:{},attributes:{},events:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.events[k]=fn}})};
 const target={appendChild(b){buttons.set(b.id,b)},insertBefore(b){buttons.set(b.id,b)},querySelector:()=>null};
 const context={document,window:{addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn)}},MutationObserver:class{constructor(fn){observeCallback=fn}observe(el,opts){assert.deepEqual(Array.from(opts.attributeFilter),['lang'])}},require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld(){}},ipcRenderer:{send:(...args)=>sent.push(args),invoke:(...args)=>invoked.push(args),on(){}}}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/preload.cjs','utf8'),context);
 for(const fn of listeners.get('DOMContentLoaded'))fn();
 const logs=buttons.get('tameshkLogsButton'),tray=buttons.get('tameshkTrayButton');
 assert.equal(logs.textContent,'Logs');assert.equal(logs.attributes['aria-label'],'Open the error logs folder');
 for(const lang of ['ar','fa','en']){
  document.documentElement.lang=lang;observeCallback();
  assert.equal(logs.textContent,text('logs',lang));assert.equal(tray.title,text('trayHint',lang));
  const count=sent.length;observeCallback();assert.equal(sent.length,count,'same language is not rebroadcast');
 }
 assert.deepEqual(sent.filter(x=>x[0]==='tameshk:interface-language').map(x=>x[1]),['en','ar','fa','en']);
 logs.events.click();tray.events.click();assert.equal(invoked[0][0],'tameshk:open-logs');assert.equal(sent.at(-1)[0],'tameshk:minimize-to-tray');
});
