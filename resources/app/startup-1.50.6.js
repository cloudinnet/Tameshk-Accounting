/* Keep parser-time Persian markup and an unmounted desktop header out of the
   first frame. This gate is bounded: damaged storage or a failed script must
   never leave a permanently invisible application. */
(function(root){
'use strict';
const d=root.document;if(!d||root.TameshkStartup1506)return;
const style=d.createElement('style');style.id='tameshkStartupStyles';
style.textContent='html.tameshk-starting body{visibility:hidden!important}';
d.head.appendChild(style);d.documentElement.classList.add('tameshk-starting');
let language='en';
try{
 const storage=root.localStorage,parse=key=>{try{return JSON.parse(storage.getItem(key)||'null')}catch{return null}};
 const catalog=parse('tameshk-profiles-v1');let saved=parse('tameshk-state');
 if(catalog?.version===1&&Array.isArray(catalog.profiles)&&catalog.profiles.length){
  const valid=id=>catalog.profiles.some(p=>p.id===id),fallback=valid(catalog.defaultId)?catalog.defaultId:catalog.profiles[0].id;
  const id=catalog.startupPicker===false?fallback:valid(catalog.activeId)?catalog.activeId:fallback;
  const profile=parse('tameshk-profile-'+id);if(profile&&Array.isArray(profile.products))saved=profile;
 }
 if(['fa','en','ar'].includes(saved?.settings?.language))language=saved.settings.language;
}catch{}
d.documentElement.lang=language;d.documentElement.dir=language==='en'?'ltr':'rtl';
let widget=false;try{const url=new URL(root.location.href);widget=url.searchParams.has('tameshkPanel')||url.searchParams.has('tameshkWidget')}catch{}
let complete=false,domReady=false,desktopReady=!root.tameshkDesktop||widget,released=false;
let resolveVisible;const visible=new Promise(resolve=>resolveVisible=resolve);
const release=()=>{if(released)return;released=true;clearTimeout(deadline);d.documentElement.classList.remove('tameshk-starting');resolveVisible(true)};
// Some hidden desktop surfaces throttle rAF; the settled UI is also safe to
// release on a task, without waiting for the full failure deadline.
const check=()=>{if(complete&&domReady&&desktopReady&&!released){root.requestAnimationFrame(release);root.setTimeout(release,100)}};
const deadline=root.setTimeout(release,8000);
// A task after DOMContentLoaded lets all existing locale/profile listeners and
// their mutation observers settle before the first visible animation frame.
const settled=()=>root.setTimeout(()=>{domReady=true;check()},0);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',settled,{once:true});else settled();
root.TameshkStartup1506=Object.freeze({
 ready(){complete=true;check();return visible},
 desktopReady(){desktopReady=true;check();return visible},
 visible
});
})(window);
