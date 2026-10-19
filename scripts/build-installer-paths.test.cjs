'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const buildScript = fs.readFileSync(path.join(__dirname, 'build-installer.cjs'), 'utf8');
const nsi = fs.readFileSync(path.join(root, 'installer', 'setup.nsi'), 'utf8');
const payloadBuilder = fs.readFileSync(path.join(__dirname, 'nsis-payload.cjs'), 'utf8');

test('NSIS builder creates an explicit payload manifest before invoking makensis', () => {
  assert.match(buildScript, /const installerDir = path\.join\(root, 'installer'\)/);
  assert.match(buildScript, /generatePayloadInclude\(appOutDir, installerDir\)/);
  assert.match(buildScript, /payload\.generated\.nsh/);
  assert.match(buildScript, /inputCharsetArg = process\.platform === 'win32' \? '\/INPUTCHARSET' : '-INPUTCHARSET'/);
  assert.match(buildScript, /\[inputCharsetArg, 'UTF8', defineVersion, 'setup\.nsi'\]/);
  assert.match(buildScript, /cwd: installerDir/);
  assert.match(buildScript, /Packaged app files are missing/);
  assert.match(buildScript, /Run "npx electron-builder --win dir --x64" first/);
  assert.match(buildScript, /Tameshk-Accounting-Setup-\$\{pkg\.version\}-x64\.exe/);
  assert.match(buildScript, /Generated explicit NSIS payload manifest/);
  assert.match(payloadBuilder, /File "\$\{escapeNsisLiteral\(toNsisPath\(file, workingDir\)\)\}"/);
});

test('installer uses generated explicit payload and the requested Setup filename', () => {
  const installerDir = path.join(root, 'installer');
  const inputDir = path.resolve(installerDir, '../dist/win-unpacked');
  const iconPath = path.resolve(installerDir, '../resources/app/icon.ico');
  const packageVersion = require(path.join(root, 'package.json')).version;
  const outputDir = path.dirname(path.resolve(installerDir, `../dist/Tameshk-Accounting-Setup-${packageVersion}-x64.exe`));
  assert.equal(inputDir, path.join(root, 'dist', 'win-unpacked'));
  assert.equal(iconPath, path.join(root, 'resources', 'app', 'icon.ico'));
  assert.equal(outputDir, path.join(root, 'dist'));
  assert.match(nsi, /!include "payload\.generated\.nsh"/);
  assert.match(nsi, /!insertmacro InstallPayload/);
  assert.doesNotMatch(nsi, /File \/r/);
  assert.match(nsi, /!define APP_EXE "حسابداری تمشک\.exe"/);
  assert.match(nsi, /OutFile "\.\.\/dist\/Tameshk-Accounting-Setup-\$\{APP_VERSION\}-x64\.exe"/);
  assert.match(nsi, /!define MUI_ICON "\.\.\/resources\/app\/icon\.ico"/);
});
