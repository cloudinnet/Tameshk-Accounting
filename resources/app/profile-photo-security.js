(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TameshkProfilePhotoSecurity = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const MAX_BYTES = 500 * 1024;
  const MAX_DATA_URL_LENGTH = Math.ceil(MAX_BYTES * 4 / 3) + 128;

  function validateProfilePhoto(value) {
    if (typeof value !== 'string' || value.length > MAX_DATA_URL_LENGTH) throw new Error('Invalid profile photo.');
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
    if (!match) throw new Error('Invalid profile photo.');
    let decoded;
    try { decoded = atob(match[2]); } catch { throw new Error('Invalid profile photo.'); }
    if (!decoded.length || decoded.length > MAX_BYTES) throw new Error('Invalid profile photo.');
    const byte = index => decoded.charCodeAt(index);
    const isPng = match[1].toLowerCase() === 'png' && decoded.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((expected, index) => byte(index) === expected);
    const isJpeg = match[1].toLowerCase() === 'jpeg' && decoded.length >= 3 &&
      byte(0) === 255 && byte(1) === 216 && byte(2) === 255;
    const isWebp = match[1].toLowerCase() === 'webp' && decoded.length >= 12 &&
      decoded.slice(0, 4) === 'RIFF' && decoded.slice(8, 12) === 'WEBP';
    if (!isPng && !isJpeg && !isWebp) throw new Error('Invalid profile photo.');
    return value;
  }

  return Object.freeze({ validateProfilePhoto, MAX_BYTES });
});
