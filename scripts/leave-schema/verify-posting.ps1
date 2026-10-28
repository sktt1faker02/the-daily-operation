param([switch]$PreviewExistingEmployee)
$ErrorActionPreference = 'Stop'
$leaveCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$leaveWork = Join-Path $PSScriptRoot '.work/posting'
New-Item -ItemType Directory -Force $leaveWork | Out-Null
$leaveBodyFile = Join-Path $leaveWork 'diagnostics.json'
[IO.File]::WriteAllText($leaveBodyFile, (@{Request=(@{command='diagnostics'} | ConvertTo-Json -Compress)} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
$leaveResult = & $leaveCli api request --target dataverse --environment $leaveEnvironment --path '/api/data/v9.2/a365_LeaveCommand' --method POST --body-file $leaveBodyFile --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
if ($LASTEXITCODE -ne 0) { throw "Leave runtime diagnostics failed: $($leaveResult -join ' ')" }
$leaveResponse = (($leaveResult -join "`n") | ConvertFrom-Json).Response | ConvertFrom-Json
if (-not $leaveResponse.isInTransaction -or -not $leaveResponse.serverValidation -or $leaveResponse.policyVersion -cne '2026-10-22.1') { throw 'Unexpected server transaction diagnostics.' }
$leaveStepsRaw = & $leaveCli api request --target dataverse --environment $leaveEnvironment --path '/api/data/v9.2/sdkmessageprocessingsteps?$select=name,statecode,mode,stage&$filter=startswith(name,''A365 Leave Guard '')' --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
if ($LASTEXITCODE -ne 0) { throw 'Guard verification failed.' }
$leaveSteps = (($leaveStepsRaw -join "`n") | ConvertFrom-Json).value
if (@($leaveSteps).Count -ne 20 -or @($leaveSteps | Where-Object { $_.statecode -ne 0 -or $_.mode -ne 0 -or $_.stage -ne 20 }).Count) { throw 'Unexpected or inactive write guards; all guards must be synchronous PreOperation.' }
$leaveEvidence=@{
    VerifiedAt=[DateTime]::UtcNow.ToString('o');Environment=$leaveEnvironment;PolicyVersion=$leaveResponse.policyVersion;IsInTransaction=$leaveResponse.isInTransaction
    ActiveSynchronousWriteGuards=@($leaveSteps).Count;GuardNames=@($leaveSteps.name)
    FinancialTestRecords='None';TestEmails='None';OrdinaryAccountAccess='Not verified';LiveConcurrentSpend='Not exercised without approved financial test records'
}
if($PreviewExistingEmployee){
    $leaveToday=[DateTime]::UtcNow.AddHours(8).ToString('yyyy-MM-dd')
    $leaveEmployeesRaw=& $leaveCli api request --target dataverse --environment $leaveEnvironment --path "/api/data/v9.2/a365_employees?`$select=a365_employeeid&`$top=1&`$filter=(a365_employmentstatus eq 749910000 or a365_employmentstatus eq 749910002) and a365_datehired ne null and a365_datehired le $leaveToday and (a365_enddate eq null or a365_enddate ge $leaveToday)" --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
    if($LASTEXITCODE -ne 0){throw 'Unable to select an eligible existing employee for read-only preview.'}
    $leaveEmployees=(($leaveEmployeesRaw -join "`n")|ConvertFrom-Json).value
    if(@($leaveEmployees).Count){
        $leaveBeforeRaw=& $leaveCli api request --target dataverse --environment $leaveEnvironment --path '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$count=true&$top=1' --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
        if($LASTEXITCODE -ne 0){throw 'Cannot verify pre-preview ledger count.'}
        $leaveBefore=(($leaveBeforeRaw -join "`n")|ConvertFrom-Json).'@odata.count'
        $leavePreviewFile=Join-Path $leaveWork 'read-only-preview.json'
        [IO.File]::WriteAllText($leavePreviewFile,(@{Request=(@{command='preview';employeeId=$leaveEmployees[0].a365_employeeid}|ConvertTo-Json -Compress)}|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
        $leavePreviewRaw=& $leaveCli api request --target dataverse --environment $leaveEnvironment --path '/api/data/v9.2/a365_LeaveCommand' --method POST --body-file $leavePreviewFile --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
        if($LASTEXITCODE -ne 0){throw 'Read-only existing-employee preview failed. No fixture record was created.'}
        $leavePreview=((($leavePreviewRaw -join "`n")|ConvertFrom-Json).Response|ConvertFrom-Json)
        if($leavePreview.policyVersion -cne '2026-10-22.1' -or -not $leavePreview.periodStart -or $null -eq $leavePreview.VL -or $null -eq $leavePreview.SL){throw 'Invalid existing-employee preview contract.'}
        $leaveAfterRaw=& $leaveCli api request --target dataverse --environment $leaveEnvironment --path '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$count=true&$top=1' --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
        if($LASTEXITCODE -ne 0){throw 'Cannot verify post-preview ledger count.'}
        $leaveAfter=(($leaveAfterRaw -join "`n")|ConvertFrom-Json).'@odata.count'
        if($leaveBefore -ne $leaveAfter){throw 'Ledger count changed during read-only preview; investigate.'}
        $leaveEvidence.ReadOnlyExistingEmployeePreview='Passed; current period and numeric credit contract verified; ledger count unchanged. No employee id/name/balance stored in evidence.'
    }else{$leaveEvidence.ReadOnlyExistingEmployeePreview='Not exercised: no eligible employee with employment dates found.'}
}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot '../../docs/leave-posting-verification.json'), ($leaveEvidence | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
Write-Host 'Verified live synchronous transaction context and 20 active synchronous write guards. No financial data or email writes.'
