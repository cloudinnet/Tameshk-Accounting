#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Reuse Playwright's Node runtime bundled with the installed Python package,
# without adding a runtime dependency to the accounting application.
PLAYWRIGHT_PACKAGE="$(python3 - <<'PY'
from pathlib import Path
import playwright
print(Path(playwright.__file__).parent / 'driver' / 'package')
PY
)"
if [[ ! -f "$PLAYWRIGHT_PACKAGE/index.js" ]]; then
  echo "ERROR: Python Playwright's bundled Node runtime was not found." >&2
  exit 2
fi
TMP_QA="$(mktemp -d)"
trap 'rm -rf "$TMP_QA"' EXIT
mkdir -p "$TMP_QA/node_modules"
ln -s "$PLAYWRIGHT_PACKAGE" "$TMP_QA/node_modules/playwright-core"
export NODE_PATH="$TMP_QA/node_modules${NODE_PATH:+:$NODE_PATH}"
export TAMESHK_PLAYWRIGHT_CORE="$TMP_QA/node_modules/playwright-core"
export TAMESHK_PLAYWRIGHT="$TMP_QA/node_modules/playwright-core"

mapfile -t JS_FILES < <(find resources/app desktop scripts -type f \( -name '*.js' -o -name '*.cjs' -o -name '*.mjs' \) 2>/dev/null | sort)
for f in "${JS_FILES[@]}"; do node --check "$f"; done
echo "PASS syntax: ${#JS_FILES[@]} JavaScript/CommonJS files"

# These integration files navigate to file:// or loopback HTTP URLs. This
# runner's managed Chromium policy sets URLBlocklist=["*"], so navigation is
# blocked before application code runs. They are deliberately not treated as
# product failures; browser behavior is covered by the setContent regression.
files=()
while IFS= read -r f; do
  case "$f" in
    resources/app/currency-recovered-1506.test.cjs|\
    resources/app/dashboard-report-layout-1.50.5.test.cjs|\
    resources/app/expense-list-regression.test.cjs|\
    resources/app/expense-report-regression.test.cjs|\
    resources/app/invoice-discount-visibility.test.cjs|\
    resources/app/invoice-locale-output-1.50.4.test.cjs|\
    resources/app/invoice-recovered-1506.test.cjs|\
    resources/app/locale-layout-1.50.4.test.cjs|\
    resources/app/localization-populated-1.50.4.test.cjs|\
    resources/app/localization-release-1.50.3.test.cjs|\
    resources/app/numeric-locale-1.50.4.test.cjs|\
    resources/app/parent-producer-locale-1.50.4.test.cjs|\
    resources/app/service-images.test.cjs|\
    resources/app/startup-layout-recovered-1506.test.cjs|\
    resources/app/transaction-colors.test.cjs) ;;
    *) files+=("$f") ;;
  esac
done < <(find resources/app desktop -maxdepth 1 -type f \( -name '*.test.js' -o -name '*.test.cjs' \) | sort)
node --test "${files[@]}"
# Keep the data-migration/precision unit tests from the otherwise navigation-
# blocked currency integration file in the runnable suite.
node --test --test-name-pattern='migration uses|record amounts' resources/app/currency-recovered-1506.test.cjs
python3 test-support/browser-regressions.py
