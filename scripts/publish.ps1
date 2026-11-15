param()
$ErrorActionPreference = 'Stop'
$speakRoot = Split-Path $PSScriptRoot -Parent
$speakHost = Join-Path $speakRoot '..\AppDock.at365'
. (Join-Path $speakHost 'scripts\publish-paths.ps1')
$speakOutput = Get-PublishDirectory $speakRoot
$speakDestination = Join-Path $speakOutput 'extensions\at365.speak'
Push-Location $speakRoot
try {
    & (Join-Path $speakHost 'dev.bat') exec node --test (Join-Path $speakRoot 'tests\processing.test.cjs') (Join-Path $speakRoot 'tests\dictionary-store.test.cjs') (Join-Path $speakRoot 'tests\applet.test.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Applet tests failed.' }
    New-Item -ItemType Directory -Path (Join-Path $speakDestination 'src') -Force | Out-Null
    foreach ($speakFile in @('extension.json', 'index.cjs')) {
        Copy-Item -LiteralPath (Join-Path $speakRoot $speakFile) -Destination (Join-Path $speakDestination $speakFile) -Force
    }
    Copy-Item -LiteralPath (Join-Path $speakRoot 'src\processing.cjs') -Destination (Join-Path $speakDestination 'src\processing.cjs') -Force
    Copy-Item -LiteralPath (Join-Path $speakRoot 'src\dictionary-engine.cjs') -Destination (Join-Path $speakDestination 'src\dictionary-engine.cjs') -Force
    Copy-Item -LiteralPath (Join-Path $speakRoot 'src\dictionary-store.cjs') -Destination (Join-Path $speakDestination 'src\dictionary-store.cjs') -Force
    & (Join-Path $speakHost 'scripts\pack-applet-update.ps1') -SourceDirectory $speakDestination -OutputDirectory $speakOutput
    if (-not $?) { throw 'Applet update packaging failed.' }
    Write-Host "Published: $speakOutput"
} finally { Pop-Location }
