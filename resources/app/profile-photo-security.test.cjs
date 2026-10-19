const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateProfilePhoto, MAX_BYTES } = require('./profile-photo-security.js');

function dataUrl(type, bytes) { return `data:image/${type};base64,${Buffer.from(bytes).toString('base64')}`; }

test('accepts bounded PNG, JPEG, and WebP image data with matching signatures', () => {
  assert.equal(validateProfilePhoto(dataUrl('png', [137,80,78,71,13,10,26,10])), dataUrl('png', [137,80,78,71,13,10,26,10]));
  assert.match(validateProfilePhoto(dataUrl('jpeg', [255,216,255])), /^data:image\/jpeg;base64,/);
  assert.match(validateProfilePhoto(dataUrl('webp', [...Buffer.from('RIFF'),0,0,0,0,...Buffer.from('WEBP')])), /^data:image\/webp;base64,/);
  assert.throws(() => validateProfilePhoto(dataUrl('png', [137,80,78,71,13,10,26,10,...Buffer.alloc(MAX_BYTES)])));
});

test('rejects markup, SVG, mismatched signatures, and invalid base64', () => {
  for (const value of [
    '<img src=x onerror=alert(1)>',
    'data:image/svg+xml;base64,PHN2Zy8+',
    dataUrl('png', Buffer.from('<svg onload=alert(1)>')),
    'data:image/png;base64,!!!!'
  ]) assert.throws(() => validateProfilePhoto(value));
});

test('profile picker escapes only validated photos and imported catalogs validate photo payloads', () => {
  const appDir = __dirname;
  const profiles = fs.readFileSync(path.join(appDir, 'inventory-profiles.js'), 'utf8');
  const portable = fs.readFileSync(path.join(appDir, 'portable-data.js'), 'utf8');
  const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
  assert.match(profiles, /safeProfilePhoto\(p\.photo\)/);
  assert.match(profiles, /src="\$\{esc\(safeProfilePhoto\(p\.photo\)\)\}"/);
  assert.match(portable, /validateProfilePhoto\(profile\.photo\)/);
  assert.match(html, /<script src="profile-photo-security\.js"><\/script><script src="inventory-profiles\.js"><\/script>/);
});
