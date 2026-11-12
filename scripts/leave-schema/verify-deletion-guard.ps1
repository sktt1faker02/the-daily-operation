param([ValidateSet('before','after')][string]$Stage = 'after')
# This probe can never reach a real source deletion: both the randomly chosen
# source ID and its receipt key are verified absent first. The command always
# throws before financial writes, rolling its coordination lock back.
$ErrorActionPreference = 'Stop'
$guardCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$guardEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$guardRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$guardWork = Join-Path $PSScriptRoot '.work/deletion-guard'
New-Item -ItemType Directory -Force -Path $guardWork | Out-Null
function Guard-Read([string]$Path) {
    $output = & $guardCli api request --target dataverse --environment $guardEnvironment --path $Path --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
    if ($LASTEXITCODE -ne 0) { throw 'Guard probe read failed.' }
    return (($output -join "`n") | ConvertFrom-Json)
}
$guardAssembly = Guard-Read '/api/data/v9.2/pluginassemblies?$select=version&$filter=name eq ''A365.Leave.Plugins'''
$guardExpectedVersion = if ($Stage -eq 'before') { '1.0.3.3' } else { '1.0.3.4' }
if (@($guardAssembly.value).Count -ne 1 -or $guardAssembly.value[0].version -cne $guardExpectedVersion) { throw 'Unexpected server version for probe stage.' }
$guardCandidate = Guard-Read '/api/data/v9.2/a365_leaves?$select=_a365_employee_value&$top=1'
if (@($guardCandidate.value).Count -ne 1) { throw 'Existing employee linkage required for the rollback-only probe.' }
$guardEmployee = $guardCandidate.value[0]._a365_employee_value
$guardMissing = [Guid]::NewGuid().ToString('D')
$guardSource = Guard-Read "/api/data/v9.2/a365_leaves?`$select=a365_leaveid&`$filter=a365_leaveid eq $guardMissing&`$top=1"
$guardReceipt = Guard-Read "/api/data/v9.2/a365_leavecredittransactions?`$select=a365_leavecredittransactionid&`$filter=a365_transactionkey eq 'LEAVE-$guardMissing-DELETE'&`$top=1"
if (@($guardSource.value).Count -ne 0 -or @($guardReceipt.value).Count -ne 0) { throw 'Probe target must not exist.' }
$guardLockPath = "/api/data/v9.2/a365_leavecoordinations?`$select=a365_leavecoordinationid,a365_token&`$filter=a365_leavecoordinationid eq $guardEmployee"
$guardLockBefore = Guard-Read $guardLockPath
$guardLeaveBefore = Guard-Read '/api/data/v9.2/a365_leaves?$select=a365_leaveid&$count=true&$top=1'
$guardCreditBefore = Guard-Read '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$count=true&$top=1'
$guardBody = Join-Path $guardWork 'rollback-probe.json'
[IO.File]::WriteAllText($guardBody, (@{Request=(@{command='delete';employeeId=$guardEmployee;operationId=$guardMissing;expectedRestoredDays=0} | ConvertTo-Json -Compress)} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
$guardOldPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$guardOutput = & $guardCli api request --target dataverse --environment $guardEnvironment --path '/api/data/v9.2/a365_LeaveCommand' --method POST --body-file $guardBody --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex' 2>&1
$guardExit = $LASTEXITCODE
$ErrorActionPreference = $guardOldPreference
$guardExpectedError = if ($Stage -eq 'before') { 'Leave deletion cannot modify these records' } else { 'This leave is no longer available' }
if ($guardExit -eq 0 -or ($guardOutput -join ' ') -notmatch [regex]::Escape($guardExpectedError)) { throw 'Probe did not stop at the expected rollback boundary.' }
$guardLockAfter = Guard-Read $guardLockPath
$guardLeaveAfter = Guard-Read '/api/data/v9.2/a365_leaves?$select=a365_leaveid&$count=true&$top=1'
$guardCreditAfter = Guard-Read '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$count=true&$top=1'
if (@($guardLockBefore.value).Count -ne @($guardLockAfter.value).Count -or ($guardLockBefore.value | Select-Object -First 1).a365_token -cne ($guardLockAfter.value | Select-Object -First 1).a365_token -or $guardLeaveBefore.'@odata.count' -ne $guardLeaveAfter.'@odata.count' -or $guardCreditBefore.'@odata.count' -ne $guardCreditAfter.'@odata.count') { throw 'State changed during probe; inspect concurrent activity before claiming rollback.' }
$guardEvidence = @{
    Stage=$Stage;Version=$guardExpectedVersion;Environment=$guardEnvironment;VerifiedAt=[DateTime]::UtcNow.ToString('o')
    TargetAndReceiptVerifiedAbsent=$true;ExpectedFault=$guardExpectedError;CoordinationTokenUnchanged=$true;LeaveAndCreditCountsUnchanged=$true
    ExistingSourceDeleted=$false;FinancialWritesCommitted=$false;TraceSettings='Unchanged'
}
[IO.File]::WriteAllText((Join-Path $guardRoot "docs/leave-deletion-guard-$Stage.json"), ($guardEvidence | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
Write-Host "Deletion guard probe ($Stage): expected rollback boundary verified; coordination token and record counts unchanged. No existing leave was deleted."
