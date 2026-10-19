'use strict';

const { contextBridge, ipcRenderer } = require('electron');
// Sandboxed preloads may require Electron, not arbitrary local modules.
const normalizeLanguage=language=>['fa','en','ar'].includes(language)?language:'en';
const preloadWords={logs:['لاگ','Logs','السجلات'],logsHint:['بازکردن پوشهٔ گزارش‌های خطا','Open the error logs folder','فتح مجلد سجلات الأخطاء'],trayHint:['فرستادن برنامه به نوار آیکن‌های مخفی؛ برنامه در پس‌زمینه می‌ماند','Send to the system tray; the app stays running in the background','إرسال التطبيق إلى علبة النظام؛ يظل يعمل في الخلفية']};
const nativeText=(key,language)=>preloadWords[key]?.[{fa:0,en:1,ar:2}[normalizeLanguage(language)]]||key;

function send(entry) {
  try {
    const text = JSON.stringify(entry);
    if (text.length <= 20000) ipcRenderer.send('tameshk:renderer-log', entry);
    else ipcRenderer.send('tameshk:renderer-log', {kind:'error',level:'ERROR',message:'Renderer log entry exceeded size limit',details:{length:text.length}});
  } catch (err) {
    try { ipcRenderer.send('tameshk:renderer-log', {kind:'error',level:'ERROR',message:'Could not serialize renderer error',details:String(err)}); } catch {}
  }
}

contextBridge.exposeInMainWorld('tameshkDesktop', Object.freeze({
  quit: () => ipcRenderer.send('tameshk:quit'),
  openLogs: () => ipcRenderer.invoke('tameshk:open-logs'),
  checkUpdates: () => ipcRenderer.invoke('tameshk:check-updates'),
  getAppVersion: () => ipcRenderer.invoke('tameshk:get-app-version'),
  openExternal: url => ipcRenderer.invoke('tameshk:open-external', String(url || '')),
  getLogDirectory: () => ipcRenderer.invoke('tameshk:get-log-dir'),
  log: (message, details) => send({kind:'error',level:'ERROR',message:String(message),details}),
  minimizeWindow: () => ipcRenderer.send('tameshk:window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('tameshk:window-toggle-maximize'),
  beginWindowResize: direction => ipcRenderer.send('tameshk:window-resize-start', String(direction)),
  updateWindowResize: delta => ipcRenderer.send('tameshk:window-resize-update', delta),
  endWindowResize: () => ipcRenderer.send('tameshk:window-resize-end'),
  // The visible close control exits the whole app (including its tray process).
  closeWindow: () => { send({kind:'info',level:'INFO',message:'Window close control clicked'}); ipcRenderer.send('tameshk:window-close'); },
  isWindowMaximized: () => ipcRenderer.invoke('tameshk:window-is-maximized'),
  onWindowState: callback => { if (typeof callback === 'function') ipcRenderer.on('tameshk:window-state', (_event, state) => callback(!!state?.maximized)); },
  getWidgetSettings: () => ipcRenderer.invoke('tameshk:widget-get-settings'),
  updateWidgetSettings: settings => ipcRenderer.send('tameshk:widget-settings', settings),
  openWidgetPanel: (type, options={}) => ipcRenderer.send('tameshk:widget-open-panel', {type:String(type),id:options?.id==null?'':String(options.id),editable:options?.editable===true,refresh:options?.refresh===true}),
  openMainWindow: () => ipcRenderer.send('tameshk:widget-open-main'),
  setWidgetOpacity: value => ipcRenderer.send('tameshk:widget-opacity', {value:Number(value)}),
  printInvoice: options => ipcRenderer.invoke('tameshk:invoice-print', options || {}),
  saveInvoicePdf: options => ipcRenderer.invoke('tameshk:invoice-save-pdf', options || {}),
  onWidgetSettings: callback => { if (typeof callback === 'function') ipcRenderer.on('tameshk:widget-settings-native', (_event, settings) => callback(settings)); }
}));

// Expiry alerts are forwarded to native Windows notifications only while hidden.
window.addEventListener('tameshk-expiry-alert', event => {
  try {
    if (document.hidden) ipcRenderer.send('tameshk:expiry-notification', event.detail || {});
  } catch (err) {
    send({kind:'error',level:'ERROR',message:'Could not forward expiry alert to native Windows notification',details:{message:err?.message,stack:err?.stack}});
  }
});

// Language-sensitive native and preload controls follow the selected interface.
let nativeInterfaceLanguage='';
function syncNativeInterfaceLanguage(){
 const language=normalizeLanguage((document.documentElement.lang||'en').split('-')[0]);
 if(language!==nativeInterfaceLanguage){nativeInterfaceLanguage=language;ipcRenderer.send('tameshk:interface-language',language)}
 const logs=document.getElementById('tameshkLogsButton'),tray=document.getElementById('tameshkTrayButton');
 if(logs){logs.textContent=nativeText('logs',language);logs.title=nativeText('logsHint',language);logs.setAttribute('aria-label',logs.title)}
 if(tray){tray.title=nativeText('trayHint',language);tray.setAttribute('aria-label',tray.title)}
}
window.addEventListener('DOMContentLoaded',()=>{syncNativeInterfaceLanguage();new MutationObserver(syncNativeInterfaceLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});});
// Add diagnostics and the tray shortcut to the normal in-app header.
window.addEventListener('DOMContentLoaded', () => {
  try {
    const target = document.querySelector('.top-right');
    if (!target || document.getElementById('tameshkTrayButton')) return;
    const logBtn = document.createElement('button');
    logBtn.id = 'tameshkLogsButton';
    logBtn.type = 'button';
    logBtn.textContent = 'لاگ';
    logBtn.title = 'بازکردن پوشهٔ گزارش‌های خطا';
    logBtn.setAttribute('aria-label', logBtn.title);
    logBtn.style.cssText = 'height:34px;border:1px solid #dfe6e9;border-radius:9px;background:#fff;color:#172e3d;font:600 12px Tahoma;cursor:pointer;padding:0 9px';
    logBtn.addEventListener('click', () => ipcRenderer.invoke('tameshk:open-logs'));
    target.appendChild(logBtn);
    const btn = document.createElement('button');
    btn.id = 'tameshkTrayButton';
    btn.type = 'button';
    btn.textContent = '↧';
    btn.title = 'فرستادن برنامه به نوار آیکن‌های مخفی؛ برنامه در پس‌زمینه می‌ماند';
    btn.setAttribute('aria-label', btn.title);
    btn.style.cssText = 'width:34px;height:34px;border:1px solid #dfe6e9;border-radius:9px;background:#fff;color:#172e3d;font:700 22px Tahoma;line-height:1;cursor:pointer';
    btn.addEventListener('click', () => ipcRenderer.send('tameshk:minimize-to-tray'));
    const avatar = target.querySelector('.avatar');
    target.insertBefore(btn, avatar || null);
    syncNativeInterfaceLanguage();
  } catch (err) { send({kind:'error',level:'ERROR',message:'Could not create tray/log controls',details:{message:err?.message,stack:err?.stack}}); }
});

window.addEventListener('error', event => {
  send({kind:'error',level:'ERROR',message:event.message || 'window.error',details:{filename:event.filename,lineno:event.lineno,colno:event.colno,stack:event.error?.stack}});
});
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  send({kind:'error',level:'ERROR',message:'Unhandled promise rejection',details:{message:reason?.message || String(reason),stack:reason?.stack}});
});
