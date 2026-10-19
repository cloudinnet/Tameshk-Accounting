/* Three-way state merge for detached desktop windows. */
(function(root){
'use strict';
if(!root||root.TameshkStateMerge)return;
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const same=(a,b)=>{if(a===b)return true;try{return JSON.stringify(a)===JSON.stringify(b)}catch{return false}};
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
let baseline;
function mergeValue(base,local,remote){
  if(same(local,base))return clone(remote);
  if(same(remote,base))return clone(local);
  if(plain(base)&&plain(local)&&plain(remote)){
    const out=Object.create(null),keys=new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)]);
    for(const k of keys){const b=Object.hasOwn(base,k),l=Object.hasOwn(local,k),r=Object.hasOwn(remote,k);
      if(!l){if(!b){if(r)out[k]=clone(remote[k]);continue}if(!r)continue;if(same(remote[k],base[k]))continue;out[k]=clone(remote[k]);continue}
      if(!r){if(!b){out[k]=clone(local[k]);continue}if(same(local[k],base[k]))continue;out[k]=clone(local[k]);continue}
      out[k]=mergeValue(b?base[k]:undefined,local[k],remote[k]);
    }
    return out;
  }
  if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote)){
    const hasValidKeys=items=>items.every(x=>plain(x)&&x.id!==undefined&&x.id!==null&&String(x.id)!=='');
    const hasUniqueKeys=items=>{const ids=items.map(x=>String(x.id));return new Set(ids).size===ids.length};
    // Duplicate IDs make record identity ambiguous. Do not collapse those rows in a Map;
    // the existing unkeyed-list policy below keeps the latest committed list intact.
    const keyed=[base,local,remote].every(hasValidKeys)&&[base,local,remote].every(hasUniqueKeys);
    if(keyed){
      const bm=new Map(base.map(x=>[String(x.id),x])),lm=new Map(local.map(x=>[String(x.id),x])),rm=new Map(remote.map(x=>[String(x.id),x]));
      const ids=[...new Set([...remote.map(x=>String(x.id)),...local.map(x=>String(x.id)),...base.map(x=>String(x.id))])],out=new Map();
      for(const id of ids){const b=bm.get(id),l=lm.get(id),r=rm.get(id);
        if(!l){if(!b){if(r)out.set(id,clone(r));continue}if(!r||same(r,b))continue;out.set(id,clone(r));continue}
        if(!r){if(!b){out.set(id,clone(l));continue}if(same(l,b))continue;out.set(id,clone(l));continue}
        out.set(id,mergeValue(b,l,r));
      }
      const order=[...remote.map(x=>String(x.id)),...local.map(x=>String(x.id)),...base.map(x=>String(x.id))];
      return [...new Set(order)].filter(id=>out.has(id)).map(id=>out.get(id));
    }
    if([...base,...local,...remote].every(x=>x===null||['string','number','boolean'].includes(typeof x))){const out=clone(remote);for(const item of local)if(!out.some(x=>same(x,item)))out.push(clone(item));return out}
    // Unkeyed record lists are replaced only when the other side is unchanged.
    // If both edited the same list, keep the latest committed value.
    return clone(remote);
  }
  // For simultaneous edits to the same scalar, preserve the latest committed value.
  return clone(remote);
}
function readStored(){try{const storage=root.localStorage,key='tameshk-state';let raw=storage?.getItem(key);if(!raw){const legacyKey='tama'+'shk-state',legacy=storage?.getItem(legacyKey);if(legacy){const parsed=JSON.parse(legacy);if(plain(parsed)){storage.setItem(key,legacy);storage.removeItem(legacyKey);raw=legacy}}}return raw?JSON.parse(raw):undefined}catch{return undefined}}
function mergeForSave(localState,replace=false){const latest=readStored();if(replace){const next=clone(localState);baseline=clone(next);return next}if(!baseline)baseline=clone(latest??localState);const next=mergeValue(baseline,localState,latest??baseline);baseline=clone(next);return next}
function acceptRemote(remoteState,localState){if(!remoteState||typeof remoteState!=='object')return localState;if(!baseline){baseline=clone(remoteState);return clone(remoteState)}const merged=mergeValue(baseline,localState,remoteState);baseline=clone(remoteState);return merged}
function reset(snapshot){if(snapshot&&typeof snapshot==='object')baseline=clone(snapshot)}
root.TameshkStateMerge=Object.freeze({mergeForSave,acceptRemote,reset});
})(window);
