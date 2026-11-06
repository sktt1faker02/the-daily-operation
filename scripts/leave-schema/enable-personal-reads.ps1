param([switch]$Apply)
# Owner approved personal account access on October 27, 2026. Only update
# the existing Leave server assembly. No roles, shares, owners or data writes.
$ErrorActionPreference = 'Stop'
$portalRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$portalEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$portalCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$portalWork = Join-Path $PSScriptRoot '.work/personal-reads'
New-Item -ItemType Directory -Force -Path $portalWork | Out-Null
if ((Get-Content -Raw -LiteralPath (Join-Path $portalRoot 'power.config.json') | ConvertFrom-Json).environmentId -cne 'b58b083e-d27d-eabd-a143-2a49dcb9d89a') { throw 'Unexpected app environment.' }
function Read-Portal([string]$Path) {
    $output = & $portalCli api request --target dataverse --environment $portalEnvironment --path $Path --method GET --context 'app=dataverse-skills/1.16.0;skill=dv-security;agent=codex'
    if ($LASTEXITCODE -ne 0) { throw 'Personal access inspection failed.' }
    return (($output -join "`n") | ConvertFrom-Json)
}
$portalApi = Read-Portal '/api/data/v9.2/customapis?$select=uniquename,executeprivilegename&$filter=uniquename eq ''a365_LeaveCommand'''
if (@($portalApi.value).Count -ne 1 -or $portalApi.value[0].executeprivilegename) { throw 'The existing API has an unexpected execution restriction.' }
$portalAssemblies = Read-Portal '/api/data/v9.2/pluginassemblies?$select=pluginassemblyid,name,version,content&$filter=name eq ''A365.Leave.Plugins'''
if (@($portalAssemblies.value).Count -ne 1) { throw 'Expected one existing Leave assembly.' }
$portalAssembly = $portalAssemblies.value[0]
$portalBefore = Join-Path $portalWork 'before.dll'
[IO.File]::WriteAllBytes($portalBefore, [Convert]::FromBase64String($portalAssembly.content))
$portalLocal = Join-Path $portalRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
$portalNative = Join-Path $portalRoot 'solution/A365_DailyOperations/src/PluginAssemblies/A365LeavePlugins-1D8034C7-E2CD-F111-A05A-000D3A8014E4/A365LeavePlugins.dll'
$portalCurrentHash = (Get-FileHash -LiteralPath $portalBefore).Hash
$portalLocalHash = (Get-FileHash -LiteralPath $portalLocal).Hash
$portalName = [Reflection.AssemblyName]::GetAssemblyName($portalLocal)
if ($portalName.Version.ToString() -cne '1.0.3.1') { throw 'Expected the tested personal-read build 1.0.3.1.' }
if ($portalCurrentHash -cne $portalLocalHash -and ($portalAssembly.version -cne '1.0.3.0' -or $portalCurrentHash -cne (Get-FileHash -LiteralPath $portalNative).Hash)) { throw 'Live server differs from the checked-in baseline. Review drift before deployment.' }
foreach ($portalTable in @('a365_employee','a365_leave','a365_leavecredittransaction')) {
    $portalMetadata = Read-Portal "/api/data/v9.2/EntityDefinitions(LogicalName='$portalTable')?`$select=LogicalName,PrimaryIdAttribute,EntitySetName&`$expand=Attributes(`$select=LogicalName)"
    $portalNeeded = switch ($portalTable) {
        'a365_employee' { @('a365_systemuser','a365_name') }
        'a365_leave' { @('a365_employee','a365_name','a365_leavetype','a365_benefit','a365_startdate','a365_enddate','a365_days','a365_leavestatus','a365_issuedon') }
        'a365_leavecredittransaction' { @('a365_employee','a365_year','a365_creditpool','a365_days') }
    }
    foreach ($portalColumn in $portalNeeded) { if ($portalMetadata.Attributes.LogicalName -cnotcontains $portalColumn) { throw "Missing verified column: $portalTable/$portalColumn" } }
}
Write-Host 'Verified Dev environment, existing public API, live schema and baseline assembly. Personal reads resolve initiating user on the server; admin commands remain protected.'
if (-not $Apply) { Write-Host 'Read-only preflight complete. No live changes.'; return }
if ($portalCurrentHash -cne $portalLocalHash) {
    $portalPayload = Join-Path $portalWork 'assembly.json'
    [IO.File]::WriteAllText($portalPayload, (@{content=[Convert]::ToBase64String([IO.File]::ReadAllBytes($portalLocal))} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
    & $portalCli api request --target dataverse --environment $portalEnvironment --path "/api/data/v9.2/pluginassemblies($($portalAssembly.pluginassemblyid))" --method PATCH --body-file $portalPayload --header 'MSCRM.SolutionUniqueName:A365_DailyOperations' --context 'app=dataverse-skills/1.16.0;skill=dv-security;agent=codex' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Assembly update was not confirmed. Inspect before retrying.' }
}
$portalAfter = Read-Portal "/api/data/v9.2/pluginassemblies($($portalAssembly.pluginassemblyid))?`$select=version,content"
$portalAfterFile = Join-Path $portalWork 'verified.dll'
[IO.File]::WriteAllBytes($portalAfterFile, [Convert]::FromBase64String($portalAfter.content))
if ($portalAfter.version -cne '1.0.3.1' -or (Get-FileHash -LiteralPath $portalAfterFile).Hash -cne $portalLocalHash) { throw 'Deployed version/hash differs from the tested assembly.' }
$portalReport = [ordered]@{ Environment=$portalEnvironment; AssemblyVersion=$portalAfter.version; SHA256=$portalLocalHash; VerifiedAt=[DateTime]::UtcNow.ToString('o'); Authorization='Owner explicitly authorized own-account Leave access on October 27, 2026.'; AccessMechanism='Read-only custom API resolves InitiatingUserId and a unique employee mapping; every query is scoped to that employee.'; Roles='Unchanged'; OwnershipAndSharing='Unchanged'; BusinessDataWrites='None'; AppDeployment='Not performed'; ActualUserChecks='Pending separate read-only verification' }
[IO.File]::WriteAllText((Join-Path $portalRoot 'docs/leave-history-access-verification.json'), ($portalReport | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
Write-Host 'Verified deployed personal-access server assembly 1.0.3.1 and SHA256. Roles, ownership, sharing, schema and business records unchanged.'
