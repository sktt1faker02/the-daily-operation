# Exercises nested coordination/credit writes, then deliberately fails before
# Leave creation so the entire transaction rolls back. Never sends email.
$ErrorActionPreference = 'Stop'
$leaveCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$leaveContext = 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
function Read-LeaveProbe([string]$Path) {
    $leaveRaw = & $leaveCli api request --target dataverse --environment $leaveEnvironment --path $Path --context $leaveContext
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read Leave probe prerequisites.' }
    return (($leaveRaw -join "`n") | ConvertFrom-Json)
}
function Count-LeaveProbe([string]$Set, [string]$Id) {
    return (Read-LeaveProbe ('/api/data/v9.2/' + $Set + '?$select=' + $Id + '&$count=true&$top=1')).'@odata.count'
}
$leaveEmployee = @( (Read-LeaveProbe '/api/data/v9.2/a365_employees?$select=a365_employeeid&$filter=a365_employmentstatus eq 749910000&$top=1').value )
if ($leaveEmployee.Count -ne 1) { throw 'An existing Active employee is needed for the rollback probe.' }
$leaveSets = @(@('a365_leaves','a365_leaveid'), @('a365_leavecredittransactions','a365_leavecredittransactionid'), @('a365_leavecoordinations','a365_leavecoordinationid'))
$leaveBefore = @($leaveSets | ForEach-Object { Count-LeaveProbe $_[0] $_[1] })
$leaveBody = Join-Path $PSScriptRoot '.work/posting/guard-rollback-probe.json'
$leaveRequest = @{ command='issue'; employeeId=$leaveEmployee[0].a365_employeeid; operationId=[guid]::NewGuid().ToString(); leaveType=749910000; benefit=749910000; startDate='guard-probe'; endDate='guard-probe' }
[IO.File]::WriteAllText($leaveBody, (@{Request=($leaveRequest | ConvertTo-Json -Compress)} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
$leaveOldPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$leaveResult = & $leaveCli api request --target dataverse --environment $leaveEnvironment --path '/api/data/v9.2/a365_LeaveCommand' --method POST --body-file $leaveBody --context $leaveContext 2>&1
$leaveExit = $LASTEXITCODE
$ErrorActionPreference = $leaveOldPreference
if ($leaveExit -eq 0 -or ($leaveResult -join "`n") -notmatch 'Enter valid start and end dates') {
    throw 'Rollback probe did not reach the expected date rejection; inspect the server response before claiming the guard is fixed.'
}
$leaveAfter = @($leaveSets | ForEach-Object { Count-LeaveProbe $_[0] $_[1] })
for ($leaveIndex=0; $leaveIndex -lt $leaveBefore.Count; $leaveIndex++) {
    if ($leaveBefore[$leaveIndex] -ne $leaveAfter[$leaveIndex]) { throw 'Record counts changed during verification; investigate concurrent activity or rollback.' }
}
Write-Host 'Live guard probe passed: nested writes reached date validation and rolled back. Leave, ledger and coordination counts unchanged. No email sent.'
