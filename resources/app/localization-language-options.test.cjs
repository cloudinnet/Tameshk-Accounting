'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/localization.js','utf8');
const match=source.match(/function syncLanguageOptionLabels\(\)\{[\s\S]*?\}\n function translateRoot/);
assert.ok(match,'language option label synchronizer exists');
const synchronizer=match[0].split('\n function translateRoot')[0];
function run(language){
  const selectors={
    '#uiLanguageSelect option[value="fa"],#languageProfileSelect option[value="fa"],#quickLanguageMenu [data-lang="fa"]':[{textContent:''},{textContent:''},{textContent:''}],
    '#uiLanguageSelect option[value="ar"],#languageProfileSelect option[value="ar"],#quickLanguageMenu [data-lang="ar"]':[{textContent:''},{textContent:''},{textContent:''}]
  };
  const context={lang:language,document:{querySelectorAll(selector){return selectors[selector]||[]}}};
  vm.runInNewContext(`${synchronizer};syncLanguageOptionLabels()`,context);
  return selectors;
}
test('language labels include each language name in English and local names otherwise',()=>{
  const english=run('en');
  assert.deepEqual(english['#uiLanguageSelect option[value="fa"],#languageProfileSelect option[value="fa"],#quickLanguageMenu [data-lang="fa"]'].map(x=>x.textContent),Array(3).fill('(Persian) پارسی'));
  assert.deepEqual(english['#uiLanguageSelect option[value="ar"],#languageProfileSelect option[value="ar"],#quickLanguageMenu [data-lang="ar"]'].map(x=>x.textContent),Array(3).fill('(Arabic) العربية'));
  const arabic=run('ar');
  assert.deepEqual(arabic['#uiLanguageSelect option[value="fa"],#languageProfileSelect option[value="fa"],#quickLanguageMenu [data-lang="fa"]'].map(x=>x.textContent),Array(3).fill('پارسی'));
  assert.deepEqual(arabic['#uiLanguageSelect option[value="ar"],#languageProfileSelect option[value="ar"],#quickLanguageMenu [data-lang="ar"]'].map(x=>x.textContent),Array(3).fill('العربية'));
});
