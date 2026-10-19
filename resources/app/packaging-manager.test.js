'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sourcePath = path.join(__dirname,'packaging-manager.js');
const source = fs.readFileSync(sourcePath,'utf8');
const ctx = {state:{settings:{language:'fa'},products:[]},Date,Math,Number,Map,Set,Object,Array,JSON,String,Intl};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(source,ctx,{filename:sourcePath});
const manager = ctx.TameshkPackagingManager;
assert.ok(manager);

// Older flat two-level records migrate to parent-relative ratios without changing base-unit totals.
const legacy = {id:'old',baseUnit:'عدد',packUnits:[
  {name:'پک',baseQty:6},
  {name:'کارتن',baseQty:120}
]};
const migrated = manager.normalizePackUnits(legacy);
assert.equal(migrated[0].parentId,'base');
assert.equal(migrated[0].qtyInParent,6);
assert.equal(migrated[1].parentId,migrated[0].id);
assert.equal(migrated[1].qtyInParent,20);
assert.equal(migrated[1].baseQty,120);

// Arbitrary-depth chains, optional branches, and fractional metric units are all supported.
const flexible = {id:'flex',baseUnit:'کیلوگرم',packUnits:[
  {id:'quarter',name:'کیسهٔ ۲۵۰ گرمی',parentId:'base',qtyInParent:0.25,baseQty:0.25},
  {id:'case',name:'پک چهارکیسه‌ای',parentId:'quarter',qtyInParent:4,baseQty:1},
  {id:'outer',name:'کارتن ده‌پکی',parentId:'case',qtyInParent:10,baseQty:10},
  {id:'sibling',name:'بطری نیم‌لیتری',parentId:'base',qtyInParent:0.5,baseQty:0.5}
]};
const normalized = manager.normalizePackUnits(flexible);
assert.deepEqual(Array.from(normalized,x=>x.baseQty),[0.25,1,10,0.5]);
assert.deepEqual(Array.from(manager.getOptions(flexible),x=>x.factor),[1,0.25,1,10,0.5]);
assert.equal(manager.getOptions(flexible)[3].parentId,'case');

console.log('packaging-manager tests passed');
