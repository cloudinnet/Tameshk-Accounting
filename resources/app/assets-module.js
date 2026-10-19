/* Tameshk offline assets register: standalone classic-script extension. */
(function () {
  'use strict';
  const types = [
    { id: 'property', icon: '⌂', label: 'Properties / real estate' },
    { id: 'currency', icon: '◉', label: 'Currency & shares' },
    { id: 'bank', icon: '▤', label: 'Bank deposits' },
    { id: 'vehicle', icon: '▰', label: 'Vehicles' },
    { id: 'franchise', icon: '◇', label: 'Franchises / rights' },
    { id: 'other', icon: '◈', label: 'Other' }
  ];
  const dict = {
    'Assets': ['دارایی‌ها', 'Assets', 'الأصول'], 'Asset overview': ['خلاصه و آمار', 'Summary & statistics', 'الملخص والإحصاءات'],
    'Properties / real estate': ['ملک و املاک', 'Properties / real estate', 'العقارات'],
    'Currency & shares': ['ارز و سهام', 'Currency & shares', 'العملات والأسهم'], 'Bank deposits': ['سپرده‌های بانکی', 'Bank deposits', 'الودائع المصرفية'],
    'Vehicles': ['وسایل نقلیه', 'Vehicles', 'المركبات'], 'Franchises / rights': ['امتیازها و حقوق', 'Franchises / rights', 'الامتيازات والحقوق'],
    'Other': ['سایر', 'Other', 'أخرى'], 'Add asset': ['＋ افزودن دارایی', '＋ Add asset', '＋ إضافة أصل'], 'Edit': ['ویرایش', 'Edit', 'تعديل'], 'Delete': ['حذف', 'Delete', 'حذف'],
    'Title': ['عنوان', 'Title', 'العنوان'], 'Date': ['تاریخ', 'Date', 'التاريخ'], 'Actions': ['عملیات', 'Actions', 'الإجراءات'], 'Current value': ['ارزش روز', 'Current value', 'القيمة الحالية'],
    'Details': ['جزئیات', 'Details', 'التفاصيل'], 'Notes': ['یادداشت', 'Notes', 'ملاحظات'], 'Save': ['ذخیره', 'Save', 'حفظ'], 'Cancel': ['انصراف', 'Cancel', 'إلغاء'],
    'Total assets value': ['ارزش کل دارایی‌ها', 'Total assets value', 'إجمالي قيمة الأصول'], 'Asset count': ['تعداد دارایی‌ها', 'Asset count', 'عدد الأصول'],
    'Category breakdown': ['ارزش به تفکیک گروه', 'Category breakdown', 'التوزيع حسب الفئة'], 'No assets in this category yet.': ['هنوز دارایی‌ای در این گروه ثبت نشده است.', 'No assets in this category yet.', 'لا توجد أصول في هذه الفئة بعد.'],
    'No assets recorded yet.': ['هنوز دارایی‌ای ثبت نشده است.', 'No assets recorded yet.', 'لم تُسجل أصول بعد.'], 'Delete this asset?': ['این دارایی حذف شود؟', 'Delete this asset?', 'هل تريد حذف هذا الأصل؟'],
    'Title, date and current value are required.': ['عنوان، تاریخ و ارزش روز الزامی است.', 'Title, date and current value are required.', 'العنوان والتاريخ والقيمة الحالية مطلوبة.'],
    'Asset saved.': ['دارایی ذخیره شد.', 'Asset saved.', 'تم حفظ الأصل.'], 'Asset deleted.': ['دارایی حذف شد.', 'Asset deleted.', 'تم حذف الأصل.'],
    'Currency / instrument': ['ارز / نماد', 'Currency / instrument', 'العملة / الأداة'], 'Currency code': ['واحد پول', 'Currency code', 'رمز العملة'],
    'Quantity / units': ['مقدار / تعداد', 'Quantity / units', 'الكمية / الوحدات'], 'Manual unit price (local currency)': ['قیمت دستی هر واحد (ارز محلی)', 'Manual unit price (local currency)', 'سعر الوحدة اليدوي (بالعملة المحلية)'],
    'Online market prices': ['قیمت آنلاین بازار', 'Online market prices', 'أسعار السوق عبر الإنترنت'],
    'Future option; online prices are disabled. Enter the current local-currency value manually.': ['قابلیت آینده؛ قیمت آنلاین غیرفعال است. ارزش روز را به ارز محلی دستی وارد کنید.', 'Future option; online prices are disabled. Enter the current local-currency value manually.', 'ميزة مستقبلية؛ الأسعار عبر الإنترنت معطلة. أدخل القيمة الحالية بالعملة المحلية يدوياً.'],
    'Property address': ['نشانی ملک', 'Property address', 'عنوان العقار'], 'Area (m²)': ['مساحت (مترمربع)', 'Area (m²)', 'المساحة (م²)'], 'Ownership share (%)': ['سهم مالکیت (٪)', 'Ownership share (%)', 'حصة الملكية (%)'],
    'Bank / institution': ['بانک / مؤسسه', 'Bank / institution', 'البنك / المؤسسة'], 'Deposit type': ['نوع سپرده', 'Deposit type', 'نوع الوديعة'], 'Interest rate (%)': ['نرخ سود (٪)', 'Interest rate (%)', 'معدل الفائدة (%)'], 'Maturity date': ['تاریخ سررسید', 'Maturity date', 'تاريخ الاستحقاق'],
    'Make': ['سازنده', 'Make', 'الشركة المصنعة'], 'Model': ['مدل', 'Model', 'الطراز'], 'Year': ['سال', 'Year', 'السنة'], 'Registration / plate': ['شماره پلاک', 'Registration / plate', 'رقم التسجيل / اللوحة'],
    'Provider / grantor': ['ارائه‌دهنده / واگذارکننده', 'Provider / grantor', 'المزود / المانح'], 'Contract start': ['شروع قرارداد', 'Contract start', 'بداية العقد'], 'Contract end': ['پایان قرارداد', 'Contract end', 'نهاية العقد'],
    'Asset type / description': ['نوع دارایی / شرح', 'Asset type / description', 'نوع الأصل / الوصف'], 'Asset date': ['تاریخ دارایی', 'Asset date', 'تاريخ الأصل'],
    'Toman': ['تومان', 'Toman', 'تومان'], 'assets': ['دارایی', 'assets', 'أصل']
  };
  function langIndex() { const l = state?.settings?.language; return l === 'en' ? 1 : l === 'ar' ? 2 : 0; }
  function tr(key) { return dict[key]?.[langIndex()] || dict[key]?.[0] || key; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function id() { return 'asset-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function list() { if (!Array.isArray(state.assets)) state.assets = []; return state.assets; }
  const detailFields = {
    property: [['address', 'Property address', 'text'], ['area', 'Area (m²)', 'number'], ['ownership', 'Ownership share (%)', 'number']],
    currency: [['instrument', 'Currency / instrument', 'text'], ['currencyCode', 'Currency code', 'text'], ['quantity', 'Quantity / units', 'number'], ['manualUnitPrice', 'Manual unit price (local currency)', 'number']],
    bank: [['institution', 'Bank / institution', 'text'], ['depositType', 'Deposit type', 'text'], ['interestRate', 'Interest rate (%)', 'number'], ['maturityDate', 'Maturity date', 'date']],
    vehicle: [['make', 'Make', 'text'], ['model', 'Model', 'text'], ['year', 'Year', 'number'], ['plate', 'Registration / plate', 'text']],
    franchise: [['provider', 'Provider / grantor', 'text'], ['contractStart', 'Contract start', 'date'], ['contractEnd', 'Contract end', 'date']],
    other: [['assetKind', 'Asset type / description', 'text']]
  };
  const tabKeys = [{ id: 'summary', label: 'Asset overview', icon: '▥' }, ...types];
  let activeTab = 'summary';

  // Extend existing mutable dictionaries and keep this entry in the inventory/alerts neighborhood.
  titles.assets = 'دارایی‌ها';
  menuLabels.assets = 'دارایی‌ها';
  function ensureNav() {
    const nav = document.getElementById('nav'); if (!nav) return;
    let button = nav.querySelector('[data-page="assets"]');
    if (!button) {
      button = document.createElement('button'); button.dataset.page = 'assets'; button.innerHTML = '<span class="ico">◈</span><span class="assets-nav-label"></span>';
      nav.insertBefore(button, nav.querySelector('[data-page="alerts"]') || null);
    }
    const label = button.querySelector('.assets-nav-label'); if (label) label.textContent = tr('Assets');
  }
  const priorApplyMenuOrder = applyMenuOrder;
  applyMenuOrder = function () {
    priorApplyMenuOrder(); ensureNav();
    const nav = document.getElementById('nav'), assetButton = nav?.querySelector('[data-page="assets"]');
    if (nav && assetButton) nav.insertBefore(assetButton, nav.querySelector('[data-page="alerts"]') || null);
  };
  const priorRender = render;
  render = function () {
    priorRender();
    ensureNav();
    const navLabel = document.querySelector('.assets-nav-label'); if (navLabel) navLabel.textContent = tr('Assets');
    if (currentPage === 'assets') renderAssets();
  };
  ensureNav();

  function typeLabel(type) { return tr(types.find(x => x.id === type)?.label || 'Other'); }
  function displayMoney(value,record) {return window.TameshkCurrency?window.TameshkCurrency.amount(value,record):new Intl.NumberFormat(undefined).format(Number(value)||0)}
  function currencyGroups(records){const groups=new Map();for(const r of records){const key=JSON.stringify([r.currency??null,r.currencyDecimals??null]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}return [...groups.values()]}
  function totalsText(records){return currencyGroups(records).map(rows=>displayMoney(rows.reduce((sum,a)=>sum+(Number(a.currentValue)||0),0),rows[0])).join(' · ')||displayMoney(0)}
  function renderAssets() {
    const content = document.getElementById('content'); if (!content) return;
    const records = list(), filtered = activeTab === 'summary' ? records : records.filter(a => a.type === activeTab);
    document.getElementById('crumb').textContent = tr('Assets');
    const labels = tabKeys.map(tab => `<button type="button" class="am-tab ${activeTab === tab.id ? 'active' : ''}" role="tab" aria-selected="${activeTab === tab.id}" onclick="window.TameshkAssets.setTab('${tab.id}')"><span aria-hidden="true">${tab.icon}</span> ${esc(tr(tab.label))}</button>`).join('');
    const total = records.reduce((sum, a) => sum + (Number(a.currentValue) || 0), 0);
    const chart = currencyGroups(records).map(rows=>`<section><b>${esc(window.TameshkCurrency?.symbol(rows[0])||'—')}</b>${categoryChart(rows,rows.reduce((sum,a)=>sum+(Number(a.currentValue)||0),0))}</section>`).join('');
    content.innerHTML = `<section class="am-shell" aria-label="${esc(tr('Assets'))}">
      <div class="page-head"><div><h1>${esc(tr('Assets'))}</h1><p>${esc(tr('Asset overview'))}</p></div><button class="btn primary" type="button" onclick="window.TameshkAssets.openForm()">${esc(tr('Add asset'))}</button></div>
      <div class="am-tabs" role="tablist" aria-label="${esc(tr('Assets'))}">${labels}</div>
      ${activeTab === 'summary' ? summaryMarkup(records, total, chart) : `<section class="panel"><div class="am-listhead"><h2>${esc(typeLabel(activeTab))}</h2><span class="muted">${records.filter(a => a.type === activeTab).length} ${esc(tr('assets'))}</span></div>${assetTable(filtered)}</section>`}
    </section>`;
  }
  function summaryMarkup(records, total, chart) {
    const grouped = types.map(t => ({ ...t, assets: records.filter(a => a.type === t.id) })).filter(x => x.assets.length);
    return `<div class="grid stats am-stats"><div class="stat"><div class="label">${esc(tr('Total assets value'))}</div><div class="value">${esc(totalsText(records))}</div></div><div class="stat"><div class="label">${esc(tr('Asset count'))}</div><div class="value">${records.length}</div></div></div>
      <div class="grid split am-summary"><section class="panel"><div class="panel-title"><h2>${esc(tr('Category breakdown'))}</h2></div>${chart}${grouped.length ? `<div class="am-breakdown">${grouped.map(g => `<div class="am-break-row"><span>${esc(typeLabel(g.id))} <small>${g.assets.length}</small></span><b>${esc(totalsText(g.assets))}</b></div>`).join('')}</div>` : `<div class="empty">${esc(tr('No assets recorded yet.'))}</div>`}</section><section class="panel"><div class="panel-title"><h2>${esc(tr('Asset overview'))}</h2></div>${assetTable(records.slice(0,5), true)}</section></div>`;
  }
  function categoryChart(records, total) {
    const values = types.map(t => ({ ...t, value: records.filter(a => a.type === t.id).reduce((s,a)=>s+(Number(a.currentValue)||0),0) }));
    if (!total) return '<div class="am-chart-empty" aria-label="No chart data">—</div>';
    const colors = ['#16897e','#e9ac5b','#6982b5','#bd6c78','#55a3bf','#8a74ad'];
    let offset = 0;
    const slices = values.map((x,i) => { const pct = x.value / total * 100, circumference = 2 * Math.PI * 44, dash = (pct / 100 * circumference) + ' ' + (circumference - pct / 100 * circumference), part = `<circle cx="60" cy="60" r="44" fill="none" stroke="${colors[i]}" stroke-width="18" stroke-dasharray="${dash}" stroke-dashoffset="${-(offset / 100 * circumference)}" transform="rotate(-90 60 60)"/>`; offset += pct; return part; }).join('');
    return `<div class="am-chart-wrap"><svg class="am-donut" viewBox="0 0 120 120" role="img" aria-label="${esc(tr('Category breakdown'))}"><circle cx="60" cy="60" r="44" fill="none" stroke="#eef2f3" stroke-width="18"/>${slices}<text x="60" y="57" text-anchor="middle" class="am-chart-number">${records.length}</text><text x="60" y="72" text-anchor="middle" class="am-chart-label">${esc(tr('Asset count'))}</text></svg><div class="am-legend">${values.filter(v=>v.value>0).map((v)=>`<div><i style="background:${colors[values.indexOf(v)]}"></i>${esc(typeLabel(v.id))}</div>`).join('')}</div></div>`;
  }
  function assetTable(rows, compact) {
    if (!rows.length) return `<div class="empty">${esc(tr(activeTab === 'summary' ? 'No assets recorded yet.' : 'No assets in this category yet.'))}</div>`;
    const pageSize = activeTab === 'franchise' || activeTab === 'other' ? 15 : 10;
    const pager = !compact && activeTab !== 'summary' ? `data-tp-key="asset-${activeTab}" data-tp-size="${pageSize}"` : '';
    return `<div class="table-wrap" ${pager}><table class="am-table"><thead><tr><th>${esc(tr('Title'))}</th><th>${esc(tr('Details'))}</th><th>${esc(tr('Date'))}</th><th>${esc(tr('Current value'))}</th><th>${esc(tr('Actions'))}</th></tr></thead><tbody>${rows.map(a=>`<tr><td><b>${esc(a.title)}</b><small class="am-type">${esc(typeLabel(a.type))}</small></td><td>${esc(detailSummary(a))}</td><td>${esc(a.date || '—')}</td><td class="money">${esc(displayMoney(a.currentValue,a))}</td><td><div class="toolbar"><button class="btn small" type="button" data-asset-edit="${esc(a.id)}" aria-label="${esc(tr('Edit'))}: ${esc(a.title)}">${esc(tr('Edit'))}</button><button class="btn small danger" type="button" data-asset-delete="${esc(a.id)}" aria-label="${esc(tr('Delete'))}: ${esc(a.title)}">${esc(tr('Delete'))}</button></div></td></tr>`).join('')}</tbody></table></div>`;
  }
  const detailLabelByKey = Object.fromEntries(Object.entries(detailFields).flatMap(([type,fields])=>fields.map(f=>[f[0],f[1]])));
  function detailSummary(asset) { const vals = Object.entries(asset.details || {}).filter(([,v])=>v!==''&&v!=null).slice(0,3).map(([k,v])=>`${tr(detailLabelByKey[k]||k)}: ${k==='manualUnitPrice'?displayMoney(v,asset):v}`); return vals.length ? vals.join(' · ') : '—'; }
  function fieldMarkup(field, value) {
    const [name, label, type] = field, full = name === 'address' || name === 'instrument';
    return `<div class="field ${full?'am-wide':''}"><label for="am-${name}">${esc(tr(label))}</label><input id="am-${name}" name="${esc(name)}" type="${type}" ${type === 'number' ? 'min="0" step="any"' : ''} value="${esc(value ?? '')}"></div>`;
  }
  function openForm(assetId) {
    const old = assetId ? list().find(a=>a.id===assetId) : null;
    let type = old?.type || activeTab;
    if (type === 'summary') type = 'other';
    const options = types.map(t=>`<option value="${t.id}" ${type===t.id?'selected':''}>${esc(typeLabel(t.id))}</option>`).join('');
    const currentFields = detailFields[type] || detailFields.other;
    const details = old?.details || {};
    const html = `<div class="modal-head"><h2>${esc(old ? tr('Edit') : tr('Add asset'))}</h2><button type="button" class="close" aria-label="${esc(tr('Cancel'))}" onclick="closeModal()">×</button></div><form id="am-form" onsubmit="return window.TameshkAssets.submit(event,'${esc(old?.id || '')}')"><div class="form-grid am-form-grid"><div class="field"><label for="am-title">${esc(tr('Title'))} *</label><input id="am-title" name="title" required maxlength="160" value="${esc(old?.title || '')}"></div><div class="field"><label for="am-type">${esc(tr('Details'))}</label><select id="am-type" name="type" onchange="window.TameshkAssets.changeType(this.value)">${options}</select></div><div class="field"><label for="am-date">${esc(tr('Date'))} *</label><input id="am-date" name="date" type="date" required value="${esc(old?.date || new Date().toISOString().slice(0,10))}"></div><div class="field"><label for="am-value">${esc(tr('Current value'))} (${esc(window.TameshkCurrency?.symbol(old||undefined)||'—')}) *</label><input id="am-value" name="currentValue" type="number" min="0" step="${window.TameshkCurrency?.inputStep(old||undefined)||'any'}" required value="${esc(old?.currentValue ?? '')}"></div><div id="am-type-fields" class="am-type-fields">${currentFields.map(f=>fieldMarkup(f,details[f[0]])).join('')}</div><div class="field am-wide"><label for="am-notes">${esc(tr('Notes'))}</label><textarea id="am-notes" name="notes" maxlength="2000">${esc(old?.notes || '')}</textarea></div></div>${type==='currency'?`<fieldset class="am-future"><legend>${esc(tr('Online market prices'))}</legend><label><input type="checkbox" disabled aria-disabled="true"> ${esc(tr('Online market prices'))}</label><p>${esc(tr('Future option; online prices are disabled. Enter the current local-currency value manually.'))}</p></fieldset>`:''}<div class="toolbar am-actions"><button class="btn" type="button" onclick="closeModal()">${esc(tr('Cancel'))}</button><button class="btn primary" type="submit">${esc(tr('Save'))}</button></div></form>`;
    openModal(html);
  }
  function changeType(type) { const target = document.getElementById('am-type-fields'); if (!target) return; target.innerHTML = (detailFields[type] || detailFields.other).map(f=>fieldMarkup(f, '')).join(''); const form=document.getElementById('am-form'); const fieldset=document.querySelector('.am-future'); if(type==='currency'&&!fieldset){const n=document.createElement('fieldset');n.className='am-future';n.innerHTML=`<legend>${esc(tr('Online market prices'))}</legend><label><input type="checkbox" disabled aria-disabled="true"> ${esc(tr('Online market prices'))}</label><p>${esc(tr('Future option; online prices are disabled. Enter the current local-currency value manually.'))}</p>`;form.querySelector('.am-actions').before(n)}else if(type!=='currency')fieldset?.remove(); }
  function submit(event, assetId) {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
    const title=String(data.get('title')||'').trim(), date=String(data.get('date')||''), value=Number(data.get('currentValue'));
    if(!title || !date || !Number.isFinite(value) || value < 0) { showToast(tr('Title, date and current value are required.')); return false; }
    const type=types.some(t=>t.id===data.get('type'))?data.get('type'):'other';
    const details={}; for(const [key] of detailFields[type]) details[key]=String(data.get(key)||'').trim();
    const existing=assetId?list().find(a=>a.id===assetId):null;
    const record={...(existing||{}), id:existing?.id||id(), type, title, date, currentValue:value, details, notes:String(data.get('notes')||'').trim(), updatedAt:new Date().toISOString()};
    if(!existing)window.TameshkCurrency?.snapshot(record);
    if(existing) Object.assign(existing,record); else list().push(record);
    save(); closeModal(); render(); showToast(tr('Asset saved.')); return false;
  }
  function remove(assetId) {
    const record=list().find(a=>a.id===assetId); if(!record)return;
    if(!window.confirm(tr('Delete this asset?'))) return;
    state.assets=list().filter(a=>a.id!==assetId); save(); render(); showToast(tr('Asset deleted.'));
  }
  function setTab(id) { if(!tabKeys.some(t=>t.id===id)) return; activeTab=id; renderAssets(); }
  document.addEventListener('click', event => {
    const edit = event.target.closest?.('[data-asset-edit]'), del = event.target.closest?.('[data-asset-delete]');
    if (edit) openForm(edit.getAttribute('data-asset-edit'));
    else if (del) remove(del.getAttribute('data-asset-delete'));
  });
  window.TameshkAssets = { openForm, submit, remove, setTab, changeType };

  const css = document.createElement('style');
  css.textContent = `.am-shell{--am-accent:var(--teal,#147d77)}.am-tabs{display:flex;gap:7px;overflow-x:auto;padding:2px 0 14px;margin-bottom:5px}.am-tab{border:1px solid var(--line);background:#fff;color:var(--ink);padding:8px 12px;border-radius:11px;white-space:nowrap;font-weight:600;font-size:12px}.am-tab.active{background:var(--teal2);border-color:transparent;color:var(--teal)}.am-tab:focus-visible,.am-shell button:focus-visible,.am-shell input:focus-visible,.am-shell select:focus-visible,.am-shell textarea:focus-visible{outline:3px solid #147d7755;outline-offset:2px}.am-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.am-summary{grid-template-columns:1.2fr 1fr}.am-listhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.am-listhead h2{font-size:15px;margin:0}.am-type{display:block;color:var(--muted);font-size:10px}.am-table{white-space:normal;min-width:720px}.am-chart-wrap{display:flex;align-items:center;gap:22px;min-height:200px}.am-donut{width:min(180px,42%);overflow:visible;flex:0 0 auto}.am-chart-number{font-size:19px;font-weight:800;fill:var(--ink)}.am-chart-label{font-size:6px;fill:var(--muted)}.am-legend{display:grid;gap:7px;font-size:11px;color:var(--muted)}.am-legend>div{display:flex;align-items:center;gap:7px}.am-legend i{width:10px;height:10px;border-radius:3px}.am-chart-empty{height:180px;display:grid;place-items:center;color:var(--muted)}.am-breakdown{display:grid;gap:8px;margin-top:15px}.am-break-row{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding-top:8px;font-size:11px}.am-break-row small{color:var(--muted);margin-inline-start:6px}.am-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.am-type-fields{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.am-wide{grid-column:1/-1}.am-future{border:1px dashed var(--line);border-radius:11px;padding:10px 13px;margin:6px 0 14px}.am-future legend{font-size:11px;font-weight:700}.am-future label{font-size:12px;color:var(--muted)}.am-future p{font-size:11px;color:var(--muted);margin:4px 0 0}.am-actions{justify-content:flex-end;margin-top:12px}@media(max-width:720px){.am-summary{grid-template-columns:1fr}.am-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.am-chart-wrap{justify-content:center}.am-type-fields{grid-template-columns:1fr}.am-form-grid{grid-template-columns:1fr}.am-wide{grid-column:1}.am-type-fields{grid-column:1}}@media(max-width:460px){.am-tabs{margin-inline:-5px}.am-tab{padding:7px 9px}}`;
  document.head.appendChild(css);
}());
