/* Portable settings and multi-profile data archives for the offline app. */
(function (root) {
  'use strict';
  if (!root || root.TameshkPortableData) return;

  const CATALOG_KEY = 'tameshk-profiles-v1';
  const LEGACY_KEY = 'tameshk-state';
  const PROFILE_PREFIX = 'tameshk-profile-';
  const MAX_BYTES = 100 * 1024 * 1024;
  const MAX_JSON_NODES = 1000000;
  const MAX_JSON_DEPTH = 100;
  const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
  const STRINGS = {
    title: ['انتقال تنظیمات و داده‌ها', 'Settings and data transfer', 'نقل الإعدادات والبيانات'],
    desc: ['دو نوع فایل مستقل برای پشتیبان‌گیری آفلاین؛ مجوزهای مرورگر و داده‌های نامرتبط صادر نمی‌شوند.', 'Two independent offline backup files. Browser permissions and unrelated browser data are not exported.', 'ملفان مستقلان للنسخ الاحتياطي دون اتصال؛ لا يتم تصدير أذونات المتصفح أو بياناته غير المرتبطة.'],
    settings: ['تنظیمات پروفایل فعال فقط', 'Current profile settings only', 'إعدادات الملف الشخصي الحالي فقط'],
    settingsDesc: ['فقط تنظیمات همین پروفایل صادر یا بازیابی می‌شود.', 'Exports or restores settings for this profile only.', 'يتم تصدير أو استعادة إعدادات هذا الملف الشخصي فقط.'],
    full: ['آرشیو کامل همهٔ پروفایل‌ها و داده‌ها', 'Complete archive of all profiles and data', 'أرشيف كامل لجميع الملفات الشخصية والبيانات'],
    fullDesc: ['شامل همهٔ پروفایل‌ها و داده‌های ذخیره‌شده در برنامه است؛ از جمله تصاویر، کالاها، خدمات، انبارها، تراکنش‌ها، هزینه‌ها، کدها و QRها، دارایی‌ها، چک‌ها، امانات، اعتبارات و اقساط.', 'Includes every saved profile and app data, including images, products, services, warehouses, transactions, expenses, barcodes and QR codes, assets, checks, entrusted items, credit, and installments.', 'يشمل جميع الملفات الشخصية والبيانات المحفوظة، بما في ذلك الصور والمنتجات والخدمات والمستودعات والمعاملات والمصروفات والرموز الشريطية وQR والأصول والشيكات والأمانات والديون والأقساط.'],
    exportSettings: ['⬇ دریافت تنظیمات', '⬇ Export settings', '⬇ تصدير الإعدادات'],
    importSettings: ['⬆ درون‌ریزی تنظیمات', '⬆ Import settings', '⬆ استيراد الإعدادات'],
    exportFull: ['⬇ دریافت آرشیو کامل', '⬇ Export full archive', '⬇ تصدير الأرشيف الكامل'],
    importFull: ['⬆ درون‌ریزی آرشیو کامل', '⬆ Import full archive', '⬆ استيراد الأرشيف الكامل'],
    replaceSettings: ['تنظیمات فعلی این پروفایل با فایل جایگزین می‌شود. ادامه می‌دهید؟', 'The current profile settings will be replaced by this file. Continue?', 'سيتم استبدال إعدادات الملف الحالي بهذا الملف. هل تريد المتابعة؟'],
    replaceAll: ['جایگزینی همهٔ پروفایل‌ها: تمام پروفایل‌ها و داده‌های فعلی حذف و با فایل جایگزین می‌شوند. ادامه می‌دهید؟', 'Replace all profiles: all current profiles and data will be removed and replaced by this file. Continue?', 'استبدال جميع الملفات: ستُحذف الملفات والبيانات الحالية وتُستبدل بهذا الملف. هل تريد المتابعة؟'],
    mergeAsk: ['آرشیو با شناسهٔ پروفایل ادغام می‌شود؛ شناسه‌های مشترک بازنویسی و پروفایل‌های فعلیِ ناموجود در فایل حفظ می‌شوند. ادامه می‌دهید؟', 'Merge by profile ID: matching IDs will be overwritten, and existing profiles not in the file will be kept. Continue?', 'دمج حسب معرّف الملف: ستُستبدل المعرّفات المتطابقة وتُحفظ الملفات الحالية غير الموجودة في الملف. هل تريد المتابعة؟'],
    doneSettings: ['تنظیمات پروفایل بازیابی شد.', 'Profile settings restored.', 'تمت استعادة إعدادات الملف الشخصي.'],
    doneFull: ['آرشیو بازیابی شد؛ برنامه برای بارگذاری دوبارهٔ پروفایل‌ها راه‌اندازی می‌شود.', 'Archive restored; the app will reload to load the profiles.', 'تمت استعادة الأرشيف؛ سيُعاد تحميل التطبيق لقراءة الملفات الشخصية.'],
    badFile: ['فایل پشتیبان معتبر نیست یا ساختار آن پشتیبانی نمی‌شود.', 'The backup file is invalid or has an unsupported structure.', 'ملف النسخ الاحتياطي غير صالح أو بنيته غير مدعومة.'],
    tooLarge: ['حجم فایل از حد مجاز ۱۰۰ مگابایت بیشتر است.', 'The file exceeds the 100 MB size limit.', 'يتجاوز حجم الملف الحد الأقصى البالغ 100 ميغابايت.'],
    unavailable: ['امکان دسترسی به اطلاعات پروفایل‌ها وجود ندارد.', 'Profile data is unavailable.', 'بيانات الملفات الشخصية غير متاحة.'],
    exportFail: ['ساخت فایل پشتیبان ناموفق بود.', 'Could not create the backup file.', 'تعذر إنشاء ملف النسخ الاحتياطي.'],
    importFail: ['بازیابی انجام نشد؛ اطلاعات فعلی تغییری نکرد.', 'Import failed; current data was not changed.', 'فشلت الاستعادة؛ لم يتم تغيير البيانات الحالية.']
  };
  const currentLanguage = () => {
    try { return typeof state !== 'undefined' && state.settings ? state.settings.language : 'fa'; } catch (_) { return 'fa'; }
  };
  const text = key => {
    const row = STRINGS[key] || [key, key, key], lang = currentLanguage();
    return row[lang === 'en' ? 1 : lang === 'ar' ? 2 : 0];
  };
  const esc = value => typeof root.esc === 'function' ? root.esc(String(value == null ? '' : value)) : String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = message => { if (typeof root.showToast === 'function') root.showToast(message); };
  const clone = value => JSON.parse(JSON.stringify(value));
  const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const profileKey = id => PROFILE_PREFIX + id;
  const catalogApi = () => root.TameshkInventoryProfiles || root.TameshkProfiles;
  const saveCurrent = () => { try { if (typeof save === 'function') save(); } catch (e) { throw e; } };
  const persist = () => {
    const api = catalogApi();
    if (!api || typeof api.persistState !== 'function') throw new Error(text('unavailable'));
    api.persistState(state);
  };
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
  function download(name, payload) {
    const contents = JSON.stringify(payload, null, 2);
    const blob = new Blob([contents], { type: 'application/json;charset=utf-8' });
    if (blob.size > MAX_BYTES) throw new Error(text('tooLarge'));
    const url = URL.createObjectURL(blob), link = root.document.createElement('a');
    link.href = url; link.download = name; link.style.display = 'none';
    root.document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function exportSettings() {
    try {
      if (typeof state === 'undefined' || !isRecord(state.settings)) throw new Error(text('unavailable'));
      download('tameshk-settings-' + stamp() + '.json', { schema: 'tameshk.settings', version: 1, exportedAt: new Date().toISOString(), settings: clone(state.settings) });
    } catch (error) { toast(error.message || text('exportFail')); }
  }
  function exportFull() {
    try {
      const api = catalogApi();
      if (!api || typeof api.profileCatalog !== 'function') throw new Error(text('unavailable'));
      persist();
      const catalog = api.profileCatalog();
      if (!isRecord(catalog) || !Array.isArray(catalog.profiles) || !catalog.profiles.length) throw new Error(text('unavailable'));
      const profiles = catalog.profiles.map(meta => {
        if (!meta || !ID_RE.test(String(meta.id || ''))) throw new Error(text('badFile'));
        let data;
        if (meta.id === catalog.activeId) data = clone(state);
        else {
          const raw = root.localStorage.getItem(profileKey(meta.id));
          if (!raw) throw new Error(text('unavailable'));
          data = JSON.parse(raw);
        }
        validateState(data);
        return { id: meta.id, state: data };
      });
      download('tameshk-full-data-' + stamp() + '.json', { schema: 'tameshk.full-data', version: 1, exportedAt: new Date().toISOString(), catalog: clone(catalog), profiles });
    } catch (error) { toast(error.message || text('exportFail')); }
  }

  const ARRAY_FIELDS = ['categories','products','services','warehouses','transactions','expenses','customers','suppliers','barcodeRecords','qrRecords','barcodes','qrCodes','quickCatalog','assets','financials','financialRecords','payments','receipts','journal','invoiceTemplates','templates','consolidatedInvoices','creditRecords','installments','checkbooks','checks','entrustments','inventoryReturns','transactionReturns','expenseReturns','inventoryLots','inventoryEvents','warehouseRecords','assetRecords','debtRecords','loanRecords','installmentRecords','checkRecords','entrustmentRecords'];
  function validateState(value) {
    if (!isRecord(value) || !isRecord(value.settings)) throw new Error(text('badFile'));
    const moneySettings = value.settings;
    if (moneySettings.currency !== undefined && !['IRT', 'SAR', 'USD'].includes(moneySettings.currency)) throw new Error(text('badFile'));
    if (moneySettings.currencyDecimals !== undefined && (typeof moneySettings.currencyDecimals !== 'number' || !Number.isInteger(moneySettings.currencyDecimals) || moneySettings.currencyDecimals < 0 || moneySettings.currencyDecimals > 4)) throw new Error(text('badFile'));
    if (moneySettings.currencyDefaultsPending !== undefined && typeof moneySettings.currencyDefaultsPending !== 'boolean') throw new Error(text('badFile'));
    if(typeof root.validateRecordCurrencies==='function')root.validateRecordCurrencies(value);
    for(const template of value.settings.invoiceTemplates||[]){if(template.producerDefaults!==undefined){if(typeof root.TameshkValidateTemplateDefaults!=='function')throw new Error(text('badFile'));root.TameshkValidateTemplateDefaults(template)}}
    ARRAY_FIELDS.forEach(key => { if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error(text('badFile')); });
    if (value.inventoryLedger !== undefined && (!isRecord(value.inventoryLedger) || !Array.isArray(value.inventoryLedger.events))) throw new Error(text('badFile'));
    if (value.inventoryLedger?.events) value.inventoryLedger.events.forEach(event => { if (!isRecord(event)) throw new Error(text('badFile')); });
    if (value.settings.profileLogo !== undefined && value.settings.profileLogo !== null && typeof value.settings.profileLogo !== 'string') throw new Error(text('badFile'));
    if (value.settings.invoiceImages !== undefined && !isRecord(value.settings.invoiceImages)) throw new Error(text('badFile'));
    try { JSON.stringify(value); } catch (_) { throw new Error(text('badFile')); }
    return value;
  }
  function validateCatalog(catalog) {
    if (!isRecord(catalog) || catalog.version !== 1 || !Array.isArray(catalog.profiles) || !catalog.profiles.length || catalog.profiles.length > 100) throw new Error(text('badFile'));
    const ids = new Set();
    catalog.profiles.forEach(profile => {
      if (!isRecord(profile) || typeof profile.id !== 'string' || !ID_RE.test(profile.id) || ids.has(profile.id) || typeof profile.name !== 'string' || !profile.name.trim()) throw new Error(text('badFile'));
      ids.add(profile.id);
      if (profile.icon !== undefined && typeof profile.icon !== 'string') throw new Error(text('badFile'));
      if (profile.photo !== undefined && profile.photo !== null && typeof profile.photo !== 'string') throw new Error(text('badFile'));
      if (profile.photo) { try { root.TameshkProfilePhotoSecurity.validateProfilePhoto(profile.photo); } catch (_) { throw new Error(text('badFile')); } }
    });
    if (!ids.has(catalog.activeId) || !ids.has(catalog.defaultId)) throw new Error(text('badFile'));
    if (catalog.startupPicker !== undefined && typeof catalog.startupPicker !== 'boolean') throw new Error(text('badFile'));
    return ids;
  }
  function validateFull(payload) {
    if (!isRecord(payload) || payload.schema !== 'tameshk.full-data' || payload.version !== 1) throw new Error(text('badFile'));
    const ids = validateCatalog(payload.catalog);
    if (!Array.isArray(payload.profiles) || payload.profiles.length !== ids.size) throw new Error(text('badFile'));
    const found = new Set();
    payload.profiles.forEach(profile => {
      if (!isRecord(profile) || typeof profile.id !== 'string' || !ids.has(profile.id) || found.has(profile.id)) throw new Error(text('badFile'));
      found.add(profile.id); validateState(profile.state);
    });
    if (found.size !== ids.size) throw new Error(text('badFile'));
    return payload;
  }
  function validateJsonComplexity(value) {
    const pending = [{ value, depth: 0 }];
    let nodes = 0;
    const queue = (child, depth) => {
      if (nodes + pending.length + 1 > MAX_JSON_NODES) throw new Error(text('badFile'));
      pending.push({ value: child, depth });
    };
    while (pending.length) {
      const current = pending.pop(), item = current.value;
      if (++nodes > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH) throw new Error(text('badFile'));
      if (typeof item === 'string' && item.length > MAX_BYTES) throw new Error(text('tooLarge'));
      if (!item || typeof item !== 'object') continue;
      if (Array.isArray(item)) {
        for (let i = item.length - 1; i >= 0; i--) queue(item[i], current.depth + 1);
      } else {
        let count = 0;
        for (const key in item) {
          if (!Object.hasOwn(item, key)) continue;
          if (++count > MAX_JSON_NODES) throw new Error(text('badFile'));
          queue(item[key], current.depth + 1);
        }
      }
    }
    return value;
  }
  function readAndParse(file) {
    if (!file || file.size > MAX_BYTES) return Promise.reject(new Error(text('tooLarge')));
    return file.text().then(raw => {
      if (raw.length > MAX_BYTES) throw new Error(text('tooLarge'));
      let parsed;
      try { parsed = JSON.parse(raw); } catch (_) { throw new Error(text('badFile')); }
      return validateJsonComplexity(parsed);
    });
  }
  function saveSettingsFile(input) {
    const file = input.files && input.files[0]; input.value = '';
    if (!file) return;
    readAndParse(file).then(payload => {
      if (!isRecord(payload) || payload.schema !== 'tameshk.settings' || payload.version !== 1 || !isRecord(payload.settings)) throw new Error(text('badFile'));
      const candidate = { ...clone(state), settings: clone(payload.settings) };
      if (typeof root.validateBackupState === 'function') root.validateBackupState(candidate);
      else validateState(candidate);
      if (!root.confirm(text('replaceSettings'))) return;
      const previous = state.settings;
      try {
        state.settings = clone(payload.settings);
        saveCurrent(); persist();
        if (typeof root.render === 'function') root.render();
        toast(text('doneSettings'));
      } catch (error) {
        state.settings = previous;
        try { saveCurrent(); persist(); } catch (_) {}
        throw error;
      }
    }).catch(error => toast(error.message || text('importFail')));
  }

  function existingCatalog() {
    const api = catalogApi();
    let catalog = api && typeof api.profileCatalog === 'function' ? api.profileCatalog() : null;
    if (!catalog) { try { catalog = JSON.parse(root.localStorage.getItem(CATALOG_KEY) || 'null'); } catch (_) {} }
    if (!catalog || !Array.isArray(catalog.profiles)) throw new Error(text('unavailable'));
    return clone(catalog);
  }
  function makeMerged(payload, merge) {
    const incoming = new Map(payload.profiles.map(item => [item.id, item.state]));
    if (!merge) return { catalog: clone(payload.catalog), states: incoming };
    const current = existingCatalog();
    validateCatalog(current);
    const metas = new Map(current.profiles.map(meta => [meta.id, meta]));
    payload.catalog.profiles.forEach(meta => metas.set(meta.id, clone(meta)));
    const profiles = Array.from(metas.values());
    const catalog = clone(current);
    catalog.profiles = profiles;
    if (incoming.has(payload.catalog.activeId)) catalog.activeId = payload.catalog.activeId;
    if (!profiles.some(meta => meta.id === catalog.activeId)) catalog.activeId = profiles[0].id;
    if (incoming.has(payload.catalog.defaultId) || profiles.some(meta => meta.id === payload.catalog.defaultId)) catalog.defaultId = payload.catalog.defaultId;
    if (!profiles.some(meta => meta.id === catalog.defaultId)) catalog.defaultId = catalog.activeId;
    if (typeof payload.catalog.startupPicker === 'boolean') catalog.startupPicker = payload.catalog.startupPicker;
    return { catalog, states: incoming };
  }
  function writeAll(payload, merge) {
    const output = makeMerged(payload, merge), storage = root.localStorage;
    const desired = new Map();
    desired.set(CATALOG_KEY, JSON.stringify(output.catalog));
    output.states.forEach((data, id) => desired.set(profileKey(id), JSON.stringify(data)));
    let activeState = output.states.get(output.catalog.activeId);
    if (!activeState) {
      const raw = storage.getItem(profileKey(output.catalog.activeId));
      if (!raw) throw new Error(text('badFile'));
      activeState = JSON.parse(raw); validateState(activeState);
    }
    desired.set(LEGACY_KEY, JSON.stringify(activeState));

    const touched = new Set(desired.keys());
    if (!merge) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.indexOf(PROFILE_PREFIX) === 0 && ID_RE.test(key.slice(PROFILE_PREFIX.length))) touched.add(key);
      }
    }
    const previous = new Map();
    touched.forEach(key => previous.set(key, storage.getItem(key)));
    try {
      if (!merge) Array.from(touched).forEach(key => { if (key.indexOf(PROFILE_PREFIX) === 0 && !desired.has(key)) storage.removeItem(key); });
      desired.forEach((value, key) => storage.setItem(key, value));
    } catch (error) {
      touched.forEach(key => {
        if (previous.get(key) === null) { try { storage.removeItem(key); } catch (_) {} }
      });
      touched.forEach(key => {
        const old = previous.get(key);
        if (old !== null) { try { storage.setItem(key, old); } catch (_) {} }
      });
      throw error;
    }
  }
  function fullFile(input) {
    const file = input.files && input.files[0]; input.value = '';
    if (!file) return;
    readAndParse(file).then(payload => {
      validateFull(payload);
      if (root.confirm(text('replaceAll'))) {
        writeAll(payload, false);
      } else if (root.confirm(text('mergeAsk'))) {
        writeAll(payload, true);
      } else return;
      toast(text('doneFull'));
      setTimeout(() => root.location.reload(), 350);
    }).catch(error => toast(error.message || text('importFail')));
  }
  function panelMarkup() {
    return `<section class="panel portable-data-panel settings-block"><div class="panel-title"><div><h2>💾 ${esc(text('title'))}</h2><small>${esc(text('desc'))}</small></div></div><div class="portable-data-grid"><article class="portable-data-card"><h3>${esc(text('settings'))}</h3><p class="muted">${esc(text('settingsDesc'))}</p><div class="toolbar"><button class="btn" type="button" onclick="tameshkExportSettings()">${esc(text('exportSettings'))}</button><label class="btn upload-label" style="cursor:pointer">${esc(text('importSettings'))}<input type="file" accept="application/json,.json" hidden onchange="tameshkImportSettings(this)"></label></div></article><article class="portable-data-card"><h3>${esc(text('full'))}</h3><p class="muted">${esc(text('fullDesc'))}</p><div class="toolbar"><button class="btn" type="button" onclick="tameshkExportFullData()">${esc(text('exportFull'))}</button><label class="btn upload-label" style="cursor:pointer">${esc(text('importFull'))}<input type="file" accept="application/json,.json" hidden onchange="tameshkImportFullData(this)"></label></div></article></div><div class="notice portable-data-note">${esc(text('desc'))}</div></section>`;
  }
  const style = root.document.createElement('style');
  style.textContent = '.portable-data-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.portable-data-card{border:1px solid var(--line,#dce5e8);border-radius:12px;padding:14px;min-width:0}.portable-data-card h3{margin:0 0 7px;font-size:14px}.portable-data-card p{font-size:11px;line-height:1.8;min-height:38px}.portable-data-card .toolbar{gap:8px;flex-wrap:wrap}.portable-data-note{font-size:11px;line-height:1.8}@media(max-width:720px){.portable-data-grid{grid-template-columns:1fr}}';
  if (root.document.head) root.document.head.appendChild(style);
  if (typeof root.settingsPage === 'function') {
    const originalSettings = root.settingsPage;
    if (!originalSettings.__tameshkPortableWrapped) {
      const wrapped = function (target) {
        const result = originalSettings.apply(this, arguments);
        const host = target || root.document.getElementById('content');
        if (host && !host.querySelector('.portable-data-panel')) {
          const panel = root.document.createElement('div'); panel.innerHTML = panelMarkup();
          const section = panel.firstElementChild;
          const dataTab = host.querySelector('[data-settings-panel="data"]');
          const features = host.querySelector('.desktop-features');
          if (dataTab) dataTab.appendChild(section);
          else if (features) features.appendChild(section);
          else host.appendChild(section);
        }
        return result;
      };
      wrapped.__tameshkPortableWrapped = true;
      root.settingsPage = wrapped;
    }
  }
  root.tameshkExportSettings = exportSettings;
  root.tameshkImportSettings = saveSettingsFile;
  root.tameshkExportFullData = exportFull;
  root.tameshkImportFullData = fullFile;
  root.TameshkPortableData = Object.freeze({ exportSettings, exportFull, validateFull, validateJsonComplexity });
})(typeof window !== 'undefined' ? window : globalThis);
