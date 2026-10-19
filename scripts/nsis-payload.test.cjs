'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generatePayloadInclude, listFilesRecursively } = require('./nsis-payload.cjs');

function withProject(fn) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'tameshk-nsis-payload-'));
  const dist = path.join(project, 'dist', 'win-unpacked');
  const installer = path.join(project, 'installer');
  fs.mkdirSync(dist, { recursive: true });
  fs.mkdirSync(installer, { recursive: true });
  try { fn({ project, dist, installer }); }
  finally { fs.rmSync(project, { recursive: true, force: true }); }
}

test('payload manifest explicitly includes root and nested files without wildcards', () => {
  withProject(({ dist, installer }) => {
    fs.writeFileSync(path.join(dist, 'app.exe'), 'binary');
    fs.writeFileSync(path.join(dist, 'حسابداری تمشک.exe'), 'unicode-named executable');
    fs.mkdirSync(path.join(dist, 'resources', 'app'), { recursive: true });
    fs.writeFileSync(path.join(dist, 'resources', 'app', 'index.html'), '<!doctype html>');
    const output = generatePayloadInclude(dist, installer);
    assert.match(output, /!macro InstallPayload/);
    assert.match(output, /SetOutPath "\$INSTDIR"/);
    assert.match(output, /File "\.\.\\dist\\win-unpacked\\app\.exe"/);
    assert.match(output, /حسابداری تمشک\.exe/);
    assert.match(output, /SetOutPath "\$INSTDIR\\resources\\app"/);
    assert.match(output, /File "\.\.\\dist\\win-unpacked\\resources\\app\\index\.html"/);
    assert.doesNotMatch(output, /File \/r|\*\.\*/);
    assert.match(output, /!macroend/);
  });
});

test('payload manifest escapes NSIS dollar expansion in filesystem paths', () => {
  withProject(({ dist, installer }) => {
    const dir = path.join(dist, 'folder$literal');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'name$cash.txt'), 'ok');
    const output = generatePayloadInclude(dist, installer);
    assert.match(output, /folder\$\$literal/);
    assert.match(output, /name\$\$cash\.txt/);
  });
});

test('empty or missing packaged app directories are rejected', () => {
  withProject(({ project, dist, installer }) => {
    assert.throws(() => listFilesRecursively(path.join(project, 'missing')), /does not exist/);
    assert.throws(() => generatePayloadInclude(dist, installer), /contains no files/);
  });
});
