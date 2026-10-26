# Only changes the existing Leave guards' stage to synchronous PreOperation.
$ErrorActionPreference='Stop'
$leaveCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveEnvironment='https://org9a7651f0.crm5.dynamics.com'
$leaveContext='app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex'
function Read-GuardSteps {
    $leaveRaw=& $leaveCli api request --target dataverse --environment $leaveEnvironment --path '/api/data/v9.2/sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid,name,stage,mode,statecode,_eventhandler_value&$filter=startswith(name,''A365 Leave Guard '')' --context $leaveContext
    if($LASTEXITCODE -ne 0){throw 'Unable to inspect Leave guards.'}
    return (($leaveRaw -join "`n")|ConvertFrom-Json).value
}
$leaveSteps=@(Read-GuardSteps)
if($leaveSteps.Count -ne 20){throw 'Unexpected guard count; inspect before changing anything.'}
$leaveBody=Join-Path $PSScriptRoot '.work/submission-audit/preoperation.json'
[IO.File]::WriteAllText($leaveBody,'{"stage":20}',(New-Object Text.UTF8Encoding($false)))
foreach($leaveStep in $leaveSteps){
    if($leaveStep._eventhandler_value -ne '308034c7-e2cd-f111-a05a-000d3a8014e4' -or $leaveStep.mode -ne 0 -or $leaveStep.statecode -ne 0 -or $leaveStep.stage -notin @(10,20)){throw 'Unexpected handler, mode, status or stage; stop without relaxing guards.'}
}
foreach($leaveStep in $leaveSteps){
    if($leaveStep.stage -eq 20){continue}
    & $leaveCli api request --target dataverse --environment $leaveEnvironment --path "/api/data/v9.2/sdkmessageprocessingsteps($($leaveStep.sdkmessageprocessingstepid))" --method PATCH --body-file $leaveBody --header 'MSCRM.SolutionUniqueName:A365_DailyOperations' --context $leaveContext | Out-Null
    if($LASTEXITCODE -ne 0){throw "Stage update failed for $($leaveStep.name). All guards remain enabled; inspect partial stage changes."}
}
$leaveAfter=@(Read-GuardSteps)
if($leaveAfter.Count -ne 20 -or @($leaveAfter|Where-Object{$_.stage -ne 20 -or $_.mode -ne 0 -or $_.statecode -ne 0}).Count){throw 'Guard registration verification failed.'}
Write-Host 'Verified all 20 existing Leave guards: enabled, synchronous, PreOperation (20). No guard disabled; no role/schema changes.'
