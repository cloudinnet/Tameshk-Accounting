/* Organizes management controls into dedicated settings tabs and adds a quick language switch. */
(function(root){
'use strict';
if(!root||typeof root.settingsPage!=='function'||root.TameshkSettingsTabs)return;
const original=root.settingsPage;
let activeTab='invoice';
const tabs=[
 ['invoice','فاکتور و ثبت','🧾'],['categories','دسته‌ها و بارکد','▦'],
 ['data','پشتیبان و امکانات','💾'],['appearance','تم و چیدمان','🎨'],
 ['defaults','پیش‌فرض‌ها و قابلیت‌های اختیاری','⚙️'],['dates','تاریخ‌ها','📅'],['alerts','هشدارها','🔔']
];
function addLanguageQuickSwitch(){
 const host=root.document.querySelector('.top-right');if(!host||root.document.getElementById('quickLanguageSwitch'))return;
 const wrap=root.document.createElement('div');wrap.id='quickLanguageSwitch';wrap.className='quick-language-wrap';
 wrap.innerHTML='<button type="button" id="quickLanguageButton" class="btn small quick-language-button" aria-label="زبان رابط کاربری" title="زبان رابط کاربری">🌐</button><div id="quickLanguageMenu" class="quick-language-menu" hidden><button type="button" data-lang="en">English</button><button type="button" data-lang="fa">پارسی</button><button type="button" data-lang="ar">العربية</button></div>';
 host.insertBefore(wrap,root.document.querySelector('.avatar'));root.updateLanguageOptionLabels?.();
 wrap.querySelector('#quickLanguageButton').addEventListener('click',()=>{const menu=wrap.querySelector('#quickLanguageMenu');menu.hidden=!menu.hidden});
 wrap.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{const lang=b.dataset.lang,apply=()=>root.setUiLanguage?.(lang);wrap.querySelector('#quickLanguageMenu').hidden=true;if(inSettings&&hasUnsavedSettings())leaveDialog('settings',apply);else apply()}));
 root.document.addEventListener('click',e=>{if(!wrap.contains(e.target))wrap.querySelector('#quickLanguageMenu').hidden=true});
}
root.settingsPage=function(el){
 original.call(root,el);
 const head=el.querySelector('.page-head'),grid=el.querySelector('.settings-grid'),theme=el.querySelector('.theme-card');
 if(!head||!grid||!theme)return;
 const blocks=[...grid.children],extras=[...el.children].filter(x=>x!==head&&x!==grid&&x!==theme);
 const nav=root.document.createElement('div'),panels=root.document.createElement('div'),groups={};
 nav.className='settings-tabs';nav.setAttribute('role','tablist');panels.className='settings-tab-panels';
 for(const [id,title,icon] of tabs){
  const button=root.document.createElement('button');button.type='button';button.className='settings-tab';button.dataset.settingsTab=id;button.setAttribute('role','tab');button.innerHTML=`<span>${icon}</span>${title}`;nav.appendChild(button);
  const panel=root.document.createElement('section');panel.className='settings-tab-panel';panel.dataset.settingsPanel=id;panels.appendChild(panel);groups[id]=panel;
 }
 const addGrid=(id,items)=>{if(!items.length)return;const g=root.document.createElement('div');g.className='grid settings-grid';items.forEach(x=>g.appendChild(x));groups[id].appendChild(g)};
 function ensureDateControlsInDates(host){
  const datePanel=host?.querySelector?.('[data-settings-panel="dates"]');if(!datePanel)return;
  const fields=['dateMode','transactionCalendar'].map(id=>host.querySelector(`#${id}`)?.closest('.field')).filter(Boolean);
  if(!fields.length)return;
  let dateGroup=datePanel.querySelector('.settings-date-fields');
  if(!dateGroup){dateGroup=root.document.createElement('div');dateGroup.className='form-grid settings-date-fields';const report=datePanel.querySelector('#reportCalendarDefaultSelect')?.closest('.panel');datePanel.insertBefore(dateGroup,report||null)}
  for(const field of fields)dateGroup.appendChild(field);
  const report=datePanel.querySelector('#reportCalendarDefaultSelect')?.closest('.panel');if(report&&dateGroup.parentElement===datePanel)datePanel.insertBefore(dateGroup,report);
 }
 const picked=new Set(),byId=id=>blocks.find(x=>x.querySelector?.(`#${id}`));
 const language=byId('uiLanguageSelect'),business=byId('business'),category=blocks.find(x=>x.querySelector?.('#categoryList')||/دسته‌بندی خدمات و کالا/.test(x.textContent||'')),backup=blocks.find(x=>x.querySelector?.('#backupBtn')||x.querySelector?.('#restoreInput')||x.querySelector?.('#restoreSettings')||/پشتیبان‌گیری و داده‌ها/.test(x.textContent||'')),tax=blocks.find(x=>/مالیات و ظاهر/.test(x.textContent||''));
 [language,business,category,backup,tax].filter(Boolean).forEach(x=>picked.add(x));
 addGrid('invoice',[business,tax].filter(Boolean));
 if(category)groups.categories.appendChild(category);
 if(backup)groups.data.appendChild(backup);
 groups.appearance.appendChild(theme);
 // Seller defaults are rendered by the profile module, but now belong to management defaults.
 const sellerMarkup=root.TameshkProfiles?.sellerDefaultsMarkup?.();
 if(sellerMarkup)groups.defaults.insertAdjacentHTML('beforeend',sellerMarkup);
 for(const x of blocks)if(!picked.has(x))groups.data.appendChild(x);
 for(const extra of extras){
  const txt=(extra.textContent||'').slice(0,1200);
  if(extra.classList?.contains('template-manager'))groups.invoice.appendChild(extra);
  else if(extra.querySelector?.('#quickKeysEnabled')||extra.querySelector?.('#autoBackupEnabled'))groups.data.appendChild(extra);
  else if(/هشدار انقضا|پیش‌فرض هشدار/.test(txt))groups.alerts.appendChild(extra);
  else if(/پروفایل کسب‌وکار|پروفایل و هشدار/.test(txt))extra.remove();
  else groups.data.appendChild(extra);
 }
 const activate=id=>{activeTab=groups[id]?id:'invoice';nav.querySelectorAll('.settings-tab').forEach(b=>{const on=b.dataset.settingsTab===activeTab;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false')});panels.querySelectorAll('[data-settings-panel]').forEach(p=>p.hidden=p.dataset.settingsPanel!==activeTab)};
 nav.addEventListener('click',event=>{const button=event.target.closest('[data-settings-tab]');if(button)activate(button.dataset.settingsTab)});
 nav.querySelectorAll('.settings-tab').forEach(b=>{const title=tabs.find(t=>t[0]===b.dataset.settingsTab)?.[1]||'';b.textContent=`${b.querySelector('span')?.textContent||''} ${root.uiText?.(title)||title}`});
 el.replaceChildren(head,nav,panels);activate(activeTab);addLanguageQuickSwitch();
 // Keep persisted select values visible; native selects otherwise show their first option after rerender.
 const setValue=(id,value)=>{const node=el.querySelector(`#${id}`);if(node&&value!=null&&[...node.options].some(o=>o.value===String(value)||o.text===String(value)))node.value=String(value)};
 setValue('dateMode',state?.settings?.dateMode||'شمسی');setValue('transactionCalendar',state?.settings?.transactionCalendar||'شمسی');setValue('template',state?.settings?.invoiceTemplate||'کلاسیک');setValue('zoom',state?.settings?.zoom||1);setValue('reportCalendarDefaultSelect',state?.settings?.reportCalendar||'شمسی');
 const langSelect=el.querySelector('#uiLanguageSelect');if(langSelect)langSelect.value=root.uiLanguage?.()||state?.settings?.language||'fa';
 // Later settings wrappers append their panels after this renderer; normalize once the full wrapper chain has returned too.
 ensureDateControlsInDates(el);root.setTimeout?.(()=>ensureDateControlsInDates(el),0);
};
const style=root.document.createElement('style');style.id='tameshkSettingsTabStyles';style.textContent=`.settings-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 15px;padding:7px;background:#edf3f4;border-radius:13px}.settings-tab{border:0;border-radius:10px;padding:9px 15px;background:transparent;color:var(--ink);font-weight:700;display:flex;align-items:center;gap:8px}.settings-tab.active{background:#fff;color:var(--teal);box-shadow:0 2px 10px #19394a12}.settings-tab-panels{min-width:0}.settings-tab-panel[hidden]{display:none!important}.settings-tab-panel>.settings-grid{margin:0}.settings-tab-panel>.panel{margin:0 0 14px}.settings-tab-panel>.theme-card{margin-top:0}.settings-date-fields{margin:0 0 14px}.settings-date-fields>.field{min-width:0}.quick-language-wrap{position:relative;display:inline-flex}.quick-language-button{min-width:38px;padding:6px}.quick-language-menu{position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:120;min-width:132px;padding:5px;background:var(--card,#fff);border:1px solid var(--line,#dce5e8);border-radius:10px;box-shadow:0 8px 24px #132b3b25}.quick-language-menu[hidden]{display:none}.quick-language-menu button{display:block;width:100%;border:0;background:transparent;text-align:start;padding:8px;border-radius:7px;cursor:pointer;color:var(--ink)}.quick-language-menu button:hover{background:var(--bg,#f2f6f6)}@media(max-width:720px){.settings-tab{flex:1 1 40%;justify-content:center;padding:8px 9px}}`;root.document.head.appendChild(style);
 if(root.render){const old=root.render;root.render=function(...args){const result=old.apply(this,args);addLanguageQuickSwitch();return result}}
 const dirtyCategories=new Set();let inSettings=false,originalGo=null,pendingSettingsAction=null;
 function hasUnsavedSettings(){return dirtyCategories.size>0}
 function categoryForTarget(target){if(target?.closest?.('#currencySettingsPanel'))return 'currency';if(target?.closest?.('#featureVisibilityPanel'))return 'features';if(target?.closest?.('#defaultExpiryWarningDays,#expiryAlertsEnabled'))return 'expiry';return 'general'}
 root.TameshkSettingsDirty=Object.freeze({markDirty(category='general'){dirtyCategories.add(category)},markSaved(category){dirtyCategories.delete(category)},hasUnsaved:hasUnsavedSettings});
 function persistVisibleSettings(){
  const get=id=>root.document.getElementById(id),number=(id,fallback)=>{const x=Number(get(id)?.value);return Number.isFinite(x)?x:fallback};
  const s=state.settings;
  if(get('currencyChoice')&&root.TameshkCurrency&&!root.TameshkCurrency.setConfig(get('currencyChoice').value,Number(get('currencyDecimalsChoice')?.value)))return false;
  if(get('business'))s.business=get('business').value.trim();
  if(get('template'))s.invoiceTemplate=get('template').value;
  if(get('dateMode'))s.dateMode=get('dateMode').value;
  if(get('transactionCalendar'))s.transactionCalendar=get('transactionCalendar').value;
  if(get('invoiceNote'))s.invoiceNote=get('invoiceNote').value;
  if(get('taxDefault'))s.taxDefault=get('taxDefault').checked;
  if(get('taxPercent'))s.taxPercent=number('taxPercent',s.taxPercent||0);
  if(get('zoom'))s.zoom=number('zoom',s.zoom||1);
  const t=(s.themes||[]).find(x=>x.id===s.activeThemeId);
  if(t){
   if(get('themeName'))t.name=get('themeName').value.trim()||t.name;
   for(const [id,key] of [['colorAccent','accent'],['colorSidebar','sidebar'],['colorBackground','background'],['colorCard','card'],['colorText','text']])if(get(id))t.colors[key]=get(id).value;
   for(const [id,key] of [['opacityAccent','accent'],['opacitySidebar','sidebar'],['opacityBackground','background'],['opacityCard','card'],['opacityText','text']])if(get(id))t.opacity[key]=number(id,t.opacity[key]||100);
   if(get('strength'))t.strength=number('strength',t.strength||100);
  }
  if(get('sidebarSide')||get('compactMenu'))s.layout={...(s.layout||{}),sidebarSide:get('sidebarSide')?.value||s.layout?.sidebarSide||'right',compact:get('compactMenu')?.checked??!!s.layout?.compact};
  if(get('reportCalendarDefaultSelect'))s.reportCalendar=get('reportCalendarDefaultSelect').value;
  if(get('defaultExpiryWarningDays')){const days=number('defaultExpiryWarningDays',s.defaultExpiryWarningDays||7);if(Number.isInteger(days)&&days>=0&&days<=3650){s.defaultExpiryWarningDays=days;s.expiryAlertsEnabled=!!get('expiryAlertsEnabled')?.checked}}
  const feature=get('featureVisibilityPanel');if(feature){s.featureOptions=s.featureOptions||{};feature.querySelectorAll('[data-feature-hidden]').forEach(x=>s.featureOptions[x.dataset.featureHidden]=!!x.checked);if(s.featureOptions.financeGroup)for(const k of ['entrustments','credit','checks','installments','checkbooks'])s.featureOptions[k]=true}
  for(const [id,key] of [['showImagesInInventory','showImagesInInventory'],['showImagesInEntry','showImagesInEntry'],['invoiceImagesByDefault','invoiceImagesByDefault']])if(get(id))s[key]=!!get(id).checked;
  if(get('uiFontChoice'))s.uiFontId=get('uiFontChoice').value||'';
  const appearance=get('recordAppearancePanel');if(appearance){s.recordAppearance=s.recordAppearance||{};const a=s.recordAppearance;a.fieldStyles=a.fieldStyles||{};a.defaultRows=a.defaultRows||{};a.discountDefaults=a.discountDefaults||{};appearance.querySelectorAll('[data-style]').forEach(x=>{const k=x.dataset.style,p=x.dataset.prop,rec=a.fieldStyles[k]=a.fieldStyles[k]||{};rec[p]=p==='bold'||p==='italic'?!!x.checked:p==='size'?Math.max(10,Math.min(28,Number(x.value)||14)):x.value});appearance.querySelectorAll('[data-default-row]').forEach(x=>a.defaultRows[x.dataset.defaultRow]=x.value);appearance.querySelectorAll('[data-discount-default]').forEach(x=>a.discountDefaults[x.dataset.discountDefault]=x.value)}
  save();root.TameshkProfiles?.persistState?.(state);root.applyTheme?.();root.TameshkFeatureControls?.applyVisibility?.();root.TameshkFeatureControls?.applyHighlights?.();root.TameshkEnhancements146?.applyUiFonts?.();root.TameshkRecordAppearance?.applySaved?.();
  return true;
 }
 function leaveDialog(next,after){pendingSettingsAction=after||null;let modal=root.document.getElementById('unsavedSettingsDialog');if(!modal){modal=root.document.createElement('div');modal.id='unsavedSettingsDialog';modal.className='modal-backdrop';modal.innerHTML='<div class="modal unsaved-settings-modal"><div class="modal-head"><h2>تنظیمات ذخیره‌نشده است</h2></div><p>قبل از خروج، تغییرها ذخیره شوند؟</p><div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn" data-choice="cancel">انصراف</button><button type="button" class="btn danger" data-choice="discard">خیر، خروج بدون ذخیره</button><button type="button" class="btn primary" data-choice="save">بله، ذخیره و خروج</button></div></div>';root.document.body.appendChild(modal);modal.addEventListener('click',event=>{const choice=event.target.closest('[data-choice]')?.dataset.choice;if(!choice)return;if(choice==='cancel'){modal.classList.remove('open');pendingSettingsAction=null;return}try{if(choice==='save'&&!persistVisibleSettings()){root.showToast?.('ذخیره تنظیمات ناموفق بود.');return}}catch(e){root.showToast?.(e?.message||'ذخیره تنظیمات ناموفق بود.');return}modal.classList.remove('open');dirtyCategories.clear();const action=pendingSettingsAction;pendingSettingsAction=null;if(action){action();return}if(typeof originalGo==='function')originalGo.call(root,next)})}modal.classList.add('open')}
 function installDirtyGuard(){if(root.go&&!root.go.__settingsGuard){originalGo=root.go;const wrapped=function(page){if(inSettings&&hasUnsavedSettings()&&page!=='settings'){leaveDialog(page);return false}if(page==='settings'&&!inSettings)dirtyCategories.clear();const result=originalGo.apply(this,arguments);inSettings=page==='settings';return result};wrapped.__settingsGuard=true;root.go=wrapped}const content=root.document.getElementById('content');const markTargetDirty=event=>{if(inSettings)dirtyCategories.add(categoryForTarget(event.target))};content?.addEventListener('input',markTargetDirty);content?.addEventListener('change',markTargetDirty);root.addEventListener('beforeunload',event=>{if(hasUnsavedSettings()){event.preventDefault();event.returnValue=''}});for(const name of ['saveSettings','saveThemeSettings'])if(typeof root[name]==='function'&&!root[name].__dirtyAware){const prior=root[name],wrapped=function(...args){persistVisibleSettings();const result=prior.apply(this,args);dirtyCategories.clear();return result};wrapped.__dirtyAware=true;root[name]=wrapped}if(typeof root.confirmResetDemo==='function'&&!root.confirmResetDemo.__languageResetAware){const reset=root.confirmResetDemo,wrapped=function(...args){const result=reset.apply(this,args);state.settings.language='fa';root.setUiLanguage?.('fa');dirtyCategories.clear();return result};wrapped.__languageResetAware=true;root.confirmResetDemo=wrapped}}
 setTimeout(installDirtyGuard,0);
 root.TameshkSettingsTabs=true;
})(window);
