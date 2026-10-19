[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectRoot = (Get-Location).Path,
    [switch]$InstallDependencies,
    [switch]$Browser,
    [switch]$Build
)

$ErrorActionPreference = 'Stop'
$Root = [System.IO.Path]::GetFullPath($ProjectRoot)
if (-not (Test-Path -LiteralPath (Join-Path $Root 'package.json')) -or
    -not (Test-Path -LiteralPath (Join-Path $Root 'package-lock.json'))) {
    throw "Project root must contain package.json and package-lock.json. Supplied path: $Root"
}
Set-Location $Root
$Package = Get-Content '.\package.json' -Raw | ConvertFrom-Json

$ToolRoot = Join-Path $env:USERPROFILE 'DevTools\TameshkSharedTools'
$ManifestPath = Join-Path $ToolRoot 'toolchain-manifest.json'
$Toolchain = $null
if (Test-Path -LiteralPath $ManifestPath) {
    try { $Toolchain = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json }
    catch { Write-Warning "Could not read shared toolchain manifest: $($_.Exception.Message)" }
}
if ($Toolchain -and $Toolchain.versionedGlobalInstallPrefix -and (Test-Path -LiteralPath $Toolchain.versionedGlobalInstallPrefix)) {
    $env:Path = "$($Toolchain.versionedGlobalInstallPrefix);$env:Path"
}
if ($Toolchain -and $Toolchain.nsisExecutable -and (Test-Path -LiteralPath $Toolchain.nsisExecutable)) {
    $env:MAKENSIS_PATH = $Toolchain.nsisExecutable
    $env:Path = "$(Split-Path -Parent $Toolchain.nsisExecutable);$env:Path"
}
if ($Toolchain -and $Toolchain.playwrightBrowsersDirectory -and (Test-Path -LiteralPath $Toolchain.playwrightBrowsersDirectory)) {
    $env:PLAYWRIGHT_BROWSERS_PATH = $Toolchain.playwrightBrowsersDirectory
    $env:PLAYWRIGHT_SKIP_BROWSER_GC = '1'
}

Write-Host ''
Write-Host '=== Tameshk Windows QA v1.50.7 Release Candidate ===' -ForegroundColor Cyan
Write-Host "Project: $Root"
node --version
npm --version
if ($Toolchain) {
    Write-Host "Shared tools root: $($Toolchain.toolRoot)"
    Write-Host "Shared Electron: $($Toolchain.electronVersionOutput)"
    Write-Host "Shared electron-builder: $($Toolchain.electronBuilderVersionOutput)"
    Write-Host "Shared Playwright Python: $($Toolchain.playwrightPython)"
}

$localBuilderManifest = Join-Path $Root 'node_modules\electron-builder\package.json'
$localElectronManifest = Join-Path $Root 'node_modules\electron\package.json'
$expectedElectronVersion = [string]$Package.devDependencies.electron
$expectedBuilderVersion = [string]$Package.devDependencies.'electron-builder'
$installedElectronVersion = $null
$installedBuilderVersion = $null
if (Test-Path -LiteralPath $localElectronManifest) { try { $installedElectronVersion = [string](Get-Content -LiteralPath $localElectronManifest -Raw | ConvertFrom-Json).version } catch {} }
if (Test-Path -LiteralPath $localBuilderManifest) { try { $installedBuilderVersion = [string](Get-Content -LiteralPath $localBuilderManifest -Raw | ConvertFrom-Json).version } catch {} }
$dependencyVersionsMismatch = ($installedElectronVersion -ne $expectedElectronVersion) -or ($installedBuilderVersion -ne $expectedBuilderVersion)
if ($InstallDependencies -or -not (Test-Path -LiteralPath $localBuilderManifest) -or -not (Test-Path -LiteralPath $localElectronManifest) -or $dependencyVersionsMismatch) {
    Write-Host ''
    Write-Host "Installing this project's locked dependencies (prefer existing npm cache)..." -ForegroundColor Yellow
    npm ci --prefer-offline
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }
} else {
    Write-Host 'Project node_modules already has Electron and electron-builder; skipping npm ci.' -ForegroundColor Green
}
$installedElectronVersion = [string](Get-Content -LiteralPath $localElectronManifest -Raw | ConvertFrom-Json).version
$installedBuilderVersion = [string](Get-Content -LiteralPath $localBuilderManifest -Raw | ConvertFrom-Json).version
Write-Host "Project Electron package: $installedElectronVersion (lock target $expectedElectronVersion)"
Write-Host "Project electron-builder: $installedBuilderVersion (lock target $expectedBuilderVersion)"
if ($installedElectronVersion -ne $expectedElectronVersion -or $installedBuilderVersion -ne $expectedBuilderVersion) { throw 'Installed project Electron/electron-builder versions do not match package.json. Re-run with -InstallDependencies.' }

$sourceDirs = @('.\desktop', '.\resources\app', '.\scripts', '.\test-support')
$sourceFiles = @(
    foreach ($dir in $sourceDirs) {
        if (Test-Path -LiteralPath $dir) {
            Get-ChildItem -Path $dir -Recurse -File -Include '*.js', '*.cjs', '*.mjs' -ErrorAction SilentlyContinue
        }
    }
)
Write-Host ''
Write-Host "Checking JavaScript syntax in $($sourceFiles.Count) files..." -ForegroundColor Cyan
foreach ($file in $sourceFiles) {
    & node --check $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $($file.FullName)" }
}
Write-Host "PASS: syntax check ($($sourceFiles.Count) files)." -ForegroundColor Green

$browserSpecificTests = @(
    'currency-recovered-1506.test.cjs',
    'currency-final-invoice-discount.test.cjs',
    'dashboard-report-layout-1.50.5.test.cjs',
    'expense-list-regression.test.cjs',
    'expense-report-regression.test.cjs',
    'invoice-discount-visibility.test.cjs',
    'invoice-locale-output-1.50.4.test.cjs',
    'invoice-recovered-1506.test.cjs',
    'locale-layout-1.50.4.test.cjs',
    'localization-populated-1.50.4.test.cjs',
    'localization-release-1.50.3.test.cjs',
    'numeric-locale-1.50.4.test.cjs',
    'parent-producer-locale-1.50.4.test.cjs',
    'service-images.test.cjs',
    'startup-layout-recovered-1506.test.cjs',
    'tabular-locale-1.50.4.test.cjs',
    'transaction-colors.test.cjs'
)
$testDirs = @('.\resources\app', '.\desktop', '.\scripts')
$allTests = @(
    foreach ($dir in $testDirs) {
        if (Test-Path -LiteralPath $dir) {
            Get-ChildItem -Path $dir -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '\.test\.(js|cjs)$' }
        }
    }
)
$runnableTests = @($allTests | Where-Object { $_.Name -notin $browserSpecificTests } | ForEach-Object { $_.FullName })
Write-Host ''
Write-Host "Running $($runnableTests.Count) Node unit/regression test files (browser integration tests are separate)..." -ForegroundColor Cyan
if ($runnableTests.Count -gt 0) {
    & node --test $runnableTests
    if ($LASTEXITCODE -ne 0) { throw "Node unit/regression suite failed with exit code $LASTEXITCODE" }
} else {
    throw 'No runnable Node test files were found.'
}

Write-Host ''
Write-Host 'Running browser-independent currency migration test...' -ForegroundColor Cyan
& node --test '--test-name-pattern=migration uses|record amounts' '.\resources\app\currency-recovered-1506.test.cjs'
if ($LASTEXITCODE -ne 0) { throw "Currency migration tests failed with exit code $LASTEXITCODE" }

Write-Host ''
Write-Host 'Running focused installer/security/accounting regression tests...' -ForegroundColor Cyan
$focusedTests = @(
    '.\desktop\security-policy.test.cjs',
    '.\resources\app\report-discount-regression.test.cjs',
    '.\resources\app\followup-final-regressions.test.cjs',
    '.\resources\app\security-accounting-regressions.test.cjs',
    '.\scripts\build-installer-paths.test.cjs',
    '.\scripts\nsis-payload.test.cjs'
) | Where-Object { Test-Path -LiteralPath $_ }
& node --test $focusedTests
if ($LASTEXITCODE -ne 0) { throw "Focused regression tests failed with exit code $LASTEXITCODE" }

if ($Browser) {
    Write-Host ''
    Write-Host 'Running browser regressions using the permanently installed shared Playwright environment...' -ForegroundColor Cyan
    $py = $null
    if ($Toolchain -and $Toolchain.playwrightPython -and (Test-Path -LiteralPath $Toolchain.playwrightPython)) {
        $py = $Toolchain.playwrightPython
    }
    if (-not $py) { throw "Shared Playwright Python not found in $ManifestPath. Re-run install-tameshk-shared-toolchain-v2.ps1." }
    if (-not $env:PLAYWRIGHT_BROWSERS_PATH) { throw 'Persistent PLAYWRIGHT_BROWSERS_PATH is missing. Check toolchain manifest.' }
    & $py -c 'import playwright; print("Playwright import OK")'
    if ($LASTEXITCODE -ne 0) { throw 'The persistent Playwright Python environment could not import playwright.' }

    # Probe the Chromium path from a temporary Python file instead of embedding
    # Python expressions in a PowerShell argument. This avoids parser/quoting
    # problems on PowerShell 7 and keeps the probe readable.
    $probeLines = @(
        'from playwright.sync_api import sync_playwright',
        'with sync_playwright() as p:',
        '    print(p.chromium.executable_path)'
    )
    $probeCode = $probeLines -join [Environment]::NewLine
    $probeScript = Join-Path ([System.IO.Path]::GetTempPath()) ("tameshk-playwright-probe-" + [guid]::NewGuid().ToString('N') + '.py')
    [System.IO.File]::WriteAllText($probeScript, $probeCode, [System.Text.UTF8Encoding]::new($false))
    try {
        $chromiumOutput = @(& $py $probeScript)
        $probeExitCode = $LASTEXITCODE
    } finally {
        Remove-Item -LiteralPath $probeScript -Force -ErrorAction SilentlyContinue
    }
    if ($probeExitCode -ne 0) { throw 'Could not query the Chromium executable path from shared Playwright.' }
    $chromium = [string]($chromiumOutput | Select-Object -Last 1)
    $chromium = $chromium.Trim()
    if (-not $chromium) { throw 'Playwright returned an empty Chromium executable path.' }
    if (-not (Test-Path -LiteralPath $chromium)) { throw "Chromium executable does not exist at '$chromium'. Run: & `"$py`" -m playwright install chromium" }
    $env:TAMESHK_CHROMIUM = $chromium
    Write-Host "Persistent Chromium: $chromium"
    & $py '.\test-support\browser-regressions.py'
    if ($LASTEXITCODE -ne 0) { throw "Browser regression suite failed with exit code $LASTEXITCODE" }
} else {
    Write-Host 'Browser suite not requested. Add -Browser to use the preinstalled Playwright and Chromium.' -ForegroundColor DarkYellow
}

if ($Build) {
    Write-Host ''
    Write-Host 'Building Windows app directory and Setup installer...' -ForegroundColor Cyan
    npm run dist:win
    if ($LASTEXITCODE -ne 0) { throw "Windows build failed with exit code $LASTEXITCODE" }
    $appExe = Join-Path $Root 'dist\win-unpacked\حسابداری تمشک.exe'
    $setupName = "Tameshk-Accounting-Setup-$($Package.version)-x64.exe"
    $setupExe = Join-Path (Join-Path $Root 'dist') $setupName
    if (-not (Test-Path -LiteralPath $appExe)) { throw "Packaged app executable missing: $appExe" }
    if (-not (Test-Path -LiteralPath $setupExe)) { throw "Setup installer missing: $setupExe" }
    Write-Host 'PASS: application EXE and named Setup installer were created.' -ForegroundColor Green
    Get-FileHash -LiteralPath $setupExe -Algorithm SHA256
}

Write-Host ''
Write-Host 'QA run completed. Review all TAP counts above and report any error/failure.' -ForegroundColor Green
