'use strict';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' data:",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'self' blob:"
].join('; ');

const HTML_SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
});

function configureSessionSecurity(targetSession, onDenied = () => {}) {
  if (!targetSession || typeof targetSession.setPermissionRequestHandler !== 'function' ||
      typeof targetSession.setPermissionCheckHandler !== 'function') {
    throw new TypeError('A valid Electron session is required');
  }
  targetSession.setPermissionRequestHandler((webContents, permission, callback) => {
    try { onDenied({ permission: String(permission || ''), url: String(webContents?.getURL?.() || '') }); } catch {}
    try { callback(false); } catch {}
  });
  targetSession.setPermissionCheckHandler(() => false);
}

module.exports = Object.freeze({ CONTENT_SECURITY_POLICY, HTML_SECURITY_HEADERS, configureSessionSecurity });
