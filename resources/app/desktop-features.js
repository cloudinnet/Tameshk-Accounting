/* Browser-capable offline features: scheduled backups, shortcuts, and explicit Windows-only placeholders. */
(function (root) {
  'use strict';
  if (!root || root.TameshkDesktopFeatures) return;
  const ACTIONS = [
    ['dashboard', 'داشبورد', 'Dashboard', 'لوحة المعلومات'],
    ['new', 'ثبت تراکنش', 'New transaction', 'معاملة جديدة'],
    ['transactions', 'تراکنش‌ها', 'Transactions', 'المعاملات'],
    ['expenses', 'هزینه‌ها', 'Expenses', 'المصروفات'],
    ['inventory', 'انبارداری', 'Inventory', 'المخزون'],
    ['reports', 'گزارش‌ها', 'Reports', 'التقارير'],
    ['settings', 'پنل مدیریت', 'Admin panel', 'لوحة الإدارة']
  ];
  const SHORTCUT_PREFIX = 'Ctrl+Alt+';
  const ALLOWED_SHORTCUT_CODE = /^(?:Digit[0-9]|Numpad[0-9]|F(?:[235-9]|10))$/;
  const shortcutCodes = [...Array.from({length:10},(_,i)=>`Digit${i}`), ...Array.from({length:10},(_,i)=>`Numpad${i}`), ...[2,3,5,6,7,8,9,10].map(n=>`F${n}`)];
  const defaultShortcuts = Object.fromEntries(ACTIONS.map((action,index)=>[action[0],`${SHORTCUT_PREFIX}Digit${index+1}`]));
  let pendingShortcutAction = null;
  function normalizeShortcut(value) {
    const raw=String(value??'').trim();
    if (/^[0-9]$/.test(raw)) return `${SHORTCUT_PREFIX}Digit${raw}`; // migrate the old digit-only setting
    const match=/^Ctrl\+Alt\+([A-Za-z0-9]+)$/.exec(raw);
    return match&&ALLOWED_SHORTCUT_CODE.test(match[1])?`${SHORTCUT_PREFIX}${match[1]}`:null;
  }
  function shortcutEquivalent(value) {
    const binding=normalizeShortcut(value); if(!binding)return '';
    return binding.replace(/Numpad([0-9])$/, 'Digit$1');
  }
  function eventShortcutCode(event) {
    const code = String(event?.code || '');
    if (event?.location === 3) {
      if (/^Numpad[0-9]$/.test(code)) return code;
      const digit = /^[0-9]$/.test(String(event?.key || '')) ? String(event.key) : /^Digit([0-9])$/.exec(code)?.[1];
      if (digit) return `Numpad${digit}`;
    }
    return code;
  }
  function shortcutLabel(value) {
    const binding=normalizeShortcut(value); if(!binding)return '—';
    const code=binding.slice(SHORTCUT_PREFIX.length);
    const key=code.startsWith('Digit')?code.slice(5):code.startsWith('Numpad')?`Num ${code.slice(6)}`:code;
    return `Ctrl + Alt + ${key}`;
  }
  function matchingAction(event,prefs) {
    if(!event||!prefs||prefs.quickKeysEnabled===false||event.ctrlKey!==true||event.altKey!==true||event.shiftKey===true||event.metaKey===true||event.repeat||event.isComposing)return null;
    const target=event.target;
    if(target?.closest?.('input,textarea,select,[contenteditable="true"]'))return null;
    const binding=`${SHORTCUT_PREFIX}${eventShortcutCode(event)}`;
    return ACTIONS.find(([id])=>shortcutEquivalent(prefs.quickKeys?.[id])===shortcutEquivalent(binding))||null;
  }
  const DB_NAME = 'tameshk-offline-settings';
  const STORE_NAME = 'handles';
  const HANDLE_KEY = 'auto-backup-directory';
  let dbPromise;
  let directoryHandle;

  const st = () => typeof state !== 'undefined' ? state : root.state;
  const t = (fa, en, ar) => st()?.settings?.language === 'en' ? en : st()?.settings?.language === 'ar' ? ar : fa;
  const say = message => { if (typeof root.showToast === 'function') root.showToast(message); };
  const persist = () => { try { if (typeof save === 'function') save(); } catch (_) {} };
  const idb = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error('IndexedDB is unavailable'));
      const req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open backup settings'));
    });
    return dbPromise;
  };
  async function handleStore(mode, value) {
    const db = await idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode), store = tx.objectStore(STORE_NAME);
      let req;
      if (mode === 'readwrite') req = store.put(value, HANDLE_KEY);
      else req = store.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not access backup folder setting'));
      tx.onabort = () => reject(tx.error || new Error('Backup folder setting was not saved'));
    });
  }
  function ensurePrefs() {
    const s = st();
    if (!s || !s.settings) return;
    const prefs = s.settings;
    if (typeof prefs.autoBackupEnabled !== 'boolean') prefs.autoBackupEnabled = true;
    if (!Number.isFinite(Number(prefs.autoBackupIntervalDays))) prefs.autoBackupIntervalDays = 7;
    prefs.autoBackupIntervalDays = Math.max(1, Math.min(365, Math.round(Number(prefs.autoBackupIntervalDays))));
    if (!prefs.autoBackupStartedAt) prefs.autoBackupStartedAt = new Date().toISOString();
    if (!prefs.quickKeysEnabled && prefs.quickKeysEnabled !== false) prefs.quickKeysEnabled = true;
    if (!prefs.quickKeys || typeof prefs.quickKeys !== 'object' || Array.isArray(prefs.quickKeys)) prefs.quickKeys = {...defaultShortcuts};
    const used = new Set();
    for (const [key] of ACTIONS) {
      let binding=normalizeShortcut(prefs.quickKeys[key]);
      if(!binding||used.has(binding)) binding=!used.has(defaultShortcuts[key])?defaultShortcuts[key]:shortcutCodes.map(code=>`${SHORTCUT_PREFIX}${code}`).find(candidate=>!used.has(candidate));
      if(!binding)binding=defaultShortcuts[key];
      prefs.quickKeys[key]=binding;
      used.add(binding);
    }
    if (typeof prefs.autoBackupFolderName !== 'string') prefs.autoBackupFolderName = '';
  }
  ensurePrefs();
  persist();

  function escaped(s) { return typeof root.esc === 'function' ? root.esc(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function localeDate(iso) {
    if (!iso) return t('هنوز انجام نشده', 'Not yet', 'لم يتم بعد');
    const language = st()?.settings?.language;
    const loc = language === 'en' ? 'en-GB' : language === 'ar' ? 'ar-SA' : 'fa-IR';
    const d = new Date(iso);
    return Number.isFinite(+d) ? new Intl.DateTimeFormat(loc, {dateStyle:'medium', timeStyle:'short'}).format(d) : '—';
  }
  function dueAt() {
    const prefs = st()?.settings || {}, base = Date.parse(prefs.lastAutoBackupAt || prefs.autoBackupStartedAt || '');
    if (!Number.isFinite(base)) return 0;
    return base + Math.max(1, Number(prefs.autoBackupIntervalDays) || 7) * 86400000;
  }
  function isDue() { return !!st()?.settings?.autoBackupEnabled && Date.now() >= dueAt(); }
  function backupStatus() {
    const prefs = st()?.settings || {}, due = isDue(), next = dueAt();
    const status = due
      ? t('پشتیبان سررسید شده است؛ پوشه و مجوز نوشتن را بررسی کنید.', 'Backup is due; check the folder and write permission.', 'حان موعد النسخ الاحتياطي؛ تحقق من المجلد وإذن الكتابة.')
      : `${t('نسخهٔ بعدی', 'Next backup', 'النسخة التالية')}: ${localeDate(new Date(next).toISOString())}`;
    return `<div class="notice ${due ? 'auto-backup-due' : ''}" id="autoBackupStatus"><b>${escaped(due ? t('نیاز به پشتیبان', 'Backup due', 'النسخ الاحتياطي مستحق') : t('زمان‌بندی پشتیبان', 'Backup schedule', 'جدول النسخ الاحتياطي'))}</b><br>${escaped(status)}<br><span>${escaped(t('آخرین فایل', 'Last file', 'آخر ملف'))}: ${escaped(prefs.lastAutoBackupFile || t('ندارد', 'None', 'لا يوجد'))} · ${escaped(localeDate(prefs.lastAutoBackupAt))}</span><br><span>${escaped(t('پوشه', 'Folder', 'المجلد'))}: ${escaped(prefs.autoBackupFolderName || t('هنوز انتخاب نشده', 'Not selected', 'لم يتم اختياره'))}</span></div>`;
  }
  function shortcutsMarkup() {
    const prefs = st()?.settings || {}, keys = prefs.quickKeys || {};
    return ACTIONS.map(([id, fa, en, ar]) => {
      const label = t(fa, en, ar), binding = normalizeShortcut(keys[id]) || defaultShortcuts[id];
      return `<div class="desktop-key-row"><label for="quick-${id}">${escaped(label)}</label><button id="quick-${id}" type="button" class="desktop-key-capture" data-shortcut-capture="${id}" onclick="tameshkBeginQuickKeyCapture('${id}')">${escaped(shortcutLabel(binding))}</button></div>`;
    }).join('');
  }
  function settingsMarkup() {
    const prefs = st()?.settings || {}, days = Math.max(1, Math.min(365, Number(prefs.autoBackupIntervalDays) || 7));
    const disabled = prefs.autoBackupEnabled ? '' : 'disabled';
    const folderSupported = typeof root.showDirectoryPicker === 'function';
    return `<div class="desktop-features">
      <section class="panel settings-block"><h3>${escaped(t('پشتیبان‌گیری خودکار', 'Automatic backups', 'النسخ الاحتياطي التلقائي'))}</h3>
        <p class="muted desktop-help">${escaped(t('بررسی زمان‌بندی هنگام بازشدن برنامه انجام می‌شود.', 'The schedule is checked when the app opens.', 'يتم التحقق من الجدول عند فتح التطبيق.'))}</p>
        <div class="form-grid"><div class="field"><label class="toggle"><input id="autoBackupEnabled" type="checkbox" ${prefs.autoBackupEnabled?'checked':''} onchange="tameshkToggleAutoBackup(this.checked)"> ${escaped(t('فعال باشد', 'Enable automatic backups', 'تفعيل النسخ التلقائي'))}</label></div>
        <div class="field"><label for="autoBackupDays">${escaped(t('فاصلهٔ پشتیبان‌گیری (روز)', 'Backup interval (days)', 'الفاصل بين النسخ (أيام)'))}</label><input id="autoBackupDays" type="number" min="1" max="365" step="1" value="${days}" ${disabled}></div></div>
        ${backupStatus()}
        <div class="toolbar"><button class="btn" type="button" onclick="tameshkChooseBackupFolder()" ${folderSupported?'':'disabled'}>${escaped(t('انتخاب پوشهٔ پشتیبان', 'Choose backup folder', 'اختيار مجلد النسخ'))}</button><button class="btn primary" type="button" onclick="tameshkBackupNow()">${escaped(t('پشتیبان‌گیری در پوشه', 'Back up to folder now', 'نسخ احتياطي إلى المجلد الآن'))}</button><button class="btn" type="button" onclick="backup()">${escaped(t('دانلود فایل پشتیبان', 'Download backup file', 'تنزيل ملف النسخ'))}</button><button class="btn" type="button" onclick="document.getElementById('restoreSettings')?.click()">${escaped(t('درون‌ریزی پشتیبان', 'Import backup', 'استيراد نسخة احتياطية'))}</button></div>
        ${!folderSupported?`<div class="notice">${escaped(t('انتخاب پوشه در این مرورگر پشتیبانی نمی‌شود؛ از دانلود فایل پشتیبان استفاده کنید.', 'Folder selection is unavailable in this browser; use the backup download instead.', 'اختيار المجلد غير متاح في هذا المتصفح؛ استخدم تنزيل النسخة.'))}</div>`:''}
      </section>
      <section class="panel settings-block"><h3>${escaped(t('دسترسی سریع با صفحه‌کلید', 'Keyboard shortcuts', 'اختصارات لوحة المفاتيح'))}</h3><p class="muted desktop-help">${escaped(t('برای هر بخش روی دکمهٔ میان‌بر بزنید و Ctrl + Alt + یک رقم یا F2، F3 و F5 تا F10 را فشار دهید (سه کلید). ترکیب تکراری و میان‌برهای شناخته‌شدهٔ سیستمی پذیرفته نمی‌شود؛ هنگام تایپ در فیلدها میان‌بر اجرا نخواهد شد.', 'Click a shortcut button and press Ctrl + Alt + a digit or F2, F3, F5–F10 (three keys). Duplicate bindings and known system shortcuts are rejected; shortcuts do not fire while typing in fields.', 'اضغط زر الاختصار ثم Ctrl + Alt + رقم أو F2, F3, F5–F10 (ثلاثة مفاتيح). تُرفض التركيبات المكررة واختصارات النظام المعروفة، ولا تعمل أثناء الكتابة في الحقول.'))}</p>
        <label class="toggle"><input id="quickKeysEnabled" type="checkbox" ${prefs.quickKeysEnabled?'checked':''} onchange="tameshkToggleQuickKeys(this.checked)"> ${escaped(t('فعال‌بودن دسترسی سریع', 'Enable quick access', 'تفعيل الوصول السريع'))}</label><div class="desktop-key-list ${prefs.quickKeysEnabled?'':'is-disabled'}" id="quickKeysList">${shortcutsMarkup()}</div></section>
      <section class="panel settings-block"><h3>${escaped(t('اتصال شبکه و امکانات ویندوز', 'Network and Windows desktop features', 'الشبكة وميزات سطح مكتب Windows'))}</h3>
        <div class="desktop-network-placeholders" aria-label="${escaped(t('امکانات شبکه در دست توسعه', 'Networking features in development', 'ميزات الشبكة قيد التطوير'))}">
          ${[
            t('شبکهٔ محلی بین چند رایانه', 'Local network between computers', 'شبكة محلية بين عدة أجهزة'),
            t('اتصال نرم‌افزار از طریق اینترنت', 'Connect the app over the internet', 'اتصال البرنامج عبر الإنترنت'),
            t('همگام‌سازی اطلاعات بین چند دستگاه', 'Sync data across multiple devices', 'مزامنة البيانات بين أجهزة متعددة')
          ].map(label => `<div class="desktop-placeholder" aria-disabled="true"><span class="desktop-placeholder-icon" aria-hidden="true">⌁</span><div><b>${escaped(label)}</b><p>${escaped(t('در نسخهٔ فعلی غیرفعال است.', 'Unavailable in this release.', 'غير متاح في هذا الإصدار.'))}</p></div></div>`).join('')}
        </div>
        <div class="form-grid"><div class="field"><label class="toggle"><input id="autoUpdateCheckEnabled" type="checkbox" ${prefs.autoUpdateCheckEnabled!==false?'checked':''} onchange="tameshkToggleAutoUpdates(this.checked)"> ${escaped(t('بررسی خودکار به‌روزرسانی (هر ۷ روز یک‌بار)', 'Check for updates automatically (every 7 days)', 'التحقق التلقائي من التحديثات (كل ٧ أيام)'))}</label><small class="muted" id="autoUpdateCheckStatus"></small></div></div>
        <div class="toolbar"><button class="btn" id="manualUpdateCheck" type="button" onclick="tameshkCheckForUpdates(true)">${escaped(t('بررسی به‌روزرسانی', 'Check for updates', 'التحقق من التحديثات'))}</button><span class="muted desktop-help">${escaped(t('بررسی نسخه از منبع رسمی انتشار GitHub انجام می‌شود.', 'Updates are checked against the official GitHub releases.', 'يتم التحقق من التحديثات عبر إصدارات GitHub الرسمية.'))}</span></div>
      </section>
    </div>`;
  }
  function refreshBackupPanel() {
    const current = root.document?.getElementById('autoBackupStatus');
    if (current) current.outerHTML = backupStatus();
  }
  const css = document.createElement('style');
  css.textContent = `.desktop-features{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.desktop-features .settings-block{margin:0}.desktop-features .settings-block:first-child,.desktop-features .settings-block:last-child{grid-column:1/-1}.desktop-help{font-size:11px;line-height:1.8}.auto-backup-due{background:#fff4e3;color:#805514}.desktop-key-list{display:grid;gap:7px;margin-top:12px}.desktop-key-list.is-disabled{opacity:.5;pointer-events:none}.desktop-key-row{display:grid;grid-template-columns:1fr minmax(180px,.7fr);gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);font-size:12px}.desktop-key-row select,.desktop-key-capture{border:1px solid #dfe6e9;border-radius:8px;padding:7px;background:white;color:var(--ink);font:inherit;cursor:pointer}.desktop-key-capture.is-capturing{border-color:#d97706;background:#fff7ed;color:#9a3412;outline:2px solid #fed7aa}.desktop-key-capture:focus-visible{outline:2px solid #16827b;outline-offset:2px}.desktop-placeholder{display:flex;gap:12px;align-items:center;border:1px dashed #b9c5ca;border-radius:10px;padding:10px;margin:10px 0;color:#78858b}.desktop-placeholder-icon{font-size:23px;font-weight:900}.desktop-placeholder p{margin:3px 0;font-size:11px}.desktop-network-placeholders{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.desktop-network-placeholders .desktop-placeholder{margin:8px 0 0;min-height:64px}.desktop-disabled{opacity:.48}.desktop-disabled input{width:100%}@media(max-width:720px){.desktop-features{grid-template-columns:1fr}.desktop-features .settings-block:first-child,.desktop-features .settings-block:last-child{grid-column:auto}.desktop-key-row{grid-template-columns:1fr 1fr}.desktop-network-placeholders{grid-template-columns:1fr}}`;
  if (root.document?.head) root.document.head.appendChild(css);

  function initializeSettingsUI(el) {
    const original = root.settingsPage;
    if (typeof original !== 'function' || original.__tameshkDesktopWrapped) return;
    function wrappedSettingsPage(target) {
      const result = original.apply(this, arguments);
      const host = target || root.document?.getElementById('content');
      if (host && !host.querySelector('.desktop-features')) host.insertAdjacentHTML('beforeend', settingsMarkup());
      const restoreInput = host?.querySelector('#restoreSettings');
      if (restoreInput && typeof root.restoreFile === 'function') restoreInput.onchange = root.restoreFile;
      const s = st()?.settings || {};
      const e = root.document?.getElementById('autoBackupEnabled'), d = root.document?.getElementById('autoBackupDays'), q = root.document?.getElementById('quickKeysEnabled');
      if (e) e.checked = s.autoBackupEnabled !== false;
      if (d) { d.value = String(s.autoBackupIntervalDays || 7); d.disabled = !e?.checked; }
      if (q) q.checked = s.quickKeysEnabled !== false;
      return result;
    }
    wrappedSettingsPage.__tameshkDesktopWrapped = true;
    root.settingsPage = wrappedSettingsPage;
  }
  initializeSettingsUI();

  if (typeof root.saveSettings === 'function' && !root.saveSettings.__tameshkDesktopWrapped) {
    const originalSave = root.saveSettings;
    const wrappedSave = function () {
      const s = st();
      const enabled = root.document?.getElementById('autoBackupEnabled');
      const days = root.document?.getElementById('autoBackupDays');
      if (s?.settings) {
        if (enabled) s.settings.autoBackupEnabled = !!enabled.checked;
        const n = Number(days?.value);
        if (Number.isFinite(n) && n >= 1 && n <= 365) s.settings.autoBackupIntervalDays = Math.round(n);
        else if (days) { say(t('فاصله باید بین ۱ تا ۳۶۵ روز باشد.', 'Interval must be between 1 and 365 days.', 'يجب أن يكون الفاصل بين 1 و365 يوماً.')); return; }
      }
      const result = originalSave.apply(this, arguments);
      setTimeout(refreshBackupPanel, 0);
      return result;
    };
    wrappedSave.__tameshkDesktopWrapped = true;
    root.saveSettings = wrappedSave;
  }

  function moveToFolder(handle, fileName, text) {
    return (async () => {
      const file = await handle.getFileHandle(fileName, {create:true});
      const writable = await file.createWritable();
      try { await writable.write(text); await writable.close(); }
      catch (error) { try { await writable.abort(); } catch (_) {} throw error; }
    })();
  }
  function makeBackup(at) {
    const snapshot = structuredClone(st());
    snapshot.settings = snapshot.settings || {};
    snapshot.settings.lastAutoBackupAt = at;
    const filename = `tameshk-backup-${at.slice(0,10)}-${at.slice(11,19).replaceAll(':','-')}.json`;
    snapshot.settings.lastAutoBackupFile = filename;
    return {filename, text:JSON.stringify({schema:'tameshk.backup',version:3,exportedAt:at,metadata:{dateStorage:'Gregorian ISO-8601',transactionCalendar:snapshot.settings.transactionCalendar||'شمسی',calendarPerRecord:true,barcodeCatalog:true},state:snapshot},null,2)};
  }
  async function folderWrite(opts = {}) {
    const prefs = st()?.settings;
    if (!prefs) return false;
    let handle = directoryHandle;
    try { if (!handle) handle = await handleStore('readonly'); } catch (_) {}
    if (!handle && opts.allowPicker) {
      if (typeof root.showDirectoryPicker !== 'function') throw new Error(t('انتخاب پوشه در این مرورگر پشتیبانی نمی‌شود.', 'Folder selection is not supported in this browser.', 'اختيار المجلد غير مدعوم في هذا المتصفح.'));
      handle = await root.showDirectoryPicker({id:'tameshk-auto-backup', mode:'readwrite'});
      await handleStore('readwrite', handle);
      directoryHandle = handle;
      prefs.autoBackupFolderName = handle.name || t('پوشهٔ انتخاب‌شده','Selected folder','المجلد المحدد');
      persist();
    }
    if (!handle) return false;
    directoryHandle = handle;
    let permission = await handle.queryPermission?.({mode:'readwrite'});
    if (permission !== 'granted' && opts.allowRequest) permission = await handle.requestPermission?.({mode:'readwrite'});
    if (permission !== 'granted') return false;
    const at = new Date().toISOString(), {filename,text} = makeBackup(at);
    await moveToFolder(handle, filename, text);
    prefs.lastAutoBackupAt = at;
    prefs.lastAutoBackupFile = filename;
    prefs.autoBackupFolderName = handle.name || prefs.autoBackupFolderName || '';
    persist();
    refreshBackupPanel();
    return true;
  }
  root.tameshkChooseBackupFolder = async function () {
    try {
      if (typeof root.showDirectoryPicker !== 'function') throw new Error(t('انتخاب پوشه در این مرورگر پشتیبانی نمی‌شود.', 'Folder selection is not supported in this browser.', 'اختيار المجلد غير مدعوم في هذا المتصفح.'));
      const handle = await root.showDirectoryPicker({id:'tameshk-auto-backup', mode:'readwrite'});
      let permission = await handle.requestPermission({mode:'readwrite'});
      if (permission !== 'granted') throw new Error(t('مجوز نوشتن به پوشه داده نشد.', 'Write permission was not granted.', 'لم يتم منح إذن الكتابة.'));
      await handleStore('readwrite', handle);
      directoryHandle = handle;
      st().settings.autoBackupFolderName = handle.name || '';
      persist();
      refreshBackupPanel();
      say(t('پوشهٔ پشتیبان تنظیم شد.', 'Backup folder saved.', 'تم حفظ مجلد النسخ الاحتياطي.'));
      if (isDue()) await root.tameshkBackupNow();
    } catch (error) {
      if (error?.name !== 'AbortError') say(error?.message || t('ذخیرهٔ پوشه ممکن نشد.', 'Could not save the folder.', 'تعذر حفظ المجلد.'));
    }
  };
  root.tameshkBackupNow = async function () {
    try {
      const ok = await folderWrite({allowPicker:true,allowRequest:true});
      if (!ok) {
        say(t('مجوز پوشه در دسترس نیست؛ پوشه را دوباره انتخاب کنید یا فایل پشتیبان را دانلود کنید.', 'Folder permission is unavailable; choose the folder again or download a backup.', 'إذن المجلد غير متاح؛ اختر المجلد مجدداً أو نزّل نسخة احتياطية.'));
        refreshBackupPanel();
        return false;
      }
      say(t('پشتیبان در پوشهٔ انتخاب‌شده ذخیره شد.', 'Backup saved to the selected folder.', 'تم حفظ النسخة في المجلد المحدد.'));
      return true;
    } catch (error) {
      if (error?.name !== 'AbortError') say(error?.message || t('ذخیرهٔ فایل پشتیبان ناموفق بود.', 'Could not write the backup file.', 'تعذر حفظ ملف النسخ الاحتياطي.'));
      return false;
    }
  };
  function renderQuickKeys() {
    const content = root.document?.getElementById('content'), block = content?.querySelector('#quickKeysList');
    if (block) block.innerHTML = shortcutsMarkup();
  }
  function endShortcutCapture() {
    if (!pendingShortcutAction) return;
    const id=pendingShortcutAction; pendingShortcutAction=null;
    const button=root.document?.getElementById(`quick-${id}`);
    button?.classList.remove('is-capturing');
    if(button)button.textContent=shortcutLabel(st()?.settings?.quickKeys?.[id]);
  }
  root.tameshkBeginQuickKeyCapture = function (action) {
    if(!ACTIONS.some(x=>x[0]===action))return;
    if(pendingShortcutAction)endShortcutCapture();
    pendingShortcutAction=action;
    const button=root.document?.getElementById(`quick-${action}`);
    if(button){button.classList.add('is-capturing');button.textContent=t('اکنون Ctrl + Alt + یک رقم یا F2، F3 و F5 تا F10 را بزنید · Esc لغو','Press Ctrl + Alt + a digit or F2, F3, F5–F10 · Esc cancels','اضغط Ctrl + Alt + رقم أو F2, F3, F5–F10 · Esc للإلغاء');button.focus?.()}
  };
  root.tameshkSetQuickKey = function (action, bindingValue) {
    const prefs = st()?.settings, entry = ACTIONS.find(x => x[0] === action), binding=normalizeShortcut(bindingValue);
    if (!prefs || !entry || !binding) { say(t('این میان‌بر پشتیبانی نمی‌شود؛ از Ctrl + Alt + رقم یا F2، F3 و F5 تا F10 استفاده کنید.','That shortcut is not supported. Use Ctrl + Alt + a digit or F2, F3, F5–F10.','هذا الاختصار غير مدعوم. استخدم Ctrl + Alt + رقم أو F2, F3, F5–F10.'));return false; }
    const collision = ACTIONS.find(x => x[0] !== action && shortcutEquivalent(prefs.quickKeys?.[x[0]]) === shortcutEquivalent(binding));
    if (collision) { say(t('این میان‌بر برای بخش دیگری استفاده شده؛ ترکیب دیگری انتخاب کنید.','That shortcut is already assigned to another section. Choose a different one.','هذا الاختصار مخصص لقسم آخر؛ اختر تركيبة مختلفة.'));return false; }
    prefs.quickKeys ||= {...defaultShortcuts};
    prefs.quickKeys[action]=binding;
    endShortcutCapture();
    persist();
    renderQuickKeys();
    return true;
  };
  root.tameshkToggleAutoBackup = function (enabled) {
    const prefs = st()?.settings;
    if (!prefs) return;
    prefs.autoBackupEnabled = !!enabled;
    const days = root.document?.getElementById('autoBackupDays');
    if (days) days.disabled = !enabled;
    persist();
    refreshBackupPanel();
  };
  root.tameshkToggleQuickKeys = function (enabled) {
    const prefs = st()?.settings;
    if (!prefs) return;
    prefs.quickKeysEnabled = !!enabled;
    persist();
    root.document?.getElementById('quickKeysList')?.classList.toggle('is-disabled', !enabled);
  };
  root.document?.addEventListener('keydown', event => {
    if(pendingShortcutAction){
      if(['Control','Alt','Shift','Meta'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      if(event.key==='Escape'){endShortcutCapture();return}
      if(!event.ctrlKey||!event.altKey||event.shiftKey||event.metaKey||event.repeat){say(t('ترکیب باید Ctrl + Alt و یک رقم یا F2، F3 و F5 تا F10 باشد.','Use Ctrl + Alt with one digit or F2, F3, F5–F10.','استخدم Ctrl + Alt مع رقم أو F2, F3, F5–F10.'));return}
      const candidate=normalizeShortcut(`${SHORTCUT_PREFIX}${eventShortcutCode(event)}`);
      if(!candidate){say(t('این کلید مجاز نیست؛ رقم یا یکی از F2، F3 و F5 تا F10 را انتخاب کنید.','That key is not allowed; choose a digit or F2, F3, F5–F10.','هذا المفتاح غير مسموح؛ اختر رقماً أو F2, F3, F5–F10.'));return}
      root.tameshkSetQuickKey(pendingShortcutAction,candidate);
      return;
    }
    const prefs = st()?.settings, action=matchingAction(event,prefs);
    if(!action)return;
    event.preventDefault();event.stopPropagation();
    if(typeof root.go==='function')root.go(action[0]);
  }, true);

  // Validate optional event history before a backup restore can replace current data.
  function validateLedger(value) {
    if (value === undefined) return;
    const fail = () => { throw new Error(t('دفتر رویداد انبار در فایل پشتیبان نامعتبر است.', 'Inventory event ledger in the backup is invalid.', 'سجل أحداث المخزون في النسخة الاحتياطية غير صالح.')); };
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !Array.isArray(value.events) || value.events.length > 100000) return fail();
    if (value.migratedAt !== undefined && !Number.isFinite(Date.parse(value.migratedAt))) return fail();
    const ids = new Set();
    for (const e of value.events) {
      if (!e || typeof e !== 'object' || Array.isArray(e) || !['opening_balance','purchase_receipt','sale','sale_return','stock_adjustment','price_change'].includes(e.type)) return fail();
      if (typeof e.id !== 'string' || !e.id || ids.has(e.id) || typeof e.productId !== 'string' || !e.productId) return fail();
      ids.add(e.id);
      if (!Number.isFinite(e.quantity) || e.quantity < 0 || !Number.isFinite(e.unitCost) || e.unitCost < 0 || !Number.isFinite(e.totalCost) || e.totalCost < 0) return fail();
      if (typeof e.sourceId !== 'string' || typeof e.note !== 'string' || typeof e.estimated !== 'boolean' || !Number.isFinite(Date.parse(e.occurredAt))) return fail();
      if (e.oldPrice !== undefined && (!Number.isFinite(e.oldPrice) || e.oldPrice < 0)) return fail();
      if (e.newPrice !== undefined && (!Number.isFinite(e.newPrice) || e.newPrice < 0)) return fail();
      if (e.direction !== undefined && !['in','out'].includes(e.direction)) return fail();
      if (e.lineIndex !== undefined && (!Number.isInteger(e.lineIndex) || e.lineIndex < 0)) return fail();
      if (e.restocked !== undefined && typeof e.restocked !== 'boolean') return fail();
    }
  }
  if (typeof root.installBackupPayload === 'function' && !root.installBackupPayload.__tameshkDesktopWrapped) {
    const oldInstall = root.installBackupPayload;
    const wrappedInstall = function (raw) {
      const payload = raw?.schema === 'tameshk.backup' ? raw.state : raw;
      validateLedger(payload?.inventoryLedger);
      const result = oldInstall.apply(this, arguments);
      ensurePrefs();
      root.InventoryLedger?.initialize?.();
      persist();
      if (typeof root.render === 'function') root.render();
      return result;
    };
    wrappedInstall.__tameshkDesktopWrapped = true;
    root.installBackupPayload = wrappedInstall;
  }
  if (typeof root.confirmResetDemo === 'function' && !root.confirmResetDemo.__tameshkDesktopWrapped) {
    const oldReset = root.confirmResetDemo;
    const wrappedReset = function () {
      const result = oldReset.apply(this, arguments);
      ensurePrefs();
      root.InventoryLedger?.initialize?.();
      persist();
      if (typeof root.render === 'function') root.render();
      return result;
    };
    wrappedReset.__tameshkDesktopWrapped = true;
    root.confirmResetDemo = wrappedReset;
  }

  function checkDueOnOpen() {
    setTimeout(async () => {
      if (!isDue()) return;
      try {
        let handle = directoryHandle;
        if (!handle) { try { handle = await handleStore('readonly'); } catch (_) {} }
        if (handle && await handle.queryPermission?.({mode:'readwrite'}) === 'granted') {
          directoryHandle = handle;
          const ok = await folderWrite({allowPicker:false,allowRequest:false});
          if (ok) say(t('پشتیبان زمان‌بندی‌شده ذخیره شد.','Scheduled backup saved.','تم حفظ النسخة المجدولة.'));
          else say(t('پشتیبان سررسید شده؛ مجوز پوشه در دسترس نیست. از پنل مدیریت دوباره پوشه را انتخاب کنید.', 'Backup is due; folder permission is unavailable. Re-select the folder in Admin.', 'حان موعد النسخ؛ إذن المجلد غير متاح. أعد اختياره من الإدارة.'));
        } else {
          say(t('پشتیبان سررسید شده؛ برای ذخیرهٔ خودکار پوشه را از پنل مدیریت انتخاب یا مجوز آن را تمدید کنید.', 'Backup is due; choose a folder or renew access in Admin to save automatically.', 'حان موعد النسخ؛ اختر مجلداً أو جدّد الإذن من الإدارة للحفظ تلقائياً.'));
        }
      } catch (error) { say(error?.message || t('ذخیرهٔ خودکار پشتیبان انجام نشد.', 'Automatic backup failed.', 'فشل النسخ الاحتياطي التلقائي.')); }
      refreshBackupPanel();
    }, 350);
  }
  checkDueOnOpen();
  root.TameshkDesktopFeatures = Object.freeze({isDue, refreshBackupPanel, chooseFolder:() => root.tameshkChooseBackupFolder(), backupNow:() => root.tameshkBackupNow(), normalizeShortcut, shortcutLabel, matchingAction, eventShortcutCode, defaultShortcuts:{...defaultShortcuts}});
})(typeof window !== 'undefined' ? window : globalThis);
