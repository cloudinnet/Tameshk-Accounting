'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const NC = require('./notification-center.js');
function withState(data, fn) { const prior = global.state; global.state = data; try { return fn(); } finally { global.state = prior; } }

test('notification history initializes safely and deduplicates stable keys', () => withState({ settings: {} }, () => {
  const s = NC.ensureModel(); assert.deepEqual(s.settings.notificationHistory, []);
  const a = NC.addRecord('update', 'update:1.2.0', 'Update', 'Available', { version: '1.2.0' });
  const b = NC.addRecord('update', 'update:1.2.0', 'Update', 'Available');
  assert.equal(a.id, b.id); assert.equal(s.settings.notificationHistory.length, 1); assert.equal(s.settings.autoUpdateCheckEnabled, true);
}));
test('check and installment due records honor their lead days', () => withState({ settings: { defaultDueWarningDays: 7 }, checks: [{ id: 'c1', number: '42', dueDate: '2026-10-05', alertLeadDays: 3, status: 'unpaid', amount: 500 }], installments: [{ id: 'i1', party: 'Ali', parts: [{ id: 'p1', dueDate: '2026-10-08', amount: 250, status: 'unpaid' }, { id: 'p2', dueDate: '2026-10-20', amount: 250, status: 'paid' }] }] }, () => {
  const now = new Date('2026-10-03T12:00:00'); assert.equal(NC.dueCheckRecords(now).length, 1); assert.equal(NC.dueInstallmentRecords(now).length, 1);
  const out = NC.recordDue(now); assert.equal(out.checks.length, 1); assert.equal(out.parts.length, 1); assert.equal(global.state.settings.notificationHistory.length, 2);
}));
test('paid checks and installments are excluded', () => withState({ settings: { defaultDueWarningDays: 30 }, checks: [{ id: 'c1', dueDate: '2026-10-01', alertLeadDays: 10, status: 'paid' }], installments: [{ id: 'archived', active: false, archived: true, parts: [{ id: 'old-p', dueDate: '2026-10-01', status: 'unpaid' }] }, { id: 'i', active: true, parts: [{ id: 'p', dueDate: '2026-10-01', status: 'paid', paidAt: '2026-10-01T12:00:00Z' }] }] }, () => {
  const now = new Date('2026-10-03T12:00:00'); assert.equal(NC.dueCheckRecords(now).length, 0); assert.equal(NC.dueInstallmentRecords(now).length, 0);
}));
test('an unpaid check with a stale paidAt timestamp remains eligible for a due alert', () => withState({ settings: { defaultDueWarningDays: 30 }, checks: [{ id: 'c1', dueDate: '2026-10-01', alertLeadDays: 10, status: 'unpaid', paidAt: '2026-10-02T12:00:00Z' }] }, () => {
  assert.equal(NC.dueCheckRecords(new Date('2026-10-03T12:00:00')).length, 1);
}));
test('notification types remain distinct even with the same deduplication key', () => withState({ settings: {} }, () => {
  NC.addRecord('check', 'due:1', 'Check', 'x'); NC.addRecord('installment', 'due:1', 'Part', 'y'); assert.equal(global.state.settings.notificationHistory.length, 2);
}));
test('dismissing an active due alert removes its duplicate history row from view', () => withState({ settings: { defaultDueWarningDays: 30 }, checks: [{ id: 'c1', number: '42', dueDate: '2000-01-01', alertLeadDays: 30, status: 'unpaid', amount: 500 }], installments: [] }, () => {
  const active = NC.rowData('due').find(x => x.active); assert.ok(active); global.state.settings.notificationDismissed[active.key] = true; assert.equal(NC.rowData('due').length, 0);
}));
test('software notices retain release notes, pagination, and bulk actions', () => withState({ settings: { notificationHistory: Array.from({ length: 12 }, (_, i) => ({ id: `u${i}`, type: 'update', dedupeKey: `update:${i}`, title: 'Update', message: `Release ${i}`, version: `1.5.${i + 10}`, url: 'https://github.com/cloudinnet/Tameshk-Accounting/releases/latest', releaseNotes: '- Feature one\n- Bug fix two', createdAt: `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` })) } }, () => {
  const html = NC.sectionMarkup('software'); assert.equal(NC.rowData('software').length, 12); assert.match(html, /data-tp-size="10"/); assert.equal((html.match(/data-nc-delete=/g) || []).length, 12);
  assert.ok(html.includes('<li>Feature one</li>')); assert.ok(html.includes('<li>Bug fix two</li>')); assert.match(html, /data-nc-action="delete-selected"/); assert.match(html, /data-nc-action="delete-all"/);
}));
test('all three notification sections independently paginate after ten records', () => withState({ settings: { defaultDueWarningDays: 10000, notificationHistory: [
  ...Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, type: 'expiry', dedupeKey: `expiry:${i}`, title: 'Expiry', message: `Lot ${i}`, createdAt: '2026-01-01' })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `d${i}`, type: 'check', dedupeKey: `check:old${i}:2020-01-01`, title: 'Check', message: `Due ${i}`, createdAt: '2025-01-01' })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `u${i}`, type: 'update', dedupeKey: `update:${i}`, title: 'Update', message: `Release ${i}`, version: `1.6.${i}`, releaseNotes: '- Change', createdAt: '2024-01-01' }))
] }, checks: [], installments: [] }, () => {
  for (const tab of ['expiry', 'due', 'software']) { const html = NC.sectionMarkup(tab); assert.ok(html.includes(`data-notification-panel="${tab}"`)); assert.match(html, /data-tp-size="10"/); assert.equal((html.match(/data-nc-delete=/g) || []).length, 12); }
  assert.equal(NC.rowData('expiry').length, 12); assert.equal(NC.rowData('due').length, 12); assert.equal(NC.rowData('software').length, 12);
}));
test('update button is enabled only for a release newer than installed version', () => {
  const old = global.TAMESHK_APP_VERSION; global.TAMESHK_APP_VERSION = '1.5.26'; try { withState({ settings: { notificationHistory: [
    { id: 'new', type: 'update', title: 'Update', message: 'New', version: '1.5.27', createdAt: '2026-10-03' },
    { id: 'same', type: 'update', title: 'Update', message: 'Same', version: '1.5.26', createdAt: '2026-10-02' },
    { id: 'old', type: 'update', title: 'Update', message: 'Old', version: '1.5.25', createdAt: '2026-10-01' }
  ] } }, () => { const html = NC.sectionMarkup('software'); assert.match(html, /aria-disabled="false"/); assert.equal((html.match(/aria-disabled="true"/g) || []).length, 2); assert.ok(NC.newerThanCurrent('1.5.27')); assert.equal(NC.newerThanCurrent('1.5.26'), false); assert.equal(NC.newerThanCurrent('1.5.25'), false); }); } finally { global.TAMESHK_APP_VERSION = old; }
});
test('single and full-section deletion only removes notification history', () => withState({ settings: { notificationHistory: [{ id: 'u1', type: 'update', dedupeKey: 'update:1', title: 'Update', message: 'One' }, { id: 'u2', type: 'update', dedupeKey: 'update:2', title: 'Update', message: 'Two' }] } }, () => {
  NC.removeOne('software|u1'); assert.deepEqual(global.state.settings.notificationHistory.map(x => x.id), ['u2']); NC.deleteTab('software'); assert.deepEqual(global.state.settings.notificationHistory, []);
}));
test('deleting due alerts dismisses notices but preserves their check and installment records', () => withState({ settings: { defaultDueWarningDays: 30, notificationHistory: [] }, checks: [{ id: 'c1', number: '99', dueDate: '2000-01-01', alertLeadDays: 30, status: 'unpaid', amount: 100 }], installments: [{ id: 'i1', party: 'Ali', parts: [{ id: 'p1', dueDate: '2000-01-01', amount: 50, status: 'unpaid' }] }] }, () => {
  assert.equal(NC.rowData('due').filter(x => x.active).length, 2); NC.deleteTab('due'); assert.equal(NC.rowData('due').length, 0); assert.equal(global.state.checks.length, 1); assert.equal(global.state.installments.length, 1);
}));
test('alerts route to the notification center and pagination script is loaded first', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'); assert.match(html, /alerts:\(el\)=>\{if\(window\.TameshkNotificationCenter\?\.renderPage\)window\.TameshkNotificationCenter\.renderPage\(el\)/);
  assert.ok(html.indexOf('src="table-pagination.js"') < html.indexOf('src="notification-center.js"'));
  assert.match(html, /data-page="alerts"[^>]*>[^<]*<span class="ico">🔔<\/span><span>اعلانات<\/span>/);
  assert.match(fs.readFileSync(path.join(__dirname, 'notification-center.js'), 'utf8'), /__tameshkNotificationRouteBound/);
});

test('expiry alert batches retain every newly due lot in notification history', () => withState({ settings: {} }, () => {
  NC.eventExpiry({ detail: { items: [
    { product: 'A', lot: 'lot-1', expiryDate: '2026-10-05', daysLeft: 2 },
    { product: 'B', lot: 'lot-2', expiryDate: '2026-10-06', daysLeft: 3 }
  ] } });
  assert.equal(global.state.settings.notificationHistory.length, 2);
  assert.deepEqual(global.state.settings.notificationHistory.map(x => x.subId), ['lot-1', 'lot-2']);
}));

test('expiry notification table exposes the required lot warning columns', () => withState({ settings: {} }, () => {
  NC.eventExpiry({ detail: { items: [{ product: 'کالا', lot: 'رسید ۱', expiryDate: '2099-01-02', daysLeft: 4, message: 'پیام محموله' }] } });
  const html = NC.sectionMarkup('expiry');
  for (const label of ['کالا', 'شناسه محموله', 'مانده', 'انقضا', 'وضعیت', 'محل نگهداری', 'پیام هشدار', 'صدا']) assert.match(html, new RegExp(label));
  assert.match(html, /کالا/); assert.match(html, /رسید ۱/); assert.match(html, /پیام محموله/);
}));

test('notification center keeps the expiry route after inventory lifecycle hooks run', () => {
  const source = fs.readFileSync(path.join(__dirname, 'inventory-profiles.js'), 'utf8');
  assert.match(source, /currentPage==='alerts'&&!root\.TameshkNotificationCenter/);
  assert.match(source, /page==='alerts'&&!root\.TameshkNotificationCenter/);
});

test('release links accept only the actual GitHub repository path', () => {
  const latest = 'https://github.com/cloudinnet/Tameshk-Accounting/releases/latest';
  assert.equal(NC.safeReleaseUrl('https://github.com/cloudinnet/Tameshk-Accounting-evil/releases', '2.0.0'), latest);
  assert.equal(NC.safeReleaseUrl('javascript:alert(1)', '2.0.0'), latest);
  assert.equal(NC.safeReleaseUrl('https://github.com/cloudinnet/Tameshk-Accounting/releases/tag/v2.0.0', '2.0.0'), 'https://github.com/cloudinnet/Tameshk-Accounting/releases/tag/v2.0.0');
});

test('mixed active and historical expiry notices are globally sorted newest first', () => withState({ settings: { notificationHistory: [
  { id:'old', type:'expiry', dedupeKey:'old', title:'Old', message:'Old', createdAt:'2025-01-01T00:00:00Z' },
  { id:'new', type:'expiry', dedupeKey:'new', title:'New', message:'New', createdAt:'2026-01-01T00:00:00Z' }
] } }, () => {
  const rows=NC.rowData('expiry');
  assert.deepEqual(rows.map(x=>x.id),['new','old']);
}));
