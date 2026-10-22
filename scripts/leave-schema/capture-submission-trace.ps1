param([ValidateSet('before','after')][string]$Label='after')
# Authorized temporary trace capture. The invalid date forces rollback even if
# the old guard unexpectedly accepts the request. No email is attempted.
$ErrorActionPreference = 'Stop'
$leaveCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$leaveWork = Join-Path $PSScriptRoot '.work/submission-audit'
function Invoke-TraceApi([string]$Path, [string]$Method='GET', $Body=$null) {
    $leaveArgs=@('api','request','--target','dataverse','--environment',$leaveEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex')
    if ($null -ne $Body) {
        $leaveFile=Join-Path $leaveWork 'trace-request.json'
        [IO.File]::WriteAllText($leaveFile, ($Body | ConvertTo-Json -Depth 8 -Compress), (New-Object Text.UTF8Encoding($false)))
        $leaveArgs+=@('--body-file',$leaveFile)
    }
    $leaveRaw=& $leaveCli @leaveArgs
    if ($LASTEXITCODE -ne 0) { throw 'Trace setup/read failed.' }
    if ($leaveRaw) { return (($leaveRaw -join "`n") | ConvertFrom-Json) }
}
$leaveOrg=(Invoke-TraceApi '/api/data/v9.2/organizations?$select=organizationid,plugintracelogsetting').value[0]
$leaveSince=[datetime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
try {
    Invoke-TraceApi "/api/data/v9.2/organizations($($leaveOrg.organizationid))" 'PATCH' @{plugintracelogsetting=2} | Out-Null
    $leaveWho=Invoke-TraceApi '/api/data/v9.2/WhoAmI'
    $leavePeople=@((Invoke-TraceApi "/api/data/v9.2/a365_employees?`$select=a365_employeeid&`$filter=_a365_systemuser_value eq $($leaveWho.UserId)&`$top=2").value)
    if ($leavePeople.Count -ne 1) { throw 'Expected one Employee linked to the signed-in admin.' }
    $leavePayload=@{Request=(@{command='issue';employeeId=$leavePeople[0].a365_employeeid;operationId=[guid]::NewGuid().ToString();leaveType=749910000;benefit=749910000;startDate='guard-probe';endDate='guard-probe';note=''}|ConvertTo-Json -Compress)}
    $leaveProbeFile=Join-Path $leaveWork 'reproduction.json'
    [IO.File]::WriteAllText($leaveProbeFile,($leavePayload|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
    $ErrorActionPreference='Continue'
    $leaveFailure=& $leaveCli api request --target dataverse --environment $leaveEnvironment --path '/api/data/v9.2/a365_LeaveCommand' --method POST --body-file $leaveProbeFile --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex' 2>&1
    $leaveExit=$LASTEXITCODE
    $ErrorActionPreference='Stop'
    [IO.File]::WriteAllText((Join-Path $leaveWork "reproduction-$Label-error.txt"),($leaveFailure -join "`n"),(New-Object Text.UTF8Encoding($false)))
    if ($leaveExit -eq 0) { throw 'Expected a rejection, not a successful Leave operation.' }
    $leaveLogs=Invoke-TraceApi "/api/data/v9.2/plugintracelogs?`$select=createdon,typename,messagename,depth,mode,pluginstepid,correlationid,messageblock,exceptiondetails&`$filter=createdon ge $leaveSince and startswith(typename,'A365.Leave.Plugins.')&`$orderby=createdon desc&`$top=10"
    $leaveJson=$leaveLogs|ConvertTo-Json -Depth 10
    [IO.File]::WriteAllText((Join-Path $leaveWork "$Label-traces.json"),$leaveJson,(New-Object Text.UTF8Encoding($false)))
    $leaveJson
} finally {
    $ErrorActionPreference='Stop'
    Invoke-TraceApi "/api/data/v9.2/organizations($($leaveOrg.organizationid))" 'PATCH' @{plugintracelogsetting=$leaveOrg.plugintracelogsetting} | Out-Null
    Write-Host "Restored original plug-in trace setting: $($leaveOrg.plugintracelogsetting)."
}
