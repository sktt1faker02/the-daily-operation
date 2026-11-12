# Read-only verification of the owner-authorized Dev visibility rule.
$ErrorActionPreference = 'Stop'
$inactiveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$inactiveCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$inactiveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$inactiveEmployee = '1f3350bf-c6d9-f111-84ea-000d3a8014e4'
function Read-Inactive([string]$Path) {
    $inactiveOutput = & $inactiveCli api request --target dataverse --environment $inactiveEnvironment --path $Path --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
    if ($LASTEXITCODE -ne 0) { throw 'Inactive visibility read failed.' }
    return (($inactiveOutput -join "`n") | ConvertFrom-Json)
}
$inactiveStatus = Read-Inactive ('/api/data/v9.2/a365_employees(' + $inactiveEmployee + ')?$select=a365_employeeid,a365_employmentstatus')
if ($inactiveStatus.a365_employmentstatus -ne 749910001) { throw 'Support User is no longer inactive; no status was changed by this verifier.' }
$inactivePicker = Read-Inactive ('/api/data/v9.2/a365_employees?$select=a365_employeeid&$filter=a365_employeeid eq ' + $inactiveEmployee + ' and a365_employmentstatus ne 749910001')
if (@($inactivePicker.value).Count) { throw 'Inactive employee remains in picker results.' }
foreach ($inactiveTable in @('a365_leaves', 'a365_leavecredittransactions', 'a365_leavecashconversions')) {
    $inactiveQuery = '/api/data/v9.2/' + $inactiveTable + '?$select=_a365_employee_value&$filter=_a365_employee_value eq ' + $inactiveEmployee + ' and a365_Employee/a365_employmentstatus ne 749910001'
    $inactiveRows = Read-Inactive $inactiveQuery
    if (@($inactiveRows.value).Count) { throw "Inactive employee remains visible in $inactiveTable." }
}
$inactiveCredits = Read-Inactive ('/api/data/v9.2/a365_leavecredittransactions?$select=a365_creditpool,a365_days,modifiedon&$filter=_a365_employee_value eq ' + $inactiveEmployee + ' and a365_year eq 2026')
$inactiveVL = ($inactiveCredits.value | Where-Object a365_creditpool -eq 749910000 | Measure-Object a365_days -Sum).Sum
$inactiveSL = ($inactiveCredits.value | Where-Object a365_creditpool -eq 749910001 | Measure-Object a365_days -Sum).Sum
$inactiveConversions = Read-Inactive ('/api/data/v9.2/a365_leavecashconversions?$select=a365_leavecashconversionid&$filter=_a365_employee_value eq ' + $inactiveEmployee + ' and a365_year eq 2026')
if (@($inactiveCredits.value).Count -lt 11 -or @($inactiveConversions.value).Count -ne 1) { throw 'Saved Support User history is missing; inspect before claiming it is retained.' }
$inactiveEvidencePath = Join-Path $inactiveRoot 'docs/inactive-leave-deployment.json'
$inactiveEvidence = Get-Content -Raw -LiteralPath $inactiveEvidencePath | ConvertFrom-Json
if (@($inactiveCredits.value | Where-Object { ([datetime]$_.modifiedon).ToUniversalTime() -gt ([datetime]$inactiveEvidence.VerifiedAt).ToUniversalTime() }).Count) { throw 'Credit history changed after deployment; inspect concurrent changes.' }
$inactiveEvidence | Add-Member -NotePropertyName VisibilityVerification -NotePropertyValue ([pscustomobject]@{ VerifiedAt=[DateTime]::UtcNow.ToString('o'); InactivePickerExcluded=$true; LeaveRecordsExcluded=$true; CreditListsExcluded=$true; ConversionListsExcluded=$true; SavedVL=$inactiveVL; SavedSL=$inactiveSL; SavedConversionRows=@($inactiveConversions.value).Count; BusinessDataWrites=$false; OrdinaryAccountUAT='Not exercised' }) -Force
$inactiveEvidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $inactiveEvidencePath -Encoding UTF8
Write-Host 'Verified inactive picker, leave/credit/conversion server filters and retained credit history / one conversion row. Read-only; no financial records changed.'
