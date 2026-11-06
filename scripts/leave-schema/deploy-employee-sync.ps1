param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$syncRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$syncEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$syncEnvironmentId = 'b58b083e-d27d-eabd-a143-2a49dcb9d89a'
$syncAssemblyId = '1d8034c7-e2cd-f111-a05a-000d3a8014e4'
$syncCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$syncWork = Join-Path $PSScriptRoot '.work/employee-sync-release'
New-Item -ItemType Directory -Force -Path $syncWork | Out-Null
$syncConfiguration = Get-Content -Raw -LiteralPath (Join-Path $syncRoot 'power.config.json') | ConvertFrom-Json
if ($syncConfiguration.environmentId -cne $syncEnvironmentId) { throw 'Unexpected Code App environment.' }
$syncDll = Join-Path $syncRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
$syncExpectedHash = '64A18FCA63B73F0A7F2267AD9A279F47CFDE626E2EBAABC663076DE3CD102968'
if ((Get-FileHash -LiteralPath $syncDll -Algorithm SHA256).Hash -cne $syncExpectedHash) { throw 'Local DLL differs from the tested employee-sync release.' }
function Invoke-SyncRelease([string]$Path, [string]$Method = 'GET', [string]$BodyFile = '', [string]$ETag = '') {
    $syncArguments = @('api', 'request', '--target', 'dataverse', '--environment', $syncEnvironment, '--path', $Path, '--method', $Method, '--context', 'app=dataverse-skills/1.16.0;skill=dv-solution;agent=codex')
    if ($BodyFile) { $syncArguments += @('--body-file', $BodyFile) }
    if ($ETag) { $syncArguments += @('--header', "If-Match:$ETag") }
    $syncOutput = & $syncCli @syncArguments
    if ($LASTEXITCODE -ne 0) { throw "Employee-sync release request failed: $Method $Path" }
    if ($syncOutput) { return (($syncOutput -join "`n") | ConvertFrom-Json) }
}
$syncPath = '/api/data/v9.2/pluginassemblies(' + $syncAssemblyId + ')'
$syncLive = Invoke-SyncRelease ($syncPath + '?$select=pluginassemblyid,name,version,content,publickeytoken')
if ($syncLive.name -cne 'A365.Leave.Plugins' -or $syncLive.pluginassemblyid -cne $syncAssemblyId -or $syncLive.version -cne '1.0.3.8') { throw 'Unexpected existing Leave assembly identity/version.' }
$syncBackup = Join-Path $syncWork 'before.dll'
if (-not (Test-Path -LiteralPath $syncBackup)) { [IO.File]::WriteAllBytes($syncBackup, [Convert]::FromBase64String($syncLive.content)) }
if (-not $Apply) {
    [pscustomobject]@{ Environment=$syncEnvironment; AssemblyId=$syncAssemblyId; Version=$syncLive.version; TestedSHA256=$syncExpectedHash; BackupSHA256=(Get-FileHash -LiteralPath $syncBackup -Algorithm SHA256).Hash; Applied=$false } | ConvertTo-Json
    return
}
$syncBody = Join-Path $syncWork 'update.json'
[IO.File]::WriteAllText($syncBody, (@{ content=[Convert]::ToBase64String([IO.File]::ReadAllBytes($syncDll)) } | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
Invoke-SyncRelease $syncPath 'PATCH' $syncBody $syncLive.'@odata.etag' | Out-Null
$syncVerified = Invoke-SyncRelease ($syncPath + '?$select=pluginassemblyid,name,version,content')
$syncDownloaded = Join-Path $syncWork 'verified.dll'
[IO.File]::WriteAllBytes($syncDownloaded, [Convert]::FromBase64String($syncVerified.content))
if ((Get-FileHash -LiteralPath $syncDownloaded -Algorithm SHA256).Hash -cne $syncExpectedHash) { throw 'Deployed plugin differs from the tested employee-sync DLL.' }
$syncEvidence = [pscustomobject]@{ Environment=$syncEnvironment; EnvironmentId=$syncEnvironmentId; AssemblyId=$syncAssemblyId; AssemblyVersion=$syncVerified.version; SHA256=$syncExpectedHash; VerifiedAt=[DateTime]::UtcNow.ToString('o'); BackupSHA256=(Get-FileHash -LiteralPath $syncBackup -Algorithm SHA256).Hash; BusinessDataWrites='None from deployment; employee sync is verified separately.' }
$syncEvidence | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $syncRoot 'docs/employee-leave-deployment.json') -Encoding UTF8
$syncEvidence | ConvertTo-Json
