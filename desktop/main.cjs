'use strict';

const { app, BrowserWindow, Tray, Menu, Notification, dialog, ipcMain, shell, nativeImage, screen, session } = require('electron');
const { fitWindowBounds, isInsideWorkArea } = require('./window-geometry.cjs');
const { resizeBoundsFromDrag, VALID_DIRECTIONS: resizeDirections } = require('./window-resize.cjs');
const { createWidgetManager } = require('./widget-manager.cjs');
const { registerInvoicePrint, registerInvoicePdfSave, isInvoicePrintSender } = require('./invoice-print.cjs');
const { isMainWindowEvent, isMainFrameEvent, cleanNotificationText, sanitizeRendererLogEntry } = require('./security-guards.cjs');
const { readPreferredPort, savePreferredPort } = require('./server-port.cjs');
const { HTML_SECURITY_HEADERS, configureSessionSecurity } = require('./security-policy.cjs');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {text:nativeText,normalizeLanguage}=require('./interface-text.cjs');

app.setName('TameshkAccounting');
if (process.platform === 'win32') app.setAppUserModelId('ir.tameshk.cafeaccounting');
const localData = process.env.LOCALAPPDATA || path.join(app.getPath('appData'), '..', 'Local');
const dataDir = path.join(localData, 'TameshkAccounting');
const legacyDataDir = path.join(localData, 'Tama' + 'shkAccounting');
// Preserve existing profiles while moving the misspelled data-folder name to the corrected brand.
try {
  if (!fs.existsSync(dataDir) && fs.existsSync(legacyDataDir)) {
    try { fs.renameSync(legacyDataDir, dataDir); }
    catch { fs.cpSync(legacyDataDir, dataDir, {recursive:true,force:false,errorOnExist:false}); }
  }
} catch (error) { console.warn('Could not migrate the previous local data folder:', error?.message); }
const logDir = path.join(dataDir, 'logs');
const appPortFile = path.join(dataDir, 'server-port.json');
const interfaceLanguageFile=path.join(dataDir,'interface-language.json');
let interfaceLanguage='en';
try{interfaceLanguage=normalizeLanguage(JSON.parse(fs.readFileSync(interfaceLanguageFile,'utf8')).language)}catch{}
const nativeLabel=key=>nativeText(key,interfaceLanguage);
app.setPath('userData', dataDir);
let server, win, tray, widgetManager, invoiceRendererOrigin = '', isQuitting = false, shownCrashDialog = false;
const MAX_LOG = 4 * 1024 * 1024;
function isMainRenderer(event) { return !!win && !win.isDestroyed() && isMainWindowEvent(event, win.webContents); }
function isTrustedRenderer(event) {
  if (!event?.sender || !isMainFrameEvent(event, event.sender)) return false;
  if (isMainRenderer(event)) return true;
  return !!widgetManager?.isWidgetRenderer(event);
}
const rendererLogWindows = new Map();
function acceptRendererLog(event) {
  const id = event?.sender?.id;
  if (!Number.isInteger(id)) return false;
  const now = Date.now(), old = rendererLogWindows.get(id);
  if (!old && rendererLogWindows.size >= 256) {
    for (const [key, bucket] of rendererLogWindows) if (now - bucket.start >= 60000) rendererLogWindows.delete(key);
    if (rendererLogWindows.size >= 256) return false;
  }
  if (!old || now - old.start >= 60000) { rendererLogWindows.set(id, { start:now, count:1 }); return true; }
  if (old.count >= 60) return false;
  old.count++;
  return true;
}

function safeString(value) {
  try { return typeof value === 'string' ? value : JSON.stringify(value); }
  catch { return String(value); }
}
function rotate(file) {
  try {
    const target = path.join(logDir, file);
    if (fs.existsSync(target) && fs.statSync(target).size > MAX_LOG) {
      const old = `${target}.1`;
      try { fs.rmSync(old, { force: true }); } catch {}
      fs.renameSync(target, old);
    }
  } catch {}
}
function log(file, level, message, details) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    rotate(file);
    const extra = details === undefined ? '' : ` | ${safeString(details)}`;
    fs.appendFileSync(path.join(logDir, file), `${new Date().toISOString()} [${level}] ${safeString(message)}${extra}\r\n`, 'utf8');
  } catch (e) {
    try { fs.appendFileSync(path.join(os.tmpdir(), 'TameshkAccounting-emergency.log'), `${new Date().toISOString()} log-write-failed ${String(e)}\n`); } catch {}
  }
}
function errorInfo(err) {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { value: safeString(err) };
}
function showMainWindow() {
  if (!win || win.isDestroyed()) return;
  try { win.setSkipTaskbar(false); } catch {}
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  widgetManager?.hideWidget();
}
function hideToTray() {
  if (!win || win.isDestroyed()) return;
  try { win.setSkipTaskbar(true); } catch {}
  win.hide(); log('application.log', 'INFO', 'Window hidden to notification area');
}
function showFatal(title, err) {
  log('application.log', 'FATAL', title, errorInfo(err));
  if (shownCrashDialog || !app.isReady()) return;
  shownCrashDialog = true;
  dialog.showMessageBox({
    type: 'error', title: nativeLabel('app'),
    message: nativeLabel(title),
    detail: `${err?.stack || err?.message || String(err)}\n\n${nativeLabel('logPath')}\n${logDir}`,
    buttons: [nativeLabel('openLogs'), nativeLabel('close')], defaultId: 0, cancelId: 1
  }).then(({ response }) => { if (response === 0) shell.openPath(logDir); else { isQuitting = true; app.quit(); } }).catch(() => {});
}

process.on('uncaughtException', err => showFatal('خطای پیش‌بینی‌نشده در برنامه رخ داد.', err));
process.on('unhandledRejection', reason => log('application.log', 'ERROR', 'Unhandled promise rejection', errorInfo(reason)));
app.on('child-process-gone', (_event, details) => log('application.log', 'ERROR', 'Child process exited', details));

ipcMain.on('tameshk:renderer-log', (event, entry) => {
  if (!isTrustedRenderer(event) || !acceptRendererLog(event)) return;
  const clean = sanitizeRendererLogEntry(entry);
  if (!clean) return;
  const file = clean.kind === 'error' ? 'renderer.log' : 'application.log';
  log(file, clean.level, clean.message, clean.details);
});
ipcMain.on('tameshk:interface-language',(event,language)=>{if(!isMainRenderer(event)||!['fa','en','ar'].includes(language))return;if(interfaceLanguage===language)return;interfaceLanguage=language;try{fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(interfaceLanguageFile,JSON.stringify({language}))}catch{}refreshTrayLanguage();if(win&&!win.isDestroyed())win.setTitle(nativeLabel('app'));widgetManager?.refreshLanguageTitles?.();});
ipcMain.on('tameshk:minimize-to-tray', event => { if (isMainRenderer(event)) hideToTray(); });
ipcMain.on('tameshk:window-minimize', event => { if (isMainRenderer(event)) win.minimize(); });
ipcMain.on('tameshk:window-toggle-maximize', event => { if (!isMainRenderer(event)) return; if (win.isMaximized()) win.unmaximize(); else win.maximize(); });
ipcMain.on('tameshk:window-close', event => {
  if (!isMainRenderer(event)) return;
  isQuitting = true;
  log('application.log','INFO','Explicit window close requested');
  try { if (win && !win.isDestroyed()) win.destroy(); } catch (err) { log('application.log','ERROR','Could not destroy main window',errorInfo(err)); }
  app.quit();
});
ipcMain.handle('tameshk:window-is-maximized', event => isMainRenderer(event) && win.isMaximized());
ipcMain.on('tameshk:quit', event => { if (!isMainRenderer(event)) return; isQuitting = true; log('application.log', 'INFO', 'Quit requested by user'); app.quit(); });
ipcMain.on('tameshk:expiry-notification', (event, payload) => {
  if (!isMainRenderer(event)) return;
  try {
    if (process.platform !== 'win32') {
      log('application.log','INFO','Native expiry notification skipped on unsupported platform',{platform:process.platform});
      return;
    }
    if (!Notification.isSupported()) {
      log('application.log','WARN','Native notifications are not supported by this Windows installation');
      return;
    }
    const clean = (value, limit=180) => cleanNotificationText(value, limit);
    const count = Math.max(1, Math.min(999, Number(payload?.count) || 1));
    const language = ['en','ar'].includes(payload?.language) ? payload.language : 'fa';
    const product = clean(payload?.product, 80) || (language==='en'?'item':language==='ar'?'سلعة':'کالا');
    const lot = clean(payload?.lot, 60);
    const days = Number(payload?.daysLeft);
    const when = Number.isFinite(days) ? (days < 0 ? (language==='en'?`Expired (${Math.abs(days)} days)`:language==='ar'?`منتهية (${Math.abs(days)} يوم)`:`منقضی‌شده (${Math.abs(days)} روز)`) : days === 0 ? (language==='en'?'Expires today':language==='ar'?'تنتهي اليوم':'امروز منقضی می‌شود') : (language==='en'?`${days} days until expiry`:language==='ar'?`${days} يوم حتى الانتهاء`:`${days} روز تا انقضا`)) : '';
    const customMessage = clean(payload?.message, 150);
    const expiryLabel = language==='en'?'Expiry alert':language==='ar'?'تنبيه انتهاء':'هشدار انقضا';
    let body = customMessage ? `${product}${when ? ` · ${when}` : ''} · ${customMessage}` : `${expiryLabel}: ${product}${when ? ` · ${when}` : ''}`;
    if (lot) body += ` · ${language==='en'?'Lot':language==='ar'?'الشحنة':'محموله'}: ${lot}`;
    if (count > 1) body += ` · ${language==='en'?`and ${count - 1} more alert(s)`:language==='ar'?`و ${count - 1} تنبيهات أخرى`:`و ${count - 1} هشدار دیگر`}`;
    const iconPath = app.isPackaged ? path.join(process.resourcesPath, 'app', 'icon-192.png') : path.join(__dirname, '..', 'resources', 'app', 'icon-192.png');
    const notification = new Notification({title:language==='en'?'Tameshk Accounting · Expiry alert':language==='ar'?'تمشك · تنبيه انتهاء الصلاحية':'حسابداری تمشک · هشدار انقضا', body, icon:iconPath, silent:false, timeoutType:'default'});
    notification.on('click', () => {
      if (!win || win.isDestroyed()) return;
      showMainWindow();
      win.webContents.executeJavaScript("if (typeof go === 'function') go('alerts')").catch(err => log('renderer.log','WARN','Could not navigate to expiry alerts after notification click',errorInfo(err)));
    });
    notification.on('failed', (_event, error) => log('application.log','ERROR','Native expiry notification failed',String(error)));
    notification.show();
    log('application.log','INFO','Native expiry notification displayed',{count,product,lot,daysLeft:Number.isFinite(days)?days:null});
  } catch (err) { log('application.log','ERROR','Could not display native expiry notification',errorInfo(err)); }
});
function versionTuple(value) { return String(value || '').replace(/^v/i,'').split(/[.+-]/).slice(0,3).map(x => Number.parseInt(x,10) || 0); }
function compareVersion(a,b) { const x=versionTuple(a),y=versionTuple(b); for(let i=0;i<3;i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)?1:-1;} return 0; }
ipcMain.handle('tameshk:check-updates', async event => {
  if (!isTrustedRenderer(event)) return {ok:false,reason:'unauthorized'};
  try {
    const response = await fetch('https://api.github.com/repos/cloudinnet/Tameshk-Accounting/releases/latest', {headers:{'Accept':'application/vnd.github+json','User-Agent':'Tameshk-Accounting-Desktop'},signal:AbortSignal.timeout(12000)});
    if (!response.ok) return {ok:false,reason:response.status===404?'no-release':'network'};
    const release = await response.json();
    const latest = String(release.tag_name || release.name || '').replace(/^v/i,'');
    if (!latest) return {ok:false,reason:'invalid-release'};
    const installer = Array.isArray(release.assets) ? release.assets.find(asset => /setup.*\.exe$/i.test(String(asset.name||'')) && /^https:\/\/github\.com\/cloudinnet\/Tameshk-Accounting\//i.test(String(asset.browser_download_url||''))) : null;
    let releaseNotes = String(release.body || '').trim();
    if (!releaseNotes && /^\d+\.\d+\.\d+$/.test(latest)) {
      const tag = encodeURIComponent(String(release.tag_name || `v${latest}`));
      try {
        const notesResponse = await fetch(`https://raw.githubusercontent.com/cloudinnet/Tameshk-Accounting/${tag}/CHANGELOG-${latest}.md`, {headers:{'User-Agent':'Tameshk-Accounting-Desktop'},signal:AbortSignal.timeout(8000)});
        if (notesResponse.ok) releaseNotes = String(await notesResponse.text()).slice(0,20000);
      } catch {}
    }
    return {ok:true,version:latest,available:compareVersion(latest,app.getVersion())>0,url:installer?.browser_download_url || release.html_url || 'https://github.com/cloudinnet/Tameshk-Accounting/releases/latest',releaseNotes,publishedAt:String(release.published_at||'')};
  } catch (error) { log('application.log','WARN','Update check failed',{message:error?.message}); return {ok:false,reason:'network'}; }
});
ipcMain.handle('tameshk:get-app-version', event => isTrustedRenderer(event) ? app.getVersion() : '');
ipcMain.handle('tameshk:open-external', async (event, value) => {
  if (!isTrustedRenderer(event)) return false;
  try { const url=new URL(String(value||'')); if(url.protocol!=='https:'||!['github.com','www.github.com'].includes(url.hostname)||!(url.pathname==='/cloudinnet/Tameshk-Accounting'||url.pathname.startsWith('/cloudinnet/Tameshk-Accounting/')))return false; await shell.openExternal(url.toString()); return true; } catch { return false; }
});
ipcMain.handle('tameshk:open-logs', async event => isTrustedRenderer(event) ? shell.openPath(logDir) : 'Unauthorized');
ipcMain.handle('tameshk:get-log-dir', event => isTrustedRenderer(event) ? logDir : '');
const isInvoiceRenderer = sender => isInvoicePrintSender(sender, win?.webContents, invoiceRendererOrigin || undefined, candidate => widgetManager?.isWidgetRenderer({ sender: candidate }) === true);
registerInvoicePrint(ipcMain, isInvoiceRenderer);
registerInvoicePdfSave(ipcMain, isInvoiceRenderer, () => app.getPath('downloads'));

function mime(file) {
  return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.webm':'audio/webm','.mp4':'audio/mp4'})[path.extname(file).toLowerCase()] || 'application/octet-stream';
}
// A randomly allocated per-user port is saved so origin-scoped browser storage stays stable without a predictable port.
function startLocalServer(root) {
  return new Promise((resolve, reject) => {
    const preferredPort = readPreferredPort(appPortFile);
    let boundPort = null;
    server = http.createServer((req, res) => {
      try {
        if (req.headers.host !== `127.0.0.1:${boundPort}`) { res.writeHead(403); return res.end('Forbidden'); }
        if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
        const requestPath = new URL(req.url || '/', 'http://127.0.0.1').pathname;
        const decoded = decodeURIComponent(requestPath);
        const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
        const target = path.resolve(root, relative);
        if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
        fs.stat(target, (statErr, stat) => {
          if (statErr || !stat.isFile()) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not found'); }
          const headers = {
            'Content-Type': mime(target), 'Content-Length': stat.size,
            'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer'
          };
          if (path.extname(target).toLowerCase() === '.html') Object.assign(headers, HTML_SECURITY_HEADERS);
          res.writeHead(200, headers);
          if (req.method === 'HEAD') return res.end();
          const stream = fs.createReadStream(target);
          stream.on('error', e => { log('application.log','ERROR','Static file read failed',{target,error:errorInfo(e)}); if (!res.headersSent) res.writeHead(500); res.end(); });
          stream.pipe(res);
        });
      } catch (err) { log('application.log','ERROR','Local server request failed',errorInfo(err)); res.writeHead(400); res.end('Bad request'); }
    });
    server.once('error', reject);
    server.listen(preferredPort || 0, '127.0.0.1', () => {
      try {
        boundPort = server.address().port;
        if (!preferredPort) savePreferredPort(appPortFile, boundPort);
        resolve(boundPort);
      } catch (err) {
        server.close(() => {});
        reject(err);
      }
    });
  });
}
function refreshTrayLanguage(){if(!tray)return;tray.setToolTip(nativeLabel('app'));tray.setContextMenu(Menu.buildFromTemplate([{label:nativeLabel('openApp'),click:()=>showMainWindow()},{type:'separator'},{label:nativeLabel('openLogs'),click:()=>shell.openPath(logDir)},{label:nativeLabel('quit'),click:()=>{isQuitting=true;log('application.log','INFO','Quit selected from tray');app.quit()}}]));}
function createTray() {
  try {
    const iconPath = app.isPackaged ? path.join(process.resourcesPath, 'app', 'icon-192.png') : path.join(__dirname, '..', 'resources', 'app', 'icon-192.png');
    let image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) image = nativeImage.createEmpty();
    tray = new Tray(image);
    refreshTrayLanguage();
    tray.on('click', () => showMainWindow());
    tray.on('double-click', () => showMainWindow());
    return true;
  } catch (err) { log('application.log','WARN','System tray is unavailable',errorInfo(err)); return false; }
}
function desktopTitlebarInstallScript() {
  const css = `
    body{padding-top:62px!important}
    .app{min-height:calc(100vh - 62px)!important}
    aside{top:62px!important;height:calc(100vh - 62px)!important}
    .topbar{top:62px!important;z-index:8!important}
    #tameshkDesktopTitlebar{position:fixed!important;top:9px!important;left:12px!important;right:12px!important;width:calc(100% - 24px)!important;height:44px!important;z-index:6!important;display:flex!important;align-items:center!important;justify-content:space-between!important;box-sizing:border-box!important;padding:0 7px 0 14px!important;background:var(--navy,rgba(20,43,59,.72))!important;background:linear-gradient(115deg,color-mix(in srgb,var(--navy,rgba(20,43,59,.72)) 78%,rgba(191,234,242,.82) 22%),color-mix(in srgb,var(--navy,rgba(20,43,59,.72)) 88%,rgba(15,42,63,.76) 12%))!important;color:#f5fbfd!important;border:1px solid rgba(224,249,252,.24)!important;border-radius:15px!important;box-shadow:0 9px 26px rgba(4,17,29,.24),inset 0 1px 0 rgba(255,255,255,.20)!important;backdrop-filter:blur(20px) saturate(1.45)!important;-webkit-backdrop-filter:blur(20px) saturate(1.45)!important;font:12px Tahoma,Arial,sans-serif!important;direction:ltr!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;-webkit-app-region:drag!important;isolation:isolate!important;overflow:hidden!important}
    #tameshkDesktopTitlebar .title{display:flex!important;align-items:center!important;gap:9px!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:#f5fbfd!important;font:600 12px Tahoma,Arial,sans-serif!important;letter-spacing:.1px!important;padding:0 9px!important;text-shadow:0 1px 3px rgba(0,12,24,.5)!important;-webkit-app-region:drag!important}
    #tameshkDesktopTitlebar .title::before{content:''!important;display:inline-block!important;flex:0 0 7px!important;width:7px!important;height:7px!important;border-radius:50%!important;background:var(--teal,#36b8aa)!important;box-shadow:0 0 9px color-mix(in srgb,var(--teal,#36b8aa) 72%,transparent)!important}
    #tameshkDesktopTitlebar .window-buttons{height:36px!important;display:flex!important;align-items:center!important;gap:4px!important;flex:0 0 auto!important;padding:3px!important;border:1px solid rgba(232,250,255,.16)!important;border-radius:12px!important;background:rgba(10,28,42,.18)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.1)!important;-webkit-app-region:no-drag!important}
    #tameshkDesktopTitlebar button{box-sizing:border-box!important;width:36px!important;height:30px!important;margin:0!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#eaf7fa!important;display:grid!important;place-items:center!important;cursor:pointer!important;transition:background .16s ease,color .16s ease,transform .16s ease!important;-webkit-app-region:no-drag!important}
    #tameshkDesktopTitlebar button svg{display:block!important;width:16px!important;height:16px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.75!important;stroke-linecap:round!important;stroke-linejoin:round!important;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25))!important}
    #tameshkDesktopTitlebar button:hover{background:rgba(235,249,252,.18)!important;color:#fff!important;transform:translateY(-1px)!important}
    #tameshkDesktopTitlebar button[data-window-close]:hover{background:#d34d5d!important;color:#fff!important;box-shadow:0 3px 10px rgba(211,77,93,.32)!important}
    #tameshkDesktopTitlebar button:focus-visible{outline:2px solid var(--teal,#36b8aa)!important;outline-offset:-3px!important}
    .tameshk-window-resize-handle{position:fixed!important;z-index:9!important;display:block!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;pointer-events:auto!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important;-webkit-app-region:no-drag!important}
    .tameshk-window-resize-handle[data-edge="n"],.tameshk-window-resize-handle[data-edge="s"]{left:12px!important;right:12px!important;height:8px!important;cursor:ns-resize!important}
    .tameshk-window-resize-handle[data-edge="n"]{top:0!important}.tameshk-window-resize-handle[data-edge="s"]{bottom:0!important}
    .tameshk-window-resize-handle[data-edge="e"],.tameshk-window-resize-handle[data-edge="w"]{top:12px!important;bottom:12px!important;width:8px!important;cursor:ew-resize!important}
    .tameshk-window-resize-handle[data-edge="e"]{right:0!important}.tameshk-window-resize-handle[data-edge="w"]{left:0!important}
    .tameshk-window-resize-handle[data-edge="ne"],.tameshk-window-resize-handle[data-edge="nw"],.tameshk-window-resize-handle[data-edge="se"],.tameshk-window-resize-handle[data-edge="sw"]{width:14px!important;height:14px!important}
    .tameshk-window-resize-handle[data-edge="ne"],.tameshk-window-resize-handle[data-edge="sw"]{cursor:nesw-resize!important}.tameshk-window-resize-handle[data-edge="nw"],.tameshk-window-resize-handle[data-edge="se"]{cursor:nwse-resize!important}
    .tameshk-window-resize-handle[data-edge="ne"]{top:0!important;right:0!important}.tameshk-window-resize-handle[data-edge="nw"]{top:0!important;left:0!important}.tameshk-window-resize-handle[data-edge="se"]{bottom:0!important;right:0!important}.tameshk-window-resize-handle[data-edge="sw"]{bottom:0!important;left:0!important}
    html.tameshk-window-maximized .tameshk-window-resize-handle{display:none!important}
    @media print{html body{padding-top:0!important;margin-top:0!important}#tameshkDesktopTitlebar,.tameshk-window-resize-handle,.topbar{display:none!important;visibility:hidden!important}}
    @media(max-width:720px){body{padding-top:58px!important}.app{min-height:calc(100vh - 58px)!important}aside{height:auto!important;top:58px!important}.topbar{top:58px!important;z-index:8!important}#tameshkDesktopTitlebar{top:7px!important;left:8px!important;right:8px!important;width:calc(100% - 16px)!important}}
  `;
  return `(() => {
    const bridge=window.tameshkDesktop, root=document.documentElement;
    if(!bridge || !root) return {bridge:!!bridge,root:!!root,titlebar:false,style:false};
    const css=${JSON.stringify(css)};
    let style=document.getElementById('tameshkDesktopTitlebarStyle');
    if(!style){style=document.createElement('style');style.id='tameshkDesktopTitlebarStyle';root.appendChild(style)}
    style.textContent=css;
    const mount=()=>{
      let bar=document.getElementById('tameshkDesktopTitlebar');
      if(!bar){
        bar=document.createElement('div');bar.id='tameshkDesktopTitlebar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Window controls');
        const title=document.createElement('span');title.className='title';title.textContent=document.title||'Tameshk Accounting';bar.appendChild(title);
        const controls=document.createElement('div');controls.className='window-buttons';
        const makeButton=(action,label,iconMarkup)=>{const button=document.createElement('button');button.type='button';button.dataset[action]='';button.setAttribute('aria-label',label);button.title=label;button.innerHTML=iconMarkup;controls.appendChild(button);return button};
        const language=(document.documentElement.lang||'fa').toLowerCase().split('-')[0];
        const labels=language==='en'?{minimize:'Minimize',maximize:'Maximize',restore:'Restore',close:'Close'}:language==='ar'?{minimize:'تصغير',maximize:'تكبير',restore:'استعادة',close:'إغلاق'}:{minimize:'کمینه‌سازی',maximize:'بزرگ‌نمایی',restore:'بازگردانی',close:'بستن برنامه'};
        const icons={minimize:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',maximize:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1.8"/></svg>',restore:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8V5.8A1.8 1.8 0 0 1 9.8 4h9.4A1.8 1.8 0 0 1 21 5.8v9.4a1.8 1.8 0 0 1-1.8 1.8H17"/><rect x="3" y="8" width="14" height="13" rx="1.8"/></svg>',close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>'};
        const setMaximized=value=>{maximize.innerHTML=value?icons.restore:icons.maximize;maximize.title=value?labels.restore:labels.maximize;maximize.setAttribute('aria-label',maximize.title);root.classList.toggle('tameshk-window-maximized',!!value)};
        makeButton('windowMinimize',labels.minimize,icons.minimize).addEventListener('click',()=>bridge.minimizeWindow());
        const maximize=makeButton('windowMaximize',labels.maximize,icons.maximize);
        maximize.addEventListener('click',()=>bridge.toggleMaximizeWindow());
        bridge.isWindowMaximized().then(setMaximized).catch(()=>{});
        bridge.onWindowState(setMaximized);
        makeButton('windowClose',labels.close,icons.close).addEventListener('click',()=>bridge.closeWindow());
        bar.appendChild(controls);
        bar.addEventListener('dblclick',event=>{if(!event.target.closest('button'))bridge.toggleMaximizeWindow()});
        root.appendChild(bar);
      }
      return !!document.getElementById('tameshkDesktopTitlebar');
    };
    const installResizeHandles=()=>{
      if(!bridge.beginWindowResize || !bridge.endWindowResize) return;
      const edges=['n','s','e','w','ne','nw','se','sw'];
      for(const edge of edges){
        if(document.querySelector('.tameshk-window-resize-handle[data-edge="'+edge+'"]')) continue;
        const handle=document.createElement('div');
        handle.className='tameshk-window-resize-handle';handle.dataset.edge=edge;
        handle.setAttribute('aria-hidden','true');
        let dragStart=null, activePointer=null;
        handle.addEventListener('pointerdown',event=>{
          if(event.button!==0) return;
          event.preventDefault();event.stopPropagation();
          dragStart={x:event.clientX,y:event.clientY};activePointer=event.pointerId;
          try{handle.setPointerCapture(event.pointerId)}catch{}
          bridge.beginWindowResize(edge);
        });
        handle.addEventListener('pointermove',event=>{
          if(!dragStart||event.pointerId!==activePointer) return;
          event.preventDefault();event.stopPropagation();
          bridge.updateWindowResize({x:event.clientX-dragStart.x,y:event.clientY-dragStart.y});
        });
        const end=event=>{if(event&&activePointer!==null&&event.pointerId!==activePointer)return;if(event){event.preventDefault();event.stopPropagation()}dragStart=null;activePointer=null;bridge.endWindowResize()};
        handle.addEventListener('pointerup',end);
        handle.addEventListener('pointercancel',end);
        root.appendChild(handle);
      }
    };
    mount();installResizeHandles();
    if(!window.__tameshkTitlebarObserver && window.MutationObserver){
      window.__tameshkTitlebarObserver=new MutationObserver(()=>{if(!document.getElementById('tameshkDesktopTitlebar'))mount();installResizeHandles()});
      window.__tameshkTitlebarObserver.observe(root,{childList:true,subtree:true});
    }
    setTimeout(mount,250);setTimeout(mount,1200);
    const bar=document.getElementById('tameshkDesktopTitlebar'),rect=bar?.getBoundingClientRect();
    return {bridge:true,titlebar:!!bar,style:!!document.getElementById('tameshkDesktopTitlebarStyle'),buttons:bar?.querySelectorAll('button').length||0,top:rect?.top??null,height:rect?.height??null,background:getComputedStyle(bar).backgroundColor};
  })()`;
}

async function createWindow() {
  const rendererRoot = app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..', 'resources', 'app');
  if (!fs.existsSync(path.join(rendererRoot, 'index.html'))) throw new Error(`برنامهٔ رابط پیدا نشد: ${rendererRoot}`);
  const port = await startLocalServer(rendererRoot);
  const url = `http://127.0.0.1:${port}/`;
  const appOrigin = new URL(url).origin;
  invoiceRendererOrigin = appOrigin;
  const primaryArea = screen.getPrimaryDisplay().workArea;
  const initialWidth = Math.min(1440, primaryArea.width);
  const initialHeight = Math.min(940, primaryArea.height);
  win = new BrowserWindow({
    width: initialWidth, height: initialHeight,
    minWidth: Math.min(920, initialWidth), minHeight: Math.min(640, initialHeight),
    show: false, center: true, autoHideMenuBar: true, title: nativeLabel('app'),
    // Frameless custom titlebar, while retaining the native thick-frame resize hit targets on Windows.
    frame: false, thickFrame: true, transparent: true, backgroundColor: '#00000000', resizable: true,
    minimizable: true, maximizable: true,
    icon: path.join(rendererRoot, 'icon-192.png'),
    webPreferences: { preload: path.join(__dirname,'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  widgetManager = createWidgetManager({getInterfaceLanguage:()=>interfaceLanguage,app,BrowserWindow,screen,ipcMain,baseUrl:url,preloadPath:path.join(__dirname,'preload.cjs'),iconPath:path.join(rendererRoot,'icon-192.png'),dataDir,getMainWindow:()=>win,log:(level,message,details)=>log('application.log',level,message,details)});
  widgetManager.onMainCreated(win);

  // Chromium's ready-to-show can precede locale/profile initialization and our
  // custom titlebar. Reveal only after both have settled, with a bounded escape
  // hatch for a failed renderer/header installer.
  let initialShown = false;
  const showInitialWindow = () => {
    if (initialShown || !win || win.isDestroyed()) return;
    initialShown = true;
    clearTimeout(initialShowDeadline);
    win.setSkipTaskbar(false); win.show(); reportWindowState();
    scheduleDisplayFit('ready-to-show');
    log('application.log','INFO','Main window ready',{url,version:app.getVersion()});
  };
  const initialShowDeadline = setTimeout(showInitialWindow, 10000);

  const displayBounds = new Map();
  const initialBounds = win.getBounds();
  let activeDisplay = screen.getDisplayNearestPoint({ x: initialBounds.x + initialBounds.width / 2, y: initialBounds.y + initialBounds.height / 2 });
  let geometryTimer = null;
  let settingDisplayBounds = false;
  const rememberBounds = (display, bounds) => {
    if (display && isInsideWorkArea(bounds, display.workArea)) displayBounds.set(display.id, { ...bounds });
  };
  rememberBounds(activeDisplay, win.getBounds());
  const reconcileWindowWithDisplay = reason => {
    if (!win || win.isDestroyed() || settingDisplayBounds || resizeSession || win.isMaximized() || win.isFullScreen()) return;
    const current = win.getBounds();
    // The center is the stable ownership point while a window straddles two
    // displays; overlap-based matching can flip as the window is resized.
    const center = { x: Math.round(current.x + current.width / 2), y: Math.round(current.y + current.height / 2) };
    const display = screen.getDisplayNearestPoint(center);
    const changedDisplay = display.id !== activeDisplay?.id;
    const destinationSaved = changedDisplay ? displayBounds.get(display.id) : null;
    // Remember bounds only while the window center is on the active display.
    if (activeDisplay && display.id === activeDisplay.id) rememberBounds(activeDisplay, current);
    const source = destinationSaved || current;
    const fitted = fitWindowBounds(source, display.workArea, 920, 640);
    try {
      win.setMinimumSize(fitted.minWidth, fitted.minHeight);
      const next = fitted.bounds;
      const needsChange = next.x !== current.x || next.y !== current.y || next.width !== current.width || next.height !== current.height;
      if (needsChange) {
        settingDisplayBounds = true;
        win.setBounds(next, false);
        setTimeout(() => { settingDisplayBounds = false; }, 450);
      }
      activeDisplay = display;
      const finalBounds = needsChange ? next : current;
      rememberBounds(display, finalBounds);
      if (changedDisplay || fitted.resized || fitted.repositioned) {
        log('application.log', 'INFO', 'Window fitted to display work area', {
          reason, displayId: display.id, workArea: display.workArea,
          oldBounds: current, newBounds: finalBounds, restoredSavedBounds: !!destinationSaved
        });
      }
    } catch (err) { log('application.log', 'WARN', 'Could not fit window to display', errorInfo(err)); }
  };
  const scheduleDisplayFit = reason => {
    // Wait until a user drag has actually settled. Fitting while the window is
    // still crossing displays changes its center and can alternate the chosen
    // monitor, producing a progressive shrink/resize loop.
    if (settingDisplayBounds || resizeSession) return;
    if (geometryTimer) clearTimeout(geometryTimer);
    geometryTimer = setTimeout(() => { geometryTimer = null; reconcileWindowWithDisplay(reason); }, 500);
  };
  let resizeSession = null;
  const stopCustomResize = () => {
    if (!resizeSession) return;
    resizeSession = null;
    scheduleDisplayFit('custom-resize-end');
  };
  ipcMain.on('tameshk:window-resize-start', (event, direction) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents || resizeSession ||
        win.isMaximized() || win.isFullScreen()) return;
    if (!resizeDirections.has(direction)) return;
    const [minWidth, minHeight] = win.getMinimumSize();
    resizeSession = { direction, bounds: win.getBounds(), minWidth, minHeight };
  });
  ipcMain.on('tameshk:window-resize-update', (event, delta) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents || !resizeSession) return;
    const dx = Number(delta?.x), dy = Number(delta?.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 10000 || Math.abs(dy) > 10000) return;
    const { direction, bounds, minWidth, minHeight } = resizeSession;
    const next = resizeBoundsFromDrag(bounds, direction, { x:dx, y:dy }, { width:minWidth, height:minHeight });
    const current = win.getBounds();
    if (next.x !== current.x || next.y !== current.y || next.width !== current.width || next.height !== current.height) {
      try { win.setBounds(next, false); }
      catch (err) { log('application.log','WARN','Custom window resize failed',errorInfo(err)); stopCustomResize(); }
    }
  });
  ipcMain.on('tameshk:window-resize-end', event => {
    if (win && !win.isDestroyed() && event.sender === win.webContents) stopCustomResize();
  });
  win.on('move', () => scheduleDisplayFit('move'));
  win.on('resize', () => scheduleDisplayFit('resize'));
  screen.on('display-metrics-changed', () => scheduleDisplayFit('display-metrics-changed'));
  screen.on('display-added', () => scheduleDisplayFit('display-added'));
  screen.on('display-removed', () => scheduleDisplayFit('display-removed'));
  win.webContents.on('did-finish-load', () => {
    // Mount directly in the page's main world; do not depend on a custom event
    // crossing Electron's isolated preload world.
    win?.webContents?.executeJavaScript(desktopTitlebarInstallScript())
      .then(state => log('application.log', state?.titlebar && state?.buttons === 3 ? 'INFO' : 'ERROR', 'Desktop title bar installation', state))
      .catch(err => log('application.log','ERROR','Desktop title bar installation failed',errorInfo(err)))
      .then(() => win?.webContents?.executeJavaScript('window.TameshkStartup1506?.desktopReady()'))
      .catch(err => log('application.log','WARN','Startup visibility handshake failed',errorInfo(err)))
      .finally(showInitialWindow);
  });
  win.webContents.on('console-message', (_event, details) => {
    if ((details?.level ?? 0) >= 2) log('renderer.log', details.level >= 3 ? 'ERROR' : 'WARN', details.message, {source:details.sourceId,line:details.lineNumber});
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    log('renderer.log', 'ERROR', 'Renderer process exited unexpectedly', { url: win?.webContents?.getURL(), details });
    if (details?.reason !== 'clean-exit') showFatal('رابط برنامه متوقف شد. گزارش خطا ذخیره شد.', new Error(safeString(details)));
  });
  win.webContents.on('did-fail-load', (_event, code, description, failedUrl, isMainFrame) => {
    log('renderer.log','ERROR','Page failed to load',{code,description,failedUrl,isMainFrame});
    if (isMainFrame) showFatal('صفحهٔ اصلی برنامه بارگذاری نشد.', new Error(`${code}: ${description} (${failedUrl})`));
  });
  win.webContents.on('will-navigate', (event, destination) => {
    let safe = false;
    try { safe = new URL(destination).origin === appOrigin; } catch {}
    if (!safe) { event.preventDefault(); log('renderer.log','WARN','Blocked navigation outside local app',{destination}); }
  });
  win.webContents.setWindowOpenHandler(({url:destination}) => { log('renderer.log','WARN','Blocked popup',{destination}); return {action:'deny'}; });
  const reportWindowState = () => { if (!win?.isDestroyed()) win.webContents.send('tameshk:window-state', { maximized: win.isMaximized() }); };
  win.on('maximize', () => { const b=win.getBounds(); activeDisplay=screen.getDisplayNearestPoint({x:b.x+b.width/2,y:b.y+b.height/2}); reportWindowState(); });
  win.on('unmaximize', () => { reportWindowState(); scheduleDisplayFit('restore-from-maximize'); });
  win.once('ready-to-show', () => { log('application.log','INFO','Renderer first paint ready; waiting for startup header'); });
  win.on('close', () => { if (!isQuitting) { isQuitting = true; log('application.log', 'INFO', 'Window closed by user'); } });
  win.on('closed', () => { clearTimeout(initialShowDeadline); stopCustomResize(); if (geometryTimer) clearTimeout(geometryTimer); win = null; });
  await win.loadURL(url);
  createTray();
  log('application.log','INFO','Application started',{version:app.getVersion(),platform:process.platform,arch:process.arch,logs:logDir,rendererRoot});
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => showMainWindow());
  app.whenReady().then(async () => {
    fs.mkdirSync(logDir, { recursive: true });
    configureSessionSecurity(session.defaultSession, detail => log('application.log', 'WARN', 'Blocked renderer permission request', detail));
    log('application.log','INFO','Startup requested',{version:app.getVersion(),argv:process.argv.slice(1)});
    try { await createWindow(); }
    catch (err) { showFatal(err?.code==='EADDRINUSE'?'درگاه محلی برنامه اشغال شده است؛ برنامهٔ متعارض را ببندید و دوباره اجرا کنید.':'برنامه هنگام شروع با خطا روبه‌رو شد.', err); app.quit(); }
  });
  app.on('before-quit', () => { isQuitting = true; log('application.log','INFO','Application shutting down'); try { widgetManager?.dispose(); } catch {} try { server?.close(); } catch {} });
  app.on('window-all-closed', () => { if (isQuitting) app.quit(); });
}
