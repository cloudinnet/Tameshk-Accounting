'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {text:nativeText}=require('./interface-text.cjs');

const PANEL_TYPES = new Set(['transaction','expense','charity','history','invoice']);
const DEFAULTS = { enabled:false, opacity:92, panels:{transaction:true,expense:true,charity:true,history:true}, panelOpacity:{transaction:96,expense:96,charity:96,history:96,invoice:100}, bounds:{}, panelBounds:{} };
function clamp(n,min,max,fallback){n=Number(n);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function panelOpacity(type,value){return clamp(value,40,100,100)}
function safeBounds(value, display, fallback, minW=80, minH=120){
  const area=display.workArea;
  let b=value&&['x','y','width','height'].every(k=>Number.isFinite(Number(value[k])))?{x:Math.round(+value.x),y:Math.round(+value.y),width:Math.round(+value.width),height:Math.round(+value.height)}:{...fallback};
  b.width=Math.max(Math.min(minW,area.width),Math.min(b.width,area.width));b.height=Math.max(Math.min(minH,area.height),Math.min(b.height,area.height));
  b.x=Math.max(area.x,Math.min(b.x,area.x+area.width-b.width));b.y=Math.max(area.y,Math.min(b.y,area.y+area.height-b.height));return b;
}
function createWidgetManager({app,BrowserWindow,screen,ipcMain,baseUrl,preloadPath,iconPath,dataDir,getMainWindow,getInterfaceLanguage=()=>'fa',log=()=>{},platform=process.platform}){
  // Use Electron's alpha-window composition for the five-button toolbar;
  // never attach a system-drawn background material to this frameless window.
  const file=path.join(dataDir,'desktop-widget.json');
  let prefs={...DEFAULTS,panels:{...DEFAULTS.panels},panelOpacity:{...DEFAULTS.panelOpacity},bounds:{},panelBounds:{}};
  const windows=new Map(),appOrigin=new URL(baseUrl).origin;let disposed=false;
  try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));prefs={...prefs,...saved,panels:{...prefs.panels,...saved.panels},panelOpacity:{...prefs.panelOpacity,...saved.panelOpacity},bounds:saved.bounds||{},panelBounds:saved.panelBounds||{}}}catch{}
  for(const type of PANEL_TYPES)prefs.panelOpacity[type]=panelOpacity(type,prefs.panelOpacity[type]);
  const persist=()=>{try{fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(file,JSON.stringify(prefs,null,2),'utf8')}catch(e){log('WARN','Could not persist widget settings',String(e))}};
  const isMainVisible=()=>{const w=getMainWindow();return !!w&&!w.isDestroyed()&&w.isVisible()&&!w.isMinimized()};
  function showAuxInactive(w){if(!w||w.isDestroyed())return;try{w.showInactive()}catch(err){log('WARN','Could not show auxiliary window without activation',String(err))}}
  function showPanel(w){if(!w||w.isDestroyed())return;try{if(platform==='win32')w.setFocusable(false);w.showInactive();if(platform==='win32')setTimeout(()=>{if(!w.isDestroyed())try{w.setFocusable(true)}catch{}},120)}catch(err){log('WARN','Could not show detached widget panel without activating the main window',String(err))}}
  const panelKey=(type,opts={})=>type==='invoice'?`invoice:${String(opts.id||'')}`:type;
  const configToRenderer=()=>({enabled:!!prefs.enabled,opacity:clamp(prefs.opacity,40,100,92),panels:{...prefs.panels},panelOpacity:Object.fromEntries([...PANEL_TYPES].map(type=>[type,panelOpacity(type,prefs.panelOpacity[type])]))});
  function reconcileToolbar(){
    if(disposed)return;
    if(!prefs.enabled||isMainVisible()){const w=windows.get('toolbar');if(w&&!w.isDestroyed())w.hide();return}
    let w=windows.get('toolbar');if(!w||w.isDestroyed())w=createAux('toolbar');
    if(w&&!w.isVisible())showAuxInactive(w);
  }
  function createAux(type,opts={}){
    const toolbar=type==='toolbar', key=toolbar?'toolbar':panelKey(type,opts);
    const existing=windows.get(key);if(existing&&!existing.isDestroyed()){if(toolbar)showAuxInactive(existing);else showPanel(existing);if(type==='invoice'&&opts.refresh){try{existing.webContents.reload()}catch(err){log('WARN','Could not refresh detached invoice panel',{error:String(err)})}}return existing}
    const primary=screen.getPrimaryDisplay(), stored=toolbar?prefs.bounds:prefs.panelBounds[key]||prefs.panelBounds[type];
    const hint=stored&&Number.isFinite(Number(stored.x))&&Number.isFinite(Number(stored.y))?{x:Number(stored.x)+40,y:Number(stored.y)+80}:null;
    const display=hint?screen.getDisplayNearestPoint(hint):primary,area=display.workArea;
    const fall=toolbar?{x:area.x+area.width-100,y:area.y+Math.round((area.height-390)/2),width:82,height:390}:{x:area.x+Math.round((area.width-680)/2),y:area.y+Math.round((area.height-760)/2),width:type==='invoice'?820:680,height:type==='invoice'?820:760};
    const minWidth=toolbar?Math.min(72,area.width):Math.min(type==='invoice'?560:480,area.width),minHeight=toolbar?Math.min(220,area.height):Math.min(420,area.height);
    const bounds=safeBounds(stored,display,fall,minWidth,minHeight);
    let w;
    try{
      w=new BrowserWindow({
        ...bounds,minWidth,minHeight,show:false,frame:!toolbar,
        // A frameless toolbar needs a genuinely transparent native surface.
        // Do not combine it with backgroundMaterial: Electron 37's Windows
        // DWM path paints the frameless client area opaque in that combination.
        transparent:toolbar,backgroundColor:toolbar?'#00000000':'#fff',hasShadow:!toolbar,
        resizable:!toolbar,minimizable:!toolbar,maximizable:!toolbar,skipTaskbar:toolbar,alwaysOnTop:toolbar,
        title:nativeText(toolbar?'toolbar':type,getInterfaceLanguage()),
        icon:iconPath,webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true}
      });
    }catch(err){log('ERROR','Could not create widget window',{type,error:String(err)});return null}
    windows.set(key,w);
    const qs=new URLSearchParams();if(toolbar)qs.set('tameshkWidget','toolbar');else{qs.set('tameshkPanel',type);if(opts.id)qs.set('record',String(opts.id));if(opts.editable)qs.set('editable','1')}
    w.loadURL(`${baseUrl}?${qs.toString()}`).catch(err=>log('ERROR','Widget window failed to load',{type,error:String(err)}));
    w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    const guardNavigation=(event,destination)=>{try{if(new URL(destination).origin!==appOrigin){event.preventDefault();log('WARN','Blocked auxiliary-window navigation outside local app',{destination,type})}}catch{event.preventDefault()}};
    w.webContents.on('will-navigate',guardNavigation);w.webContents.on('will-redirect',guardNavigation);
    const applyOpacity=()=>{try{w.setOpacity(toolbar?1:panelOpacity(type,prefs.panelOpacity[type])/100)}catch{}};
    w.webContents.on('did-finish-load',()=>{applyOpacity();try{w.webContents.send('tameshk:widget-settings-native',configToRenderer())}catch{}});applyOpacity();
    w.once('ready-to-show',()=>{if(toolbar)reconcileToolbar();else showPanel(w)});
    const remember=()=>{if(w.isDestroyed())return;const b=w.getBounds();if(toolbar)prefs.bounds=b;else{prefs.panelBounds[key]=b;prefs.panelBounds[type]=b}persist()};
    w.on('move',remember);w.on('resize',remember);
    w.on('closed',()=>{windows.delete(key);if(toolbar&&prefs.enabled&&!isMainVisible()&&!disposed)setTimeout(reconcileToolbar,150)});
    return w;
  }
  function openPanel(type,opts={}){
    if(!PANEL_TYPES.has(type))return false;
    if(type!=='invoice'&&!prefs.panels[type])return false;
    // Detached panels are shown without activation. Do not restore/show/focus
    // the main window here; Windows may briefly flash it while activating a child.
    const w=createAux(type,opts);if(w){w.setOpacity(panelOpacity(type,prefs.panelOpacity[type])/100)}return !!w;
  }
  function updateSettings(raw){
    if(!raw||typeof raw!=='object')return;
    const next={enabled:!!raw.enabled,opacity:clamp(raw.opacity,40,100,92),panels:{...prefs.panels},panelOpacity:{...prefs.panelOpacity}};
    for(const k of ['transaction','expense','charity','history'])if(typeof raw.panels?.[k]==='boolean')next.panels[k]=raw.panels[k];
    if(next.enabled&&!Object.values(next.panels).some(Boolean))next.panels.transaction=true;
    for(const k of PANEL_TYPES)if(raw.panelOpacity?.[k]!==undefined)next.panelOpacity[k]=panelOpacity(k,raw.panelOpacity[k]);
    prefs={...prefs,...next};persist();
    for(const [key,w] of windows){if(!w.isDestroyed()){const type=key==='toolbar'?'toolbar':key.startsWith('invoice:')?'invoice':key;if(type==='toolbar')w.setOpacity(1);else w.setOpacity(panelOpacity(type,prefs.panelOpacity[type])/100);try{w.webContents.send('tameshk:widget-settings-native',configToRenderer())}catch{}}}
    reconcileToolbar();
  }
  function setCurrentOpacity(event,value,key='panel'){
    const sender=event.sender,win=[...windows.values()].find(w=>!w.isDestroyed()&&w.webContents===sender);if(!win)return false;
    const type=win===windows.get('toolbar')?'toolbar':([...windows.keys()].find(k=>windows.get(k)===win)||'').startsWith('invoice:')?'invoice':([...windows.keys()].find(k=>windows.get(k)===win)||'').split(':')[0];
    const pct=type==='toolbar'?clamp(value,40,100,92):panelOpacity(type,value);
    if(type==='toolbar')prefs.opacity=pct;else prefs.panelOpacity[type]=pct;
    win.setOpacity(type==='toolbar'?1:pct/100);persist();
    try{win.webContents.send('tameshk:widget-settings-native',configToRenderer())}catch{}
    if(type==='toolbar'&&win.webContents!==getMainWindow()?.webContents)getMainWindow()?.webContents.send('tameshk:widget-settings-native',configToRenderer());
    return true;
  }
  ipcMain.on('tameshk:widget-settings',(event,payload)=>{if(event.sender===getMainWindow()?.webContents)updateSettings(payload)});
  ipcMain.on('tameshk:widget-open-main',event=>{if(windows.get('toolbar')?.webContents===event.sender){const w=getMainWindow();if(w&&!w.isDestroyed()){if(w.isMinimized())w.restore();w.setSkipTaskbar(false);w.show();w.focus();reconcileToolbar()}}});
  ipcMain.on('tameshk:widget-open-panel',(event,payload)=>{if(!isWidgetRenderer(event))return;const type=String(payload?.type||''),opts={id:payload?.id,editable:payload?.editable===true,refresh:payload?.refresh===true};setImmediate(()=>{if(!disposed&&isWidgetRenderer(event))openPanel(type,opts)})});
  ipcMain.on('tameshk:widget-opacity',(event,payload)=>setCurrentOpacity(event,payload?.value));
  ipcMain.handle('tameshk:widget-get-settings',event=>event.sender===getMainWindow()?.webContents?configToRenderer():null);
  function onMainCreated(w){w.on('minimize',()=>{if(prefs.enabled)reconcileToolbar()});w.on('hide',()=>{if(prefs.enabled)reconcileToolbar()});w.on('closed',()=>{for(const p of windows.values())if(!p.isDestroyed())p.close();windows.clear()})}
  function showWidgetForHiddenMain(){reconcileToolbar()}
  function hideWidget(){const w=windows.get('toolbar');if(w&&!w.isDestroyed())w.hide()}
  function dispose(){disposed=true;for(const w of windows.values())if(!w.isDestroyed())w.destroy();windows.clear()}
  if(prefs.enabled&&!isMainVisible())reconcileToolbar();
  function isWidgetRenderer(event){return !!event&&[...windows.values()].some(w=>!w.isDestroyed()&&w.webContents===event.sender)}
  function refreshLanguageTitles(){for(const [type,w]of windows)if(!w.isDestroyed())w.setTitle?.(nativeText(type,getInterfaceLanguage()));}
  return{refreshLanguageTitles,onMainCreated,updateSettings,openPanel,showWidgetForHiddenMain,hideWidget,reconcileToolbar,dispose,getSettings:configToRenderer,isWidgetRenderer};
}
module.exports={createWidgetManager};
