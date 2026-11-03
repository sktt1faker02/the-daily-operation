# Read-only verification: never sends resetBalances, issue, delete or other mutations.
$ErrorActionPreference = 'Stop'
$resetRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$resetCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$resetEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$resetWork = Join-Path $PSScriptRoot '.work/reset'
New-Item -ItemType Directory -Force -Path $resetWork | Out-Null
function Reset-Read([string]$Path, [string]$Command = '') {
    $resetArgs = @('api', 'request', '--target', 'dataverse', '--environment', $resetEnvironment, '--path', $Path, '--context', 'app=dataverse-skills/1.16.0;skill=dv-solution;agent=codex')
    if ($Command) {
        if ($Path -cne '/api/data/v9.2/a365_LeaveCommand' -or $Command -notin @('diagnostics', 'resetPreview')) { throw 'Only read-only commands are allowed.' }
        $resetBody = Join-Path $resetWork 'readonly-request.json'
        [IO.File]::WriteAllText($resetBody, (@{ Request = (@{ command = $Command } | ConvertTo-Json -Compress) } | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
        $resetArgs += @('--method', 'POST', '--body-file', $resetBody)
    }
    $resetOutput = & $resetCli @resetArgs
    if ($LASTEXITCODE -ne 0) { throw 'Read-only Leave reset verification failed.' }
    $resetData = ($resetOutput -join "`n") | ConvertFrom-Json
    if ($Command) { return ($resetData.Response | ConvertFrom-Json) }
    return $resetData
}
$resetAssemblies = Reset-Read '/api/data/v9.2/pluginassemblies?$select=name,version,content&$filter=name eq ''A365.Leave.Plugins'''
if (@($resetAssemblies.value).Count -ne 1 -or $resetAssemblies.value[0].version -cne '1.0.3.5') { throw 'Expected deployed Leave 1.0.3.5.' }
$resetDownloaded = Join-Path $resetWork 'deployed-Leave.dll'
[IO.File]::WriteAllBytes($resetDownloaded, [Convert]::FromBase64String($resetAssemblies.value[0].content))
$resetHash = (Get-FileHash -LiteralPath $resetDownloaded -Algorithm SHA256).Hash
if ($resetHash -cne (Get-FileHash -LiteralPath (Join-Path $resetRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll') -Algorithm SHA256).Hash) { throw 'Deployed DLL differs from tested DLL.' }
$resetBefore = Reset-Read '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$count=true&$top=1'
$resetDiagnostics = Reset-Read '/api/data/v9.2/a365_LeaveCommand' 'diagnostics'
if (-not $resetDiagnostics.isInTransaction -or -not $resetDiagnostics.serverValidation) { throw 'Expected synchronous transactional API.' }
$resetPreview = Reset-Read '/api/data/v9.2/a365_LeaveCommand' 'resetPreview'
if ($resetPreview.resetVersion -ne 1 -or $resetPreview.VL -ne 10 -or $resetPreview.SL -ne 5 -or $resetPreview.employeeCount -lt 0 -or $resetPreview.version -notmatch '^[a-f0-9]{64}$' -or $resetPreview.year -ne [DateTime]::UtcNow.AddHours(8).Year) { throw 'Unexpected reset preview contract.' }
$resetAfter = Reset-Read '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$count=true&$top=1'
if ($null -eq $resetBefore.'@odata.count' -or $resetBefore.'@odata.count' -ne $resetAfter.'@odata.count') { throw 'Credit count changed during verification; investigate concurrent activity.' }
$resetGuards = Reset-Read '/api/data/v9.2/sdkmessageprocessingsteps?$select=name,statecode,mode,stage&$filter=startswith(name,''A365 Leave Guard '')'
if (@($resetGuards.value).Count -ne 20 -or @($resetGuards.value | Where-Object { $_.statecode -ne 0 -or $_.mode -ne 0 -or $_.stage -ne 20 }).Count) { throw 'Expected 20 active synchronous Leave write guards.' }
$resetEvidence = @{
    VerifiedAt = [DateTime]::UtcNow.ToString('o'); Environment = $resetEnvironment; Solution = 'A365_DailyOperations'
    AssemblyVersion = '1.0.3.5'; SHA256 = $resetHash; DeployedHashMatchesTested = $true
    ResetPreview = 'Passed'; ActiveEmployeeCount = $resetPreview.employeeCount; Year = $resetPreview.year
    PeriodStart = $resetPreview.periodStart; Targets = @{ VL = 10; SL = 5 }
    IsInTransaction = $true; ActiveSynchronousWriteGuards = 20; CreditCountUnchanged = $true
    ResetExecuted = $false; BusinessDataWrites = 'None'; Emails = 'None'; Roles = 'Unchanged'; Schema = 'Unchanged'
    OrdinaryAccountSecurity = 'Not exercised'; ActualResetRollbackConcurrency = 'Synthetic checks only'
}
[IO.File]::WriteAllText((Join-Path $resetRoot 'docs/leave-reset-deployment.json'), ($resetEvidence | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
Write-Host "Verified Leave 1.0.3.5 hash, reset preview, transaction context and 20 guards. Active employee count: $($resetPreview.employeeCount). No balances reset."
