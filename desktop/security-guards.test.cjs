'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isMainWindowEvent, isMainFrameEvent, cleanNotificationText, sanitizeRendererLogEntry } = require('./security-guards.cjs');

test('main-window IPC guard accepts only the main renderer sender', () => {
  const main = {}, aux = {};
  assert.equal(isMainWindowEvent({ sender: main }, main), true);
  assert.equal(isMainWindowEvent({ sender: aux }, main), false);
  assert.equal(isMainWindowEvent(null, main), false);
});

test('main-frame IPC guard rejects child frames and other renderers', () => {
  const mainFrame = {}, subFrame = {}, other = {};
  const contents = { mainFrame };
  assert.equal(isMainFrameEvent({ sender: contents, senderFrame: mainFrame }, contents), true);
  assert.equal(isMainFrameEvent({ sender: contents, senderFrame: subFrame }, contents), false);
  assert.equal(isMainFrameEvent({ sender: other, senderFrame: mainFrame }, contents), false);
});

test('renderer log entries are bounded and sanitized before writing', () => {
  const clean = sanitizeRendererLogEntry({ kind: 'error', level: 'invalid', message: 'bad\r\nline', details: { text: 'x\ny' } });
  assert.deepEqual(clean, { kind: 'error', level: 'ERROR', message: 'bad line', details: '{"text":"x y"}' });
  assert.ok(sanitizeRendererLogEntry({ message: 'm'.repeat(5000) }).message.length <= 2000);
  const cyclic = {}; cyclic.self = cyclic;
  assert.match(sanitizeRendererLogEntry({ details: cyclic }).details, /circular/);
});

test('notification text removes actual control characters without damaging ordinary letters', () => {
  assert.equal(cleanNotificationText('Tea\r\nTea\tLot\u0000 A'), 'Tea Tea Lot A');
  assert.equal(cleanNotificationText('Tameshk'), 'Tameshk');
  assert.equal(cleanNotificationText('abcdef', 3), 'abc');
});
