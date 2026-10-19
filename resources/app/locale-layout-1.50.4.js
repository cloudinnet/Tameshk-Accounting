/* Presentation only: stored opacity remains alpha, never a migrated transparency value. */
(function(root){
'use strict';
if(!root.document||root.TameshkLocaleLayout1504)return;
const d=root.document;
const ids=['opacitySidebar','opacityCard','opacityAccent','opacityBackground','opacityText','widgetMainOpacity'];
const titles={opacitySidebar:['میزان مات بودن منو','Menu opacity','عتامة القائمة'],opacityCard:['میزان مات بودن پنل‌ها','Panel opacity','عتامة اللوحات'],opacityAccent:['میزان مات بودن رنگ تأکیدی','Accent opacity','عتامة اللون المميز'],opacityBackground:['میزان مات بودن پس‌زمینه','Background opacity','عتامة الخلفية'],opacityText:['میزان مات بودن نوشته‌ها','Text opacity','عتامة النص'],widgetMainOpacity:['میزان مات بودن ویجت','Widget opacity','عتامة الودجت']};
function language(){return d.documentElement.lang||'fa'}
function tr(words){return words[language()==='en'?1:language()==='ar'?2:0]}
function text(el,value){if(el&&el.textContent!==value)el.textContent=value}
function sync(){
 for(const id of ids){const input=d.getElementById(id);if(!input)continue;input.setAttribute('dir','ltr');const box=input.closest('.range-control');const label=box?.querySelector('label');if(label){label.dataset.noI18n='';text(label,tr(titles[id]))}const output=d.getElementById(id+'Val')||d.getElementById(id+'Value');if(output){output.dataset.noI18n='';text(output,new Intl.NumberFormat(language()==='fa'?'fa-IR':language()==='ar'?'ar':'en').format(Number(input.value))+'%')}const small=box?.querySelector('small');if(small){small.dir='ltr';const spans=small.querySelectorAll('span');if(spans.length===2){spans.forEach(x=>x.dataset.noI18n='');text(spans[0],tr(['شفاف‌تر','More transparent','أكثر شفافية']));text(spans[1],tr(['مات‌تر','More opaque','أكثر عتامة']))}}}
 d.querySelectorAll('.widget-opacity-control input[type="range"]').forEach(x=>{x.dir='ltr';const output=x.closest('.widget-opacity-control')?.querySelector('b');if(output){output.dataset.noI18n='';text(output,new Intl.NumberFormat(language()==='fa'?'fa-IR':language()==='ar'?'ar':'en').format(Number(x.value))+'%')}});
 // Mirror the existing FA toast offset in EN; actual sidebar bounds also cover custom layouts.
 const toast=d.getElementById('toast');if(toast){if(language()==='en'){const aside=d.querySelector('.app:not(.widget-app)>aside'),r=aside?.getBoundingClientRect(),visible=aside&&root.getComputedStyle(aside).display!=='none'&&r.width>0&&r.height>0;const end=visible&&r.left<root.innerWidth/2?r.right:0;toast.style.setProperty('left','auto');toast.style.setProperty('right','22px');toast.style.setProperty('max-width',`max(0px, calc(100vw - ${Math.ceil(end)+44}px))`)}else{toast.style.removeProperty('left');toast.style.removeProperty('right');toast.style.removeProperty('max-width')}}
 root.TameshkRecordAppearance?.refreshPlacement?.();
}
const style=d.createElement('style');style.textContent='input[type="range"][id^="opacity"],#widgetMainOpacity,.widget-opacity-control input[type="range"]{direction:ltr!important}.range-control:has(input[id^="opacity"]) small,.range-control:has(#widgetMainOpacity) small{direction:ltr}#toast{overflow-wrap:anywhere}html[lang="en"] .stat .stat-ico{left:auto;right:17px}html[lang="en"] .stat:has(.stat-ico) .label{padding-inline-end:48px}html[lang="en"] .stat .value{text-align:left!important}html[lang="en"] .quick button{text-align:left}';d.head.appendChild(style);
for(const name of ['settingsPage','previewTheme']){const old=root[name];if(typeof old==='function')root[name]=function(){const result=old.apply(this,arguments);sync();return result}}
d.addEventListener('input',e=>{if(ids.includes(e.target.id)||e.target.matches?.('.widget-opacity-control input[type="range"]'))sync()});root.addEventListener('resize',sync);
new MutationObserver(sync).observe(d.documentElement,{attributes:true,attributeFilter:['lang','dir']});
new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1)))sync()}).observe(d.body,{childList:true,subtree:true});
root.TameshkLocaleLayout1504=Object.freeze({sync});sync();
})(window);
