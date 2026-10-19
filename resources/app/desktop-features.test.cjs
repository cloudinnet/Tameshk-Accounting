'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function setup(initialQuickKeys={}){
  const listeners={}, calls=[], toasts=[];
  const document={addEventListener:(type,fn)=>{listeners[type]=fn},createElement:()=>({}),head:{appendChild(){}},getElementById:()=>null};
  const state={settings:{language:'fa',quickKeysEnabled:true,quickKeys:{...initialQuickKeys}}};
  const window={document,state,showToast:message=>toasts.push(message),go:action=>calls.push(action)};
  let saves=0;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'desktop-features.js'),'utf8'),{window,state,document,save:()=>{saves++},setTimeout:()=>0,console});
  return {window,state,listeners,calls,toasts,get saves(){return saves}};
}
function keyEvent(code,extra={}){
  return {code,key:code,ctrlKey:true,altKey:true,shiftKey:false,metaKey:false,repeat:false,isComposing:false,target:{closest:()=>null},preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},...extra};
}

test('legacy digit shortcuts migrate to three-key Ctrl+Alt bindings and remain unique',()=>{
  const x=setup({dashboard:'4',new:'4'});
  assert.equal(x.state.settings.quickKeys.dashboard,'Ctrl+Alt+Digit4');
  assert.equal(x.state.settings.quickKeys.new,'Ctrl+Alt+Digit2');
  assert.equal(x.window.TameshkDesktopFeatures.shortcutLabel('Ctrl+Alt+Numpad8'),'Ctrl + Alt + Num 8');
});

test('shortcut matching uses physical key codes and ignores Shift, fields and disabled settings',()=>{
  const x=setup(); const api=x.window.TameshkDesktopFeatures;
  assert.equal(api.matchingAction(keyEvent('Digit1'),x.state.settings)[0],'dashboard');
  assert.equal(api.matchingAction(keyEvent('Digit1',{shiftKey:true}),x.state.settings),null);
  assert.equal(api.matchingAction(keyEvent('Digit1',{target:{closest:()=>({})}}),x.state.settings),null);
  assert.equal(api.matchingAction(keyEvent('Digit1'),{...x.state.settings,quickKeysEnabled:false}),null);
  assert.equal(api.matchingAction(keyEvent('Key1'),x.state.settings),null);
});

test('actual document listener dispatches shortcuts and does not swallow field typing',()=>{
  const x=setup();
  const event=keyEvent('Digit1'); x.listeners.keydown(event);
  assert.deepEqual(x.calls,['dashboard']); assert.equal(event.prevented,true); assert.equal(event.stopped,true);
  const typing=keyEvent('Digit1',{target:{closest:()=>({})}}); x.listeners.keydown(typing);
  assert.deepEqual(x.calls,['dashboard']); assert.equal(typing.prevented,undefined);
});

test('numpad digits are accepted and matched by keypad location as well as event.code',()=>{
  const x=setup(); const api=x.window.TameshkDesktopFeatures;
  assert.equal(x.window.tameshkSetQuickKey('dashboard','Ctrl+Alt+Numpad1'),true);
  assert.equal(api.matchingAction(keyEvent('Numpad1',{key:'1',location:3}),x.state.settings)[0],'dashboard');
  assert.equal(api.matchingAction(keyEvent('Digit1',{key:'1',location:3}),x.state.settings)[0],'dashboard');
  assert.equal(api.matchingAction(keyEvent('Digit1',{key:'1',location:0}),x.state.settings)[0],'dashboard');
  assert.equal(x.window.tameshkSetQuickKey('new','Ctrl+Alt+Digit2'),true);
  assert.equal(api.matchingAction(keyEvent('Numpad2',{key:'2',location:3}),x.state.settings)[0],'new');
  assert.equal(x.window.tameshkSetQuickKey('reports','Ctrl+Alt+Numpad2'),false,'digit row aliases cannot be assigned twice');
  const event=keyEvent('Numpad1',{key:'1',location:3});x.listeners.keydown(event);
  assert.deepEqual(x.calls,['dashboard']);
});

test('user-defined shortcuts are saved, duplicates and known reserved keys are rejected',()=>{
  const x=setup(), set=x.window.tameshkSetQuickKey;
  assert.equal(set('new','Ctrl+Alt+F2'),true);
  assert.equal(x.state.settings.quickKeys.new,'Ctrl+Alt+F2');
  assert.equal(set('reports','Ctrl+Alt+F2'),false);
  assert.equal(set('reports','Ctrl+Alt+F4'),false);
  assert.equal(x.window.TameshkDesktopFeatures.normalizeShortcut('Ctrl+Alt+Tab'),null);
  assert.equal(x.window.TameshkDesktopFeatures.normalizeShortcut('Ctrl+Alt+Delete'),null);
  assert.ok(x.saves>=2); assert.ok(x.toasts.length>=2);
  const event=keyEvent('F2'); x.listeners.keydown(event);
  assert.deepEqual(x.calls,['new']);
});
