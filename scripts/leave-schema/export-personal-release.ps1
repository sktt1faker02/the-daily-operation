param([switch]$UnpackAndSync)
# Native read-only solution export; copy only this release's Leave assembly and
# existing Leave step references back to source. No environment writes.
$ErrorActionPreference = 'Stop'
$portalRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$portalPac = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/pac.cmd'
$portalWork = Join-Path $PSScriptRoot '.work/personal-reads'
$portalZip = Join-Path $portalWork 'personal-release.zip'
$portalUnpack = Join-Path $portalWork 'release-unpacked'
$portalSource = Join-Path $portalRoot 'solution/A365_DailyOperations/src'
$portalEvidence = Get-Content -Raw -LiteralPath (Join-Path $portalRoot 'docs/leave-history-access-verification.json') | ConvertFrom-Json
if ($portalEvidence.AssemblyVersion -cne '1.0.3.1' -or $portalEvidence.Environment -cne 'https://org9a7651f0.crm5.dynamics.com') { throw 'Verified personal-read release required.' }
if (-not $UnpackAndSync) {
    if (Test-Path -LiteralPath $portalZip) { throw 'Export already exists; inspect it instead of overwriting.' }
    & $portalPac solution export --environment $portalEvidence.Environment --name A365_DailyOperations --path $portalZip --managed false
    if ($LASTEXITCODE -ne 0) { throw 'Native release export failed.' }
    return
}
if (-not (Test-Path -LiteralPath $portalZip) -or (Test-Path -LiteralPath $portalUnpack)) { throw 'Export first; do not overwrite an existing unpack.' }
& $portalPac solution unpack --zipfile $portalZip --folder $portalUnpack --packagetype Unmanaged
if ($LASTEXITCODE -ne 0) { throw 'Native release unpack failed.' }
$portalAssemblyPath = 'PluginAssemblies/A365LeavePlugins-1D8034C7-E2CD-F111-A05A-000D3A8014E4'
$portalDll = Join-Path $portalUnpack "$portalAssemblyPath/A365LeavePlugins.dll"
if ((Get-FileHash -LiteralPath $portalDll).Hash -cne $portalEvidence.SHA256) { throw 'Exported DLL differs from tested/deployed server.' }
foreach ($file in Get-ChildItem -LiteralPath (Join-Path $portalUnpack $portalAssemblyPath) -File) {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $portalSource "$portalAssemblyPath/$($file.Name)")
}
foreach ($file in Get-ChildItem -LiteralPath (Join-Path $portalUnpack 'SdkMessageProcessingSteps') -Filter '*.xml') {
    if ((Get-Content -Raw -LiteralPath $file.FullName) -notmatch 'A365\.Leave\.Plugins\.') { continue }
    $destination = Join-Path $portalSource "SdkMessageProcessingSteps/$($file.Name)"
    if (-not (Test-Path -LiteralPath $destination)) { throw 'Unexpected new Leave step; review before adding to source.' }
    Copy-Item -LiteralPath $file.FullName -Destination $destination
}
Write-Host 'Synced native tested/deployed Leave DLL, assembly metadata and existing Leave step references only. Roles, tables, API definitions and Payroll components untouched.'
