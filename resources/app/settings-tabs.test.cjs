'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const tabs=read('settings-tabs.js');
const profiles=read('inventory-profiles.js');
const fonts=read('enhancements-146.js');
const features=read('feature-controls.js');
const widget=read('desktop-widget.js');
const locale=read('localization.js');

test('management tabs keep the requested order after appearance and before alerts',()=>{
  const ids=[...tabs.matchAll(/\['(invoice|categories|data|appearance|defaults|dates|alerts)'/g)].map(x=>x[1]);
  assert.deepEqual(ids,['invoice','categories','data','appearance','defaults','dates','alerts']);
  assert.match(tabs,/\['defaults','پیش‌فرض‌ها و قابلیت‌های اختیاری'/);
  assert.match(tabs,/\['dates','تاریخ‌ها'/);
});

test('date display and entry-calendar controls are normalized into an untitled group after the full settings-wrapper chain',()=>{
  assert.match(tabs,/function ensureDateControlsInDates\(host\)/);
  assert.match(tabs,/\['dateMode','transactionCalendar'\].map\(id=>host\.querySelector\(`#\$\{id\}`\)\?\.closest\('\.field'\)\)/);
  assert.match(tabs,/dateGroup\.className='form-grid settings-date-fields'/);
  assert.match(tabs,/datePanel\.insertBefore\(dateGroup,report\|\|null\)/);
  assert.match(tabs,/ensureDateControlsInDates\(el\);root\.setTimeout\?\.\(\(\)=>ensureDateControlsInDates\(el\),0\)/);
  assert.match(fonts,/el\.querySelector\('\[data-settings-panel="dates"\]'\)/);
  assert.match(fonts,/appearance\.appendChild\(card\);const sel=d\.getElementById\('reportCalendarDefaultSelect'\)/);
  assert.match(tabs,/if\(get\('dateMode'\)\)s\.dateMode=/);
  assert.match(tabs,/if\(get\('transactionCalendar'\)\)s\.transactionCalendar=/);
  assert.match(tabs,/if\(get\('reportCalendarDefaultSelect'\)\)s\.reportCalendar=/);
});

test('seller defaults are removed from language/profile and rendered under management defaults without changing IDs or save handler',()=>{
  const profileMarkup=profiles.slice(profiles.indexOf('function profileMarkup()'),profiles.indexOf('\nfunction ',profiles.indexOf('function profileMarkup()')+10));
  assert.doesNotMatch(profileMarkup,/seller(?:Phone|Name|NationalId|Address)Default/);
  assert.match(profiles,/function sellerDefaultsMarkup\(\)/);
  for(const id of ['sellerPhoneDefault','sellerNameDefault','sellerNationalIdDefault','sellerAddressDefault'])assert.ok(profiles.includes(id));
  assert.match(profiles,/root\.tameshkSaveSellerDefaults=saveSellerDefaults/);
  assert.match(profiles,/sellerDefaultsMarkup,profileCatalog/);
  assert.match(tabs,/root\.TameshkProfiles\?\.sellerDefaultsMarkup\?\.\(\)/);
  assert.match(tabs,/groups\.defaults\.insertAdjacentHTML\('beforeend',sellerMarkup\)/);
  assert.match(profiles,/function saveSellerDefaults\(\).*writeCatalog\(\);saveProfileState\(\)/);
});

test('font manager stays in appearance between layout card and record-style panel',()=>{
  assert.match(fonts,/data-settings-panel="appearance"/);
  assert.match(fonts,/theme\.insertAdjacentElement\('afterend',card\)/);
  assert.match(features,/const fontManager=el\.querySelector\('#uiFontManager'\),theme=el\.querySelector\('\.theme-card'\),anchor=fontManager\|\|theme/);
  assert.match(features,/anchor\.insertAdjacentHTML\('afterend',rowDefaultsPanel\(\)\)/);
  assert.match(tabs,/if\(get\('uiFontChoice'\)\)s\.uiFontId=/);
});

test('independent currency, optional features and widget are placed in defaults, keeping stable control IDs',()=>{
  assert.match(features,/el\.querySelector\('\[data-settings-panel="defaults"\]'\)/);
  assert.match(features,/defaults\.insertAdjacentHTML\('beforeend',currencyPanel\(\)\+optionsPanel\(\)\)/);
  assert.match(features,/id="currencySettingsPanel"/);
  assert.match(features,/markSaved\('currency'\)/);
  assert.match(widget,/el\?\.querySelector\('\[data-settings-panel="defaults"\]'\)/);
  assert.match(widget,/defaults\.insertAdjacentHTML\('beforeend',settingsMarkup\(\)\)/);
  for(const id of ['featureVisibilityPanel','widgetEnabled','widgetOptions','widgetMainOpacity'])assert.ok(features.includes(id)||widget.includes(id));
  assert.match(tabs,/const feature=get\('featureVisibilityPanel'\);/);
});

test('new tab and seller labels have English and Arabic translations',()=>{
  for(const key of ['پیش‌فرض‌ها و قابلیت‌های اختیاری','تاریخ‌ها','پیش‌فرض‌های فروشنده برای فاکتور'])assert.ok(locale.includes(`'${key}':`));
});

test('Persian language option keeps its native name in Arabic and uses bilingual wording in English in all selectors',()=>{
  assert.match(locale,/lang==='en'\?'\(Persian\) پارسی':'پارسی'/);
  assert.match(locale,/uiLanguageSelect option\[value="fa"\],#languageProfileSelect option\[value="fa"\],#quickLanguageMenu \[data-lang="fa"\]/);
  assert.match(locale,/syncLanguageOptionLabels\(\)/);
  assert.match(locale,/if\(opt&&sel&&\['uiLanguageSelect','languageProfileSelect'\]\.includes\(sel\.id\)\)return true/);
  assert.match(tabs,/root\.updateLanguageOptionLabels\?\.\(\)/);
  assert.match(profiles,/const sel=el\.querySelector\('#languageProfileSelect'\);if\(sel\)sel\.value=language;root\.updateLanguageOptionLabels\?\.\(\)/);
});

test('clearing the business/invoice-header name does not repopulate the product brand as business data',()=>{
  assert.match(tabs,/if\(get\('business'\)\)s\.business=get\('business'\)\.value\.trim\(\);/);
  assert.doesNotMatch(tabs,/s\.business=get\('business'\)\.value\.trim\(\)\|\|'تمشک'/);
});
