# Actual Chromium narrow-layout regression

From the project root, with Node 24 and Chromium installed:

```sh
node test-support/create-narrow-layout-fixture.cjs /tmp/tameshk-narrow-fixture
CHROMIUM_BIN=/usr/bin/chromium \
NARROW_LAYOUT_HARNESS=/tmp/tameshk-narrow-fixture/isolated-app.html \
node --test /tmp/tameshk-narrow-fixture/transaction-form-layout.test.js
```

The generator copies the **current** `resources/app` assets and tests into a disposable directory, then creates `isolated-app.html` from the current index. It does not change production files or styles. Regenerate after source changes; the copied test and copied assets must come from the same source revision.

The fixture runs as the top-level application, not an iframe, with isolated in-memory local/session storage, a Persian `qa-visual` transaction (including an image checkbox), and `__qaErrors` collecting uncaught exceptions/rejections. It does not use or clear live profile data. No desktop bridge is mocked. The profile-selection overlay is removed only in the disposable fixture.

The unchanged opt-in test exercises desktop-to-360px resize cycles, table containment and image-checkbox reachability, print overflow behavior, unchanged saved transactions, unwrapped preview, and the normal transaction-entry form. It intentionally permits existing background dashboard overflow at 360px while still requiring editor controls to remain contained.

No Playwright dependency is needed for this particular test: it uses Chromium's DevTools WebSocket directly. `NARROW_LAYOUT_HARNESS` must point to the generated absolute HTML path or the browser test remains skipped.
