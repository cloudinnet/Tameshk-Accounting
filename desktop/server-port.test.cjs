'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validPort, readPreferredPort, savePreferredPort } = require('./server-port.cjs');

test('saved local server port is validated and survives application restarts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tameshk-port-'));
  const file = path.join(dir, 'server-port.json');
  try {
    assert.equal(readPreferredPort(file), null);
    assert.equal(savePreferredPort(file, 54321), 54321);
    assert.equal(readPreferredPort(file), 54321);
    fs.writeFileSync(file, '{"port":80}');
    assert.equal(readPreferredPort(file), null);
    assert.equal(validPort(0), null);
    assert.equal(validPort('nope'), null);
  } finally { fs.rmSync(dir, { recursive:true, force:true }); }
});

test('invalid persisted data does not become a server port', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tameshk-port-'));
  const file = path.join(dir, 'server-port.json');
  try {
    fs.writeFileSync(file, '{broken');
    assert.equal(readPreferredPort(file), null);
    assert.throws(() => savePreferredPort(file, 70000), /Invalid local server port/);
  } finally { fs.rmSync(dir, { recursive:true, force:true }); }
});
