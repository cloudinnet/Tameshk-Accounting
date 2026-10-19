/* Arbitrary optional packaging hierarchy for the offline app; quantities are stored in the chosen base unit. */
(function (root) {
  'use strict';
  if (!root || root.TameshkPackagingManager) return;

  const getState = () => typeof state !== 'undefined' ? state : root.state;
  const num = value => Number.isFinite(Number(value)) ? Number(value) : NaN;
  const text = value => String(value == null ? '' : value);
  const esc = value => typeof root.esc === 'function' ? root.esc(text(value)) : text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = message => { if (typeof root.showToast === 'function') root.showToast(message); };
  const persist = () => { try { if (typeof save === 'function') save(); } catch (_) {} };
  const makeId = () => `pkg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

  function normalizePackUnits(product) {
    if (!product || typeof product !== 'object') return [];
    const baseUnit = text(product.baseUnit || product.unit || 'عدد');
    const raw = Array.isArray(product.packUnits) ? product.packUnits : [];
    const seen = new Map([['base', {factor:1, name:baseUnit}]]), usedIds = new Set(['base']), output = [];
    raw.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      let id = typeof item.id === 'string' && item.id && !usedIds.has(item.id) ? item.id : makeId();
      while (usedIds.has(id)) id = makeId();
      let parentId = typeof item.parentId === 'string' && seen.has(item.parentId)
        ? item.parentId
        : item.parentId === undefined ? (output[index-1]?.id || 'base') : 'base';
      const parent = seen.get(parentId) || seen.get('base');
      let qtyInParent = num(item.qtyInParent);
      if (!(qtyInParent > 0)) {
        const legacyBaseQty = num(item.baseQty);
        qtyInParent = legacyBaseQty > 0 ? legacyBaseQty / parent.factor : 1;
      }
      if (!(qtyInParent > 0) || !Number.isFinite(qtyInParent)) return;
      const baseQty = parent.factor * qtyInParent;
      if (!(baseQty > 0) || !Number.isFinite(baseQty)) return;
      const normalized = {...item, id, parentId, qtyInParent, baseQty};
      output.push(normalized);
      seen.set(id, {factor:baseQty, name:text(normalized.name)});
      usedIds.add(id);
    });
    product.packUnits = output;
    product.baseUnit = baseUnit;
    product.unit = baseUnit;
    return output;
  }

  function displayNumber(value) {
    const settings = getState()?.settings || {};
    const locale = settings.language === 'en' ? 'en-GB' : settings.language === 'ar' ? 'ar-SA' : 'fa-IR';
    return new Intl.NumberFormat(locale, {maximumFractionDigits:6}).format(Number(value) || 0);
  }
  function getParentOptions(units, beforeCount, baseUnit, selected) {
    const displayBase=baseUnit==='عدد'?(root.uiLanguage?.()==='en'?'piece':root.uiLanguage?.()==='ar'?'قطعة':baseUnit):baseUnit;const options = [`<option value="base" ${selected==='base'?'selected':''}>${esc(root.uiText?.('واحد پایه')||'واحد پایه')} (${esc(displayBase)})</option>`];
    units.slice(0,beforeCount).forEach(unit => options.push(`<option value="${esc(unit.id)}" ${selected===unit.id?'selected':''}>${esc(unit.name || (root.uiText?.('بستهٔ بدون نام')||'بستهٔ بدون نام'))}</option>`));
    return options.join('');
  }
  function levelRowMarkup(unit, allUnits, index, baseUnit) {
    const id = unit?.id || makeId();
    const parentId = unit?.parentId || (index ? allUnits[index-1]?.id : 'base') || 'base';
    const relation = unit?.qtyInParent ?? '';
    return `<div class="pack-level-row" data-pack-id="${esc(id)}"><div class="pack-level-fields"><div class="field"><label>نام واحد/بسته</label><input class="pack-level-name" maxlength="60" value="${esc(unit?.name||'')}" placeholder="مثلاً پک، بسته، کارتن" oninput="refreshPackagingPreview()"></div><div class="field"><label>واحد بالادست (اختیاری)</label><select class="pack-level-parent" onchange="refreshPackagingPreview()">${getParentOptions(allUnits,index,baseUnit,parentId)}</select></div><div class="field"><label>تعداد در هر واحد بالادست</label><input class="pack-level-ratio" type="number" min="0.000001" step="any" value="${relation===0?'':esc(relation)}" placeholder="مثلاً ۱۲ یا ۰٫۲۵" oninput="refreshPackagingPreview()"></div></div><div class="pack-level-footer"><small class="pack-level-preview">ضریب تبدیل پس از تکمیل نمایش داده می‌شود.</small><div class="toolbar"><button type="button" class="btn small soft" onclick="packagingAddLevel('${esc(id)}')">＋ زیرمجموعه</button><button type="button" class="btn small danger" onclick="packagingRemoveLevel('${esc(id)}')">حذف این سطح</button></div></div></div>`;
  }
  function editorMarkup(product) {
    const units = normalizePackUnits(product);
    const baseUnit = text(product.baseUnit || product.unit || 'عدد');
    return `<section class="panel packaging-editor" id="packagingEditor"><div class="panel-title"><div><h3>واحد پایه و بسته‌بندی دلخواه</h3><small>واحد پایه می‌تواند عدد، برگ، کیلوگرم، متر یا واحد دلخواه باشد. بسته‌ها اختیاری‌اند؛ برای هر واحد می‌توانید زیرواحد اضافه کنید یا نگذارید.</small></div></div><div class="notice packaging-tip">موجودی همیشه برحسب واحد پایه ثبت می‌شود. هر نسبت در مسیر بالادست به پایین‌دست محاسبه می‌شود؛ مثلاً ۱ کارتن = ۲۰ پک و هر پک = ۶ عدد. مقدارهای اعشاری مثل ۰٫۲۵ کیلوگرم نیز پذیرفته می‌شوند.</div><div id="packageLevels">${units.map((u,i)=>levelRowMarkup(u,units,i,baseUnit)).join('')}</div><button type="button" class="btn soft" style="margin-top:10px" onclick="packagingAddLevel('base')">＋ افزودن بستهٔ اصلی</button></section>`;
  }
  function updatePreviews() {
    const editor = root.document?.getElementById('packagingEditor');
    if (!editor) return;
    const base = text(root.document?.getElementById('pUnit')?.value || 'عدد').trim() || 'عدد';
    editor.querySelectorAll('.pack-level-row').forEach(row => {
      const baseLabel = row.querySelector('.pack-level-parent option[value="base"]');
      if (baseLabel) {const displayBase=base==='عدد'?(root.uiLanguage?.()==='en'?'piece':root.uiLanguage?.()==='ar'?'قطعة':base):base;baseLabel.textContent = `${root.uiText?.('واحد پایه')||'واحد پایه'} (${displayBase})`;}
    });
    const factors = new Map([['base',1]]);
    const names = new Map([['base',base]]);
    editor.querySelectorAll('.pack-level-row').forEach(row => {
      const id = row.dataset.packId, parentId = row.querySelector('.pack-level-parent')?.value || 'base';
      const name = text(row.querySelector('.pack-level-name')?.value).trim();
      const ratio = num(row.querySelector('.pack-level-ratio')?.value), parentFactor = factors.get(parentId);
      const preview = row.querySelector('.pack-level-preview');
      if (!name && !text(row.querySelector('.pack-level-ratio')?.value).trim()) {
        if (preview) preview.textContent = root.uiText?.('برای استفاده، نام و ضریب این سطح را وارد کنید.') || 'برای استفاده، نام و ضریب این سطح را وارد کنید.';
        return;
      }
      if (!name || !(ratio > 0) || !Number.isFinite(parentFactor)) {
        if (preview) preview.textContent = root.uiText?.('نام، واحد بالادست و ضریب مثبت را بررسی کنید.') || 'نام، واحد بالادست و ضریب مثبت را بررسی کنید.';
        factors.set(id, NaN);
        return;
      }
      const factor = parentFactor * ratio;
      factors.set(id, factor); names.set(id,name);
      if (preview) { const parentName=names.get(parentId)||base; preview.textContent = root.uiLanguage?.()==='en' ? `1 ${name} = ${displayNumber(factor)} ${base} · per parent unit: ${displayNumber(ratio)} ${parentName}` : root.uiLanguage?.()==='ar' ? `١ ${name} = ${displayNumber(factor)} ${base} · لكل وحدة أم: ${displayNumber(ratio)} ${parentName}` : `۱ ${name} = ${displayNumber(factor)} ${base} · هر واحد بالادست: ${displayNumber(ratio)} ${parentName}`; }
    });
  }
  function addLevel(parentId='base') {
    const box = root.document?.getElementById('packageLevels');
    if (!box) return;
    const rows = [...box.querySelectorAll('.pack-level-row')];
    const unit = text(root.document?.getElementById('pUnit')?.value || 'عدد').trim() || 'عدد';
    const units = rows.map(row => ({id:row.dataset.packId, name:text(row.querySelector('.pack-level-name')?.value).trim()}));
    if (parentId !== 'base' && !units.some(u=>u.id===parentId)) parentId = 'base';
    const id = makeId(), unitData = {id, parentId, qtyInParent:''};
    box.insertAdjacentHTML('beforeend',levelRowMarkup(unitData,units,units.length,unit));
    const last = box.lastElementChild;
    if (last) last.querySelector('.pack-level-parent').value = parentId;
    updatePreviews();
  }
  function removeLevel(id) {
    const box = root.document?.getElementById('packageLevels');
    if (!box) return;
    const rows = [...box.querySelectorAll('.pack-level-row')];
    const parentOf = new Map(rows.map(row=>[row.dataset.packId,row.querySelector('.pack-level-parent')?.value||'base']));
    const remove = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [child,parent] of parentOf) if (remove.has(parent) && !remove.has(child)) { remove.add(child); changed = true; }
    }
    if (remove.size > 1 && typeof root.confirm === 'function' && !root.confirm('این سطح زیرمجموعه دارد؛ با حذف آن، همهٔ زیرمجموعه‌هایش هم حذف می‌شوند. ادامه می‌دهید؟')) return;
    rows.filter(row=>remove.has(row.dataset.packId)).forEach(row=>row.remove());
    updatePreviews();
  }
  function readEditor() {
    const box = root.document?.getElementById('packageLevels');
    const base = text(root.document?.getElementById('pUnit')?.value || 'عدد').trim() || 'عدد';
    const units = [], factors = new Map([['base',1]]), names = new Set([base.toLocaleLowerCase()]);
    if (!box) return {units:[], error:'بخش بسته‌بندی پیدا نشد.'};
    for (const row of box.querySelectorAll('.pack-level-row')) {
      const id = row.dataset.packId, name = text(row.querySelector('.pack-level-name')?.value).trim();
      const rawRatio = text(row.querySelector('.pack-level-ratio')?.value).trim();
      const parentId = row.querySelector('.pack-level-parent')?.value || 'base';
      if (!name && !rawRatio) continue;
      if (!name || !rawRatio) return {error:'برای هر سطح بسته‌بندی، هم نام و هم ضریب را وارد کنید یا هر دو را خالی بگذارید.'};
      const normalizedName = name.toLocaleLowerCase();
      if (names.has(normalizedName)) return {error:`نام واحد یا بستهٔ «${name}» تکراری است.`};
      const ratio = num(rawRatio), parentFactor = factors.get(parentId);
      if (!(ratio > 0) || !Number.isFinite(ratio) || !Number.isFinite(parentFactor)) return {error:`ضریب یا واحد بالادست بستهٔ «${name}» معتبر نیست.`};
      const baseQty = parentFactor * ratio;
      if (!(baseQty > 0) || !Number.isFinite(baseQty)) return {error:`ضریب تبدیل بستهٔ «${name}» بیش از محدودهٔ قابل‌استفاده است.`};
      names.add(normalizedName); factors.set(id,baseQty);
      units.push({id,name,parentId,qtyInParent:ratio,baseQty});
    }
    return {units};
  }

  const css = root.document?.createElement?.('style');
  if (css && root.document.head) {
    css.textContent = `.packaging-editor{grid-column:1/-1;margin-top:12px}.packaging-editor .panel-title h3{margin:0}.packaging-editor .panel-title small{line-height:1.8}.packaging-tip{font-size:11px;line-height:1.8}.pack-level-row{border:1px solid var(--line);border-radius:12px;padding:10px;margin:10px 0;background:var(--card)}.pack-level-fields{display:grid;grid-template-columns:1fr 1fr .8fr;gap:10px}.pack-level-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:5px}.pack-level-footer .toolbar{gap:6px}.pack-level-preview{color:var(--muted);line-height:1.8}@media(max-width:720px){.pack-level-fields{grid-template-columns:1fr}.pack-level-footer{align-items:flex-start;flex-direction:column}}`;
    root.document.head.appendChild(css);
  }

  const s = getState();
  let migrated = false;
  (s?.products || []).forEach(product => {
    const before = JSON.stringify(product.packUnits || []);
    normalizePackUnits(product);
    if (JSON.stringify(product.packUnits) !== before) migrated = true;
  });
  if (migrated) persist();

  if (typeof root.productModal === 'function') {
    const originalProductModal = root.productModal;
    root.productModal = function (id) {
      const result = originalProductModal.apply(this, arguments);
      const inner = root.document?.getElementById('modalInner');
      if (!inner) return result;
      ['pPack1','pPack1Qty','pPack2','pPack2Qty'].forEach(fieldId => {
        const input = root.document.getElementById(fieldId), field = input?.closest?.('.field');
        if (field) { field.style.display = 'none'; input.value = ''; }
      });
      const form = inner.querySelector('.form-grid');
      if (!form || inner.querySelector('#packagingEditor')) return result;
      const product = (getState()?.products || []).find(p=>p.id===id) || {baseUnit:root.document.getElementById('pUnit')?.value || 'عدد',unit:'عدد',packUnits:[]};
      form.insertAdjacentHTML('afterend',editorMarkup(product));
      inner.querySelectorAll('.notice').forEach(notice=>{if(notice.textContent.includes('موجودی همیشه برحسب'))notice.remove();});
      root.document.getElementById('pUnit')?.addEventListener('input',updatePreviews);
      updatePreviews();
      return result;
    };
  }

  if (typeof root.saveProduct === 'function') {
    const originalSaveProduct = root.saveProduct;
    root.saveProduct = function (id) {
      const parsed = readEditor();
      if (parsed.error) { toast(parsed.error); return; }
      const inner = root.document?.getElementById('modalInner');
      if (!inner) return originalSaveProduct.apply(this,arguments);
      const previousIds = new Set((getState()?.products || []).map(p=>p.id));
      const result = originalSaveProduct.apply(this,arguments);
      const modal = root.document?.getElementById('modal');
      if (modal?.classList?.contains('open')) return result;
      const products = getState()?.products || [];
      const product = id ? products.find(p=>p.id===id) : products.find(p=>!previousIds.has(p.id));
      if (!product) return result;
      normalizePackUnits({...product,packUnits:parsed.units});
      product.packUnits = parsed.units;
      persist();
      if (typeof root.render === 'function') root.render();
      return result;
    };
  }

  if (typeof root.installBackupPayload === 'function') {
    const originalInstall = root.installBackupPayload;
    root.installBackupPayload = function (raw) {
      const payload = raw?.schema === 'tameshk.backup' ? raw.state : raw;
      const products = payload?.products;
      if (Array.isArray(products)) for (const product of products) {
        if (!Array.isArray(product?.packUnits)) continue;
        const seen = new Map([['base',1]]), names = new Set([text(product.baseUnit||product.unit||'عدد').toLocaleLowerCase()]);
        for (const unit of product.packUnits) {
          if (!unit || typeof unit.name !== 'string' || !unit.name.trim()) throw new Error('نام یکی از واحدهای بسته‌بندی پشتیبان نامعتبر است.');
          const norm = unit.name.trim().toLocaleLowerCase();
          if (names.has(norm)) throw new Error('نام واحد یا بسته در فایل پشتیبان تکراری است.');
          names.add(norm);
          if (unit.id !== undefined || unit.parentId !== undefined || unit.qtyInParent !== undefined) {
            if (typeof unit.id !== 'string' || !unit.id || seen.has(unit.id) || typeof unit.parentId !== 'string' || !seen.has(unit.parentId) || !(Number.isFinite(unit.qtyInParent) && unit.qtyInParent > 0)) throw new Error('ساختار سلسله‌مراتب بسته‌بندی در پشتیبان نامعتبر است.');
            const expected = seen.get(unit.parentId) * unit.qtyInParent;
            if (!(Number.isFinite(unit.baseQty) && unit.baseQty > 0) || Math.abs(unit.baseQty-expected)>Math.max(1e-8,expected*1e-8)) throw new Error('ضریب تبدیل بسته‌بندی در پشتیبان با سلسله‌مراتب آن سازگار نیست.');
            seen.set(unit.id,unit.baseQty);
          } else {
            const factor = Number(unit.baseQty);
            if (!(Number.isFinite(factor) && factor > 0)) throw new Error('ضریب تبدیل بسته‌بندی در پشتیبان نامعتبر است.');
            seen.set(`legacy_${seen.size}`,factor);
          }
        }
      }
      return originalInstall.apply(this,arguments);
    };
  }

  root.packagingAddLevel = addLevel;
  root.packagingRemoveLevel = removeLevel;
  root.refreshPackagingPreview = updatePreviews;
  root.TameshkPackagingManager = Object.freeze({normalizePackUnits,getOptions:product=>[{name:product.baseUnit||product.unit||'عدد',factor:1},...normalizePackUnits(product).map(x=>({name:x.name,factor:x.baseQty,parentId:x.parentId,qtyInParent:x.qtyInParent}))]});
})(typeof window !== 'undefined' ? window : globalThis);
