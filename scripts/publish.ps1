param()
$ErrorActionPreference = 'Stop'
$speechRoot = Split-Path $PSScriptRoot -Parent
$speechHost = Join-Path $speechRoot '..\AppDock.at365'
. (Join-Path $speechHost 'scripts\publish-paths.ps1')
$speechOutput = Get-PublishDirectory $speechRoot
$speechDestination = Join-Path $speechOutput 'applet'
Push-Location $speechRoot
try {
    & (Join-Path $speechHost 'dev.bat') exec node --test (Join-Path $speechRoot 'tests\processing.test.cjs') (Join-Path $speechRoot 'tests\applet.test.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Applet tests failed.' }
    New-Item -ItemType Directory -Path (Join-Path $speechDestination 'src') -Force | Out-Null
    foreach ($speechFile in @('extension.json', 'index.cjs')) {
        Copy-Item -LiteralPath (Join-Path $speechRoot $speechFile) -Destination (Join-Path $speechDestination $speechFile) -Force
    }
    Copy-Item -LiteralPath (Join-Path $speechRoot 'src\processing.cjs') -Destination (Join-Path $speechDestination 'src\processing.cjs') -Force
    & (Join-Path $speechHost 'scripts\pack-applet-update.ps1') -SourceDirectory $speechDestination -OutputDirectory $speechOutput
    if (-not $?) { throw 'Applet update packaging failed.' }
    Write-Host "Published: $speechOutput"
} finally { Pop-Location }
