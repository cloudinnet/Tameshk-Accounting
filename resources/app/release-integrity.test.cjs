'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=__dirname;
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(base,'sw.js'),'utf8');
const notif=fs.readFileSync(path.join(base,'notification-center.js'),'utf8');

test('offline cache version is bumped and precache contains every loaded JavaScript file',()=>{
  assert.match(sw,/tameshk-accounting-offline-v41/,'release changes must invalidate the previous offline cache');
  const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+\.js)["'][^>]*>/gi)].map(m=>m[1].replace(/^\.\//,''));
  const precache=new Set([...sw.matchAll(/"\.\/([^"']+\.js)"/g)].map(m=>m[1]));
  assert.ok(scripts.length>30,'app loads a meaningful set of scripts');
  for(const name of scripts){assert.ok(precache.has(name),`${name} is part of the offline precache`);assert.ok(fs.existsSync(path.join(base,name)),`${name} exists in the release source`)}
  for(const name of precache)assert.ok(fs.existsSync(path.join(base,name)),`precache file ${name} exists`);
});

test('notification center uses current release version even when runtime metadata is absent',()=>{
  assert.match(notif,/function currentVersion\(\)\{return String\(root\.TAMESHK_APP_VERSION\|\|root\.TAMESHK_PACKAGE_VERSION\|\|root\.TAMESHK_PACKAGE\?\.version\|\|'1\.50\.7'\)\}/);
  assert.doesNotMatch(notif,/\|\|'1\.50\.3'/);
});
