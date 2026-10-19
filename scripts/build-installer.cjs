'use strict';
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { generatePayloadInclude } = require('./nsis-payload.cjs');

const root = path.resolve(__dirname, '..');
const installerDir = path.join(root, 'installer');
const pkg = require(path.join(root, 'package.json'));
if (!/^\d+\.\d+\.\d+$/.test(String(pkg.version || ''))) {
  console.error('package.json must contain a stable semantic version (x.y.z).');
  process.exit(2);
}
const definePrefix = process.platform === 'win32' ? '/D' : '-D';
const defineVersion = `${definePrefix}APP_VERSION=${pkg.version}`;
const inputCharsetArg = process.platform === 'win32' ? '/INPUTCHARSET' : '-INPUTCHARSET';
const appOutDir = path.join(root, 'dist', 'win-unpacked');
const appExecutableName = `${pkg.build?.executableName || pkg.productName || 'Tameshk Accounting'}.exe`;
const appExecutablePath = path.join(appOutDir, appExecutableName);
if (!fs.existsSync(appOutDir) || !fs.existsSync(appExecutablePath)) {
  console.error(`Packaged app files are missing. Expected the executable at: ${appExecutablePath}`);
  console.error('Run "npx electron-builder --win dir --x64" first, then run this script again.');
  process.exit(1);
}

const payloadIncludePath = path.join(installerDir, 'payload.generated.nsh');
let payload;
try {
  payload = generatePayloadInclude(appOutDir, installerDir);
  fs.writeFileSync(payloadIncludePath, payload, { encoding: 'utf8' });
  const payloadFileCount = (payload.match(/^\s+File /gm) || []).length;
  if (payloadFileCount < 1) throw new Error('Generated NSIS payload list is empty.');
  console.log(`Generated explicit NSIS payload manifest for ${payloadFileCount} files.`);
} catch (error) {
  console.error(`Could not prepare NSIS payload manifest: ${error.message}`);
  process.exit(1);
}

// NSIS is a system build tool, not an npm dependency. Prefer an explicit
// override, then standard Windows install locations, and finally PATH.
const candidates = [];
if (process.env.MAKENSIS_PATH) candidates.push(process.env.MAKENSIS_PATH);
if (process.platform === 'win32') {
  const roots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    'C:\\Program Files',
    'C:\\Program Files (x86)'
  ].filter(Boolean);
  for (const dir of roots) candidates.push(path.join(dir, 'NSIS', 'makensis.exe'));
}
candidates.push('makensis');
let result;
let selectedCommand = '';
for (const candidate of [...new Set(candidates)]) {
  if ((path.isAbsolute(candidate) || candidate.includes(path.sep)) && !fs.existsSync(candidate)) continue;
  const attempt = spawnSync(candidate, [inputCharsetArg, 'UTF8', defineVersion, 'setup.nsi'], {
    cwd: installerDir,
    stdio: 'inherit',
    windowsHide: true
  });
  if (!attempt.error) {
    result = attempt;
    selectedCommand = candidate;
    break;
  }
  if (attempt.error.code !== 'ENOENT') {
    result = attempt;
    selectedCommand = candidate;
    break;
  }
}
if (!result) {
  console.error('Could not find NSIS (makensis). Install NSIS 3+ or set MAKENSIS_PATH to the full path of makensis.exe.');
  process.exit(1);
}
if (result.error) {
  console.error(`Could not start NSIS from ${selectedCommand}: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const installer = path.join(root, 'dist', `Tameshk-Accounting-Setup-${pkg.version}-x64.exe`);
if (!fs.existsSync(installer)) {
  console.error(`NSIS reported success, but installer was not found: ${installer}`);
  process.exit(1);
}
const digest = crypto.createHash('sha256').update(fs.readFileSync(installer)).digest('hex');
fs.writeFileSync(`${installer}.sha256`, `${digest}  ${path.basename(installer)}\n`, 'utf8');
console.log(`SHA-256 written: ${path.basename(installer)}.sha256`);
try { fs.unlinkSync(payloadIncludePath); } catch { /* Keep the manifest if cleanup fails for diagnostics. */ }
