'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CONTENT_SECURITY_POLICY, HTML_SECURITY_HEADERS, configureSessionSecurity } = require('./security-policy.cjs');

test('HTML security policy blocks remote scripts, plugins, framing, and non-local connections', () => {
  assert.match(CONTENT_SECURITY_POLICY, /script-src 'self' 'unsafe-inline'/);
  assert.match(CONTENT_SECURITY_POLICY, /object-src 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /connect-src 'self'/);
  assert.equal(HTML_SECURITY_HEADERS['X-Frame-Options'], 'DENY');
  assert.equal(HTML_SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff');
  assert.match(HTML_SECURITY_HEADERS['Permissions-Policy'], /camera=\(\)/);
});

test('Electron session denies permission requests and permission checks', () => {
  let requestHandler, checkHandler, denied;
  const fakeSession = {
    setPermissionRequestHandler(handler) { requestHandler = handler; },
    setPermissionCheckHandler(handler) { checkHandler = handler; }
  };
  configureSessionSecurity(fakeSession, event => { denied = event; });
  let grant;
  requestHandler({ getURL: () => 'http://127.0.0.1:1234/' }, 'geolocation', value => { grant = value; });
  assert.equal(grant, false);
  assert.deepEqual(denied, { permission: 'geolocation', url: 'http://127.0.0.1:1234/' });
  assert.equal(checkHandler({}, 'notifications', 'http://127.0.0.1:1234/'), false);
});
