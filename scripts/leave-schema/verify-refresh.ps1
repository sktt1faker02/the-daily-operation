param(
    [string]$AssemblyVersion = '1.0.3.10',
    [string]$EvidenceFile = 'docs/leave-refresh-deployment.json',
    [ValidatePattern('^[A-F0-9]{64}$')][string]$ExpectedSHA256
)
# Read-only verification: never sends refreshBalances, issue, delete or other mutations.
$ErrorActionPreference = 'Stop'
$resetRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$resetCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$resetEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$resetWork = Join-Path $PSScriptRoot '.work/refresh-release'
New-Item -ItemType Directory -Force -Path $resetWork | Out-Null
function Reset-Read([string]$Path, [string]$Command = '') {
    $resetArgs = @('api', 'request', '--target', 'dataverse', '--environment', $resetEnvironment, '--path', $Path, '--context', 'app=dataverse-skills/1.16.0;skill=dv-solution;agent=codex')
    if ($Command) {
        if ($Path -cne '/api/data/v9.2/a365_LeaveCommand' -or $Command -notin @('diagnostics', 'refreshPreview')) { throw 'Only read-only commands are allowed.' }
        $resetBody = Join-Path $resetWork 'readonly-request.json'
        [IO.File]::WriteAllText($resetBody, (@{ Request = (@{ command = $Command } | ConvertTo-Json -Compress) } | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
        $resetArgs += @('--method', 'POST', '--body-file', $resetBody)
    }
    $resetOutput = & $resetCli @resetArgs
    if ($LASTEXITCODE -ne 0) { throw 'Read-only Leave refresh verification failed.' }
    $resetData = ($resetOutput -join "`n") | ConvertFrom-Json
    if ($Command) { return ($resetData.Response | ConvertFrom-Json) }
    return $resetData
}
$resetAssemblies = Reset-Read '/api/data/v9.2/pluginassemblies?$select=name,version,content&$filter=name eq ''A365.Leave.Plugins'''
if (@($resetAssemblies.value).Count -ne 1 -or $resetAssemblies.value[0].version -cne $AssemblyVersion) { throw "Expected deployed Leave $AssemblyVersion." }
$resetDownloaded = Join-Path $resetWork 'deployed-Leave.dll'
[IO.File]::WriteAllBytes($resetDownloaded, [Convert]::FromBase64String($resetAssemblies.value[0].content))
$resetHash = (Get-FileHash -LiteralPath $resetDownloaded -Algorithm SHA256).Hash
if (-not $ExpectedSHA256) { $ExpectedSHA256 = (Get-FileHash -LiteralPath (Join-Path $resetRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll') -Algorithm SHA256).Hash }
if ($resetHash -cne $ExpectedSHA256) { throw 'Deployed DLL differs from tested DLL.' }
$resetBefore = Reset-Read '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$count=true&$top=1'
$resetDiagnostics = Reset-Read '/api/data/v9.2/a365_LeaveCommand' 'diagnostics'
if (-not $resetDiagnostics.isInTransaction -or -not $resetDiagnostics.serverValidation) { throw 'Expected synchronous transactional API.' }
$refreshPreview = Reset-Read '/api/data/v9.2/a365_LeaveCommand' 'refreshPreview'
if ($refreshPreview.refreshVersion -ne 1 -or @($refreshPreview.employees).Count -ne $refreshPreview.employeeCount -or $refreshPreview.employeeCount -lt 0 -or $refreshPreview.version -notmatch '^[a-f0-9]{64}$' -or $refreshPreview.year -ne [DateTime]::UtcNow.AddHours(8).Year) { throw 'Unexpected refresh preview contract.' }
$refreshBlocked = @($refreshPreview.employees | Where-Object { $_.VL -lt 0 -or $_.SL -lt 0 -or $_.issue }).Count
foreach ($refreshEmployee in $refreshPreview.employees) {
    if ($refreshEmployee.earnedVL -lt 0 -or $refreshEmployee.earnedVL -gt 10 -or $refreshEmployee.convertedVL -lt 0 -or $refreshEmployee.convertedVL -gt 5 -or
        [Math]::Round([decimal]$refreshEmployee.VL, 2) -ne [Math]::Round(([decimal]$refreshEmployee.earnedVL - [decimal]$refreshEmployee.usedVL - [decimal]$refreshEmployee.convertedVL), 2) -or
        [Math]::Round([decimal]$refreshEmployee.SL, 2) -ne [Math]::Round((5 - [decimal]$refreshEmployee.usedSL), 2)) { throw 'Unexpected entitlement/usage calculation in live preview.' }
}
if ($refreshPreview.canApply -and ($refreshBlocked -gt 0 -or $refreshPreview.employeeCount -eq 0)) { throw 'Preview incorrectly permits an empty or blocked refresh.' }
$resetAfter = Reset-Read '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$count=true&$top=1'
if ($null -eq $resetBefore.'@odata.count' -or $resetBefore.'@odata.count' -ne $resetAfter.'@odata.count') { throw 'Credit count changed during verification; investigate concurrent activity.' }
$resetGuards = Reset-Read '/api/data/v9.2/sdkmessageprocessingsteps?$select=name,statecode,mode,stage&$filter=startswith(name,''A365 Leave Guard '')'
if (@($resetGuards.value).Count -ne 20 -or @($resetGuards.value | Where-Object { $_.statecode -ne 0 -or $_.mode -ne 0 -or $_.stage -ne 20 }).Count) { throw 'Expected 20 active synchronous Leave write guards.' }
$resetEvidence = @{
    VerifiedAt = [DateTime]::UtcNow.ToString('o'); Environment = $resetEnvironment; Solution = 'A365_DailyOperations'
    AssemblyVersion = $AssemblyVersion; SHA256 = $resetHash; DeployedHashMatchesTested = $true
    RefreshPreview = 'Passed'; ActiveEmployeeCount = $refreshPreview.employeeCount; Year = $refreshPreview.year
    PeriodStart = $refreshPreview.periodStart; Maximums = @{ VL = 10; SL = 5 }; BlockedEmployeeCount = $refreshBlocked; CanApply = $refreshPreview.canApply
    IsInTransaction = $true; ActiveSynchronousWriteGuards = 20; CreditCountUnchanged = $true
    RefreshExecuted = $false; BusinessDataWrites = 'None'; Emails = 'None'; Roles = 'Unchanged'; Schema = 'Unchanged'
    OrdinaryAccountSecurity = 'Not exercised'; ActualRefreshRollbackConcurrency = 'Synthetic checks only'
}
[IO.File]::WriteAllText((Join-Path $resetRoot $EvidenceFile), ($resetEvidence | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
Write-Host "Verified Leave $AssemblyVersion hash, refresh preview, transaction context and 20 guards. Active employee count: $($refreshPreview.employeeCount). No balances refreshed."
