const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const main = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const lines = main.split(/\r?\n/);
const functionLine = name => {
  const line = lines.find(x => x.trimStart().startsWith(`function ${name}(`));
  assert.ok(line, `function ${name} exists`);
  return line.trim();
};

function createHarness(initialState) {
  const events = { modal: '', toasts: [], saves: 0, renders: 0, filtered: 0 };
  const sandbox = {
    state: initialState,
    window: { __tameshkPendingCategoryRemoval: null, uiText: value => value },
    document: { getElementById: () => null },
    openModal: html => { events.modal = html; },
    closeModal: () => { events.modal = ''; },
    esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'),
    showToast: value => { events.toasts.push(value); },
    save: () => { events.saves++; return true; },
    render: () => { events.renders++; },
    filterCategories: () => { events.filtered++; }
  };
  vm.createContext(sandbox);
  vm.runInContext([
    functionLine('categoryInUse'),
    functionLine('cancelCategoryRemoval'),
    functionLine('applyCategoryRemoval'),
    functionLine('addCategory'),
    functionLine('confirmCategoryRemoval'),
    functionLine('removeCategory')
  ].join('\n'), sandbox);
  return { sandbox, events };
}

{
  const state = {
    categories: ['-', 'کالاهای اداری'],
    products: [{ id: 'p1', name: 'دفتر', category: 'کالاهای اداری' }],
    services: [],
    expenses: [{ id: 'e1', title: 'هزینه قدیمی', category: 'کالاهای اداری' }],
    transactions: [{ id: 't1', items: [{ name: 'دفتر', category: 'کالاهای اداری' }] }],
    settings: { language: 'fa' }
  };
  const { sandbox, events } = createHarness(state);
  sandbox.removeCategory(1);
  assert.ok(events.modal.includes('کالاهای اداری'), 'confirmation includes the category label');
  assert.ok(events.modal.includes('باقی می‌ماند'), 'confirmation explains that history is preserved');
  assert.deepEqual(Array.from(state.categories), ['-', 'کالاهای اداری'], 'category is not removed before confirmation');
  assert.equal(events.saves, 0, 'opening confirmation does not save a change');

  sandbox.cancelCategoryRemoval();
  assert.deepEqual(Array.from(state.categories), ['-', 'کالاهای اداری'], 'cancel leaves the category in place');
  assert.equal(events.saves, 0, 'cancel does not save');

  sandbox.removeCategory(1);
  sandbox.confirmCategoryRemoval();
  assert.deepEqual(Array.from(state.categories), ['-'], 'confirmation removes the category from selectable categories');
  assert.equal(state.products[0].category, 'کالاهای اداری', 'product label is preserved as stored text');
  assert.equal(state.expenses[0].category, 'کالاهای اداری', 'expense history retains the old category label');
  assert.equal(state.transactions[0].items[0].category, 'کالاهای اداری', 'transaction history retains the old category label');
  assert.deepEqual(Array.from(state.settings.deletedCategories), ['کالاهای اداری'], 'a tombstone keeps the removed category out of active selection lists after reload');
  assert.equal(events.saves, 1, 'the confirmed deletion is persisted once');

  sandbox.removeCategory(0);
  assert.deepEqual(Array.from(state.categories), ['-'], 'the final category cannot be removed');
  assert.equal(events.saves, 1, 'attempting to remove the final category does not save');
}

{
  const state = { categories: ['-', 'بدون استفاده'], products: [], services: [], expenses: [], transactions: [], settings: {} };
  const { sandbox, events } = createHarness(state);
  sandbox.removeCategory(1);
  assert.deepEqual(Array.from(state.categories), ['-'], 'an unused category is removed immediately');
  assert.equal(events.modal, '', 'unused categories do not show a history warning');
  assert.equal(events.saves, 1, 'unused category deletion is saved once');
}

assert.match(main,/window\.__tameshkPendingCategoryRemoval=null;closeModal\(\)/,'dismissing the modal backdrop also cancels the pending category deletion');

{
  const stored = { categories: ['-', 'قدیمی'], products: [], services: [], expenses: [], transactions: [], settings: { deletedCategories: [] } };
  const { sandbox } = createHarness({ categories: ['-', 'قدیمی'], products: [], services: [], expenses: [], transactions: [], settings: { deletedCategories: [] } });
  sandbox.save = () => { sandbox.state = JSON.parse(JSON.stringify(stored)); return false; };
  sandbox.removeCategory(1);
  assert.deepEqual(Array.from(sandbox.state.categories), ['-', 'قدیمی'], 'failed persistence restores authoritative stored categories without an extra in-memory rollback');
  assert.deepEqual(Array.from(sandbox.state.settings.deletedCategories), [], 'failed persistence must not add a tombstone to the restored state');
}

{
  const stored = { categories: ['-'], products: [], services: [], expenses: [], transactions: [], settings: { deletedCategories: [] } };
  const { sandbox } = createHarness({ categories: ['-'], products: [], services: [], expenses: [], transactions: [], settings: { deletedCategories: [] } });
  sandbox.document.getElementById = id => id === 'newCat' ? { value: 'جدید' } : null;
  sandbox.save = () => { sandbox.state = JSON.parse(JSON.stringify(stored)); return false; };
  sandbox.addCategory();
  assert.deepEqual(Array.from(sandbox.state.categories), ['-'], 'failed persistence must not mutate the restored state while unwinding category addition');
  assert.deepEqual(Array.from(sandbox.state.settings.deletedCategories), [], 'failed category addition must not alter deletion markers on restored state');
}


{
  const state = {
    categories: ['-'],
    products: [{ id: 'p1', name: 'دفتر قدیمی', category: 'کالاهای اداری' }],
    services: [], expenses: [], transactions: [],
    settings: { deletedCategories: ['کالاهای اداری'] }
  };
  const { sandbox, events } = createHarness(state);
  const input = { value: '  کالاهای اداری  ' };
  sandbox.document.getElementById = id => id === 'newCat' ? input : null;
  sandbox.addCategory();
  assert.deepEqual(Array.from(state.categories), ['-', 'کالاهای اداری'], 'a deleted category can be recreated with the same name');
  assert.deepEqual(Array.from(state.settings.deletedCategories), [], 'recreation clears the matching deletion marker');
  assert.equal(state.products[0].category, 'کالاهای اداری', 'old records keep their original text label');
  assert.equal(events.saves, 1, 'recreation is persisted once');
  assert.equal(input.value, '', 'the add-category field clears after successful recreation');

  input.value = 'کالاهای اداری';
  sandbox.addCategory();
  assert.deepEqual(Array.from(state.categories), ['-', 'کالاهای اداری'], 'an already active category is not duplicated');
  assert.match(events.toasts.at(-1), /قبلاً وجود دارد/);
  assert.equal(events.saves, 1, 'duplicate active category is not persisted');
}

console.log('category history-safe deletion tests passed');
