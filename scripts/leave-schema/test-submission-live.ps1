param([switch]$Apply)
# Owner-requested verification, scoped to the signed-in admin's own Employee.
# -Apply retains two clearly labelled Leave records. Never sends an email or
# marks one Sent; notification commands exercise the explicit Failed outcome.
$ErrorActionPreference='Stop'
$leaveCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveEnvironment='https://org9a7651f0.crm5.dynamics.com'
$leaveWork=Join-Path $PSScriptRoot '.work/submission-audit'
function Invoke-LiveLeave([string]$Path,[string]$Method='GET',$Body=$null,[switch]$ExpectedFailure) {
    $leaveArgs=@('api','request','--target','dataverse','--environment',$leaveEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-data;agent=codex')
    if($null -ne $Body){
        $leaveFile=Join-Path $leaveWork 'live-test-request.json'
        [IO.File]::WriteAllText($leaveFile,($Body|ConvertTo-Json -Depth 10 -Compress),(New-Object Text.UTF8Encoding($false)))
        $leaveArgs+=@('--body-file',$leaveFile)
    }
    $leaveOld=$ErrorActionPreference
    $ErrorActionPreference='Continue'
    $leaveRaw=& $leaveCli @leaveArgs 2>&1
    $leaveExit=$LASTEXITCODE
    $ErrorActionPreference=$leaveOld
    if($ExpectedFailure){return @{Exit=$leaveExit;Text=($leaveRaw -join "`n")}}
    if($leaveExit -ne 0){throw "Leave test request failed: $Path : $($leaveRaw -join ' ')"}
    if($leaveRaw){return (($leaveRaw -join "`n")|ConvertFrom-Json)}
}
function Command-LiveLeave($Request){
    return ((Invoke-LiveLeave '/api/data/v9.2/a365_LeaveCommand' 'POST' @{Request=($Request|ConvertTo-Json -Compress)}).Response|ConvertFrom-Json)
}
$leaveWho=Invoke-LiveLeave '/api/data/v9.2/WhoAmI'
$leavePeople=@((Invoke-LiveLeave "/api/data/v9.2/a365_employees?`$select=a365_employeeid&`$filter=_a365_systemuser_value eq $($leaveWho.UserId)&`$top=2").value)
if($leavePeople.Count -ne 1){throw 'Expected one Employee linked to the signed-in admin; no other employee will be used.'}
$leaveEmployee=$leavePeople[0].a365_employeeid
$leaveStateFile=Join-Path $leaveWork 'live-test-state.json'
if(Test-Path -LiteralPath $leaveStateFile){
    $leaveState=Get-Content -Raw -LiteralPath $leaveStateFile|ConvertFrom-Json
    if($leaveState.Employee -ne $leaveEmployee){throw 'Existing verification state belongs to another Employee.'}
}else{
    $leaveDates=@()
    $leaveDay=[datetime]::UtcNow.AddHours(8).Date
    for($leaveOffset=0;$leaveOffset -lt 21 -and $leaveDates.Count -lt 2;$leaveOffset++){
        $leaveDate=$leaveDay.AddDays($leaveOffset)
        if($leaveDate.DayOfWeek -in @([DayOfWeek]::Saturday,[DayOfWeek]::Sunday)){continue}
        $leaveIso=$leaveDate.ToString('yyyy-MM-dd')
        try{
            $leavePreview=Command-LiveLeave @{command='preview';employeeId=$leaveEmployee;leaveType=749910000;benefit=749910000;startDate=$leaveIso;endDate=$leaveIso}
            if($leavePreview.days -eq 1){$leaveDates+= $leaveIso}
        }catch{continue}
    }
    if($leaveDates.Count -ne 2){throw 'Could not find two eligible non-overlapping workdays.'}
    $leaveState=[pscustomobject]@{Employee=$leaveEmployee;VlOperation=[guid]::NewGuid().ToString();SlOperation=[guid]::NewGuid().ToString();VlDate=$leaveDates[0];SlDate=$leaveDates[1]}
    [IO.File]::WriteAllText($leaveStateFile,($leaveState|ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
}
$leaveVl=@{command='issue';employeeId=$leaveEmployee;operationId=$leaveState.VlOperation;leaveType=749910000;benefit=749910000;startDate=$leaveState.VlDate;endDate=$leaveState.VlDate;note='Owner-authorized submission verification: Paid VL with zero balance; expected Unpaid.'}
$leaveSl=@{command='issue';employeeId=$leaveEmployee;operationId=$leaveState.SlOperation;leaveType=749910001;benefit=749910000;startDate=$leaveState.SlDate;endDate=$leaveState.SlDate;note='Owner-authorized submission verification: Paid SL; expected one deduction.'}
if(-not $Apply){
    $leavePreview=Command-LiveLeave @{command='preview';employeeId=$leaveEmployee}
    if($leavePreview.VL -ne 0 -or $leavePreview.SL -lt 1){throw 'The own-employee balance does not meet the requested zero-VL/sufficient-SL scenarios. No credits will be altered to manufacture a test.'}
    Write-Host "Preflight passed: own-employee zero-VL and sufficient-SL cases; dates $($leaveState.VlDate) and $($leaveState.SlDate). No records created."
    exit
}
$leaveVlSaved=Command-LiveLeave $leaveVl
if($leaveVlSaved.a365_benefit -ne 749910001 -or $leaveVlSaved.a365_days -ne 1){throw 'VL fallback did not save as one Unpaid day.'}
$leaveSlSaved=Command-LiveLeave $leaveSl
if($leaveSlSaved.a365_benefit -ne 749910000 -or $leaveSlSaved.a365_days -ne 1){throw 'SL did not save as one Paid day.'}
$leaveVlRows=@((Invoke-LiveLeave "/api/data/v9.2/a365_leavecredittransactions?`$select=a365_days,a365_transactionkey&`$filter=_a365_leave_value eq $($leaveState.VlOperation)").value)
$leaveSlRows=@((Invoke-LiveLeave "/api/data/v9.2/a365_leavecredittransactions?`$select=a365_days,a365_transactionkey&`$filter=_a365_leave_value eq $($leaveState.SlOperation)").value)
if($leaveVlRows.Count -ne 0){throw 'Unpaid leave unexpectedly has credit movements.'}
if($leaveSlRows.Count -ne 1 -or $leaveSlRows[0].a365_days -ne -1 -or $leaveSlRows[0].a365_transactionkey -cne "LEAVE-$($leaveState.SlOperation)-DEDUCTION"){throw 'SL deduction count, amount or transaction key is wrong.'}
foreach($leaveRequest in @($leaveVl,$leaveSl)){
    $leaveRetry=Command-LiveLeave $leaveRequest
    if($leaveRetry.a365_leaveid -ne $leaveRequest.operationId){throw 'Retry returned another operation.'}
}
$leaveSources=@((Invoke-LiveLeave "/api/data/v9.2/a365_leaves?`$select=a365_leaveid&`$filter=a365_leaveid eq $($leaveState.VlOperation) or a365_leaveid eq $($leaveState.SlOperation)").value)
$leaveRetryRows=@((Invoke-LiveLeave "/api/data/v9.2/a365_leavecredittransactions?`$select=a365_days&`$filter=_a365_leave_value eq $($leaveState.VlOperation) or _a365_leave_value eq $($leaveState.SlOperation)").value)
if($leaveSources.Count -ne 2 -or $leaveRetryRows.Count -ne 1){throw 'Retry produced unexpected source/ledger counts.'}
$leaveMeta=Invoke-LiveLeave '/api/data/v9.2/EntityDefinitions(LogicalName=''a365_leave'')?$select=LogicalName&$expand=ManyToOneRelationships($select=ReferencingAttribute,ReferencingEntityNavigationPropertyName,ReferencedEntity)'
$leaveEmployeeNav=@($leaveMeta.ManyToOneRelationships|Where-Object{$_.ReferencingAttribute -ceq 'a365_employee' -and $_.ReferencedEntity -ceq 'a365_employee'})
if($leaveEmployeeNav.Count -ne 1){throw 'Employee lookup binding is ambiguous.'}
$leaveDirectId=[guid]::NewGuid().ToString()
$leaveDirect=@{a365_leaveid=$leaveDirectId;a365_name='Owner-authorized direct-write rejection test';a365_startdate=$leaveState.VlDate;a365_enddate=$leaveState.VlDate;a365_days=1;a365_leavetype=749910000;a365_benefit=749910001;a365_leavestatus=749910000;a365_notificationstatus=749910000}
$leaveDirect["$($leaveEmployeeNav[0].ReferencingEntityNavigationPropertyName)@odata.bind"]="/a365_employees($leaveEmployee)"
$leaveDenied=Invoke-LiveLeave '/api/data/v9.2/a365_leaves' 'POST' $leaveDirect -ExpectedFailure
if($leaveDenied.Exit -eq 0 -or $leaveDenied.Text -notmatch 'Use the validated Leave command'){throw 'Direct Create was not rejected by the guard. Stop and inspect; do not bypass or delete records.'}
foreach($leaveOperation in @($leaveState.VlOperation,$leaveState.SlOperation)){
    $leavePrepared=Command-LiveLeave @{command='prepareEmail';operationId=$leaveOperation}
    if(-not $leavePrepared.attempt){throw 'Email preparation did not return an attempt.'}
    $leaveComplete=Command-LiveLeave @{command='completeEmail';operationId=$leaveOperation;attempt=$leavePrepared.attempt;outcome='failed'}
    if($leaveComplete.outcome -cne 'failed'){throw 'Notification failure-path completion failed.'}
}
$leaveReport=[ordered]@{VerifiedAt=[datetime]::UtcNow.ToString('o');Environment=$leaveEnvironment;PaidVlZeroBalance='Passed: Unpaid, zero deduction rows';PaidSl='Passed: Paid, one -1.00 deduction with exact key';SameOperationRetry='Passed: two sources and one total deduction after replay';DirectCreate='Blocked with guard message';NotificationCommands='Passed prepareEmail/completeEmail Failed path on both records; no email sent or Sent status fabricated';RetainedVerificationRecords=2;EmployeeScope='Signed-in admin own Employee only';Dates=@($leaveState.VlDate,$leaveState.SlDate);GuardPredicate='Transactional child plus transactional a365_LeaveCommand ancestor; no bypass flag'}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot '../../docs/leave-submission-fix-verification.json'),($leaveReport|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
$leaveReport|ConvertTo-Json -Depth 8
