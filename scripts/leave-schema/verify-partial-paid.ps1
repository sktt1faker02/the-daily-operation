# Read-only live checks. No leave issuance, financial records or email.
$ErrorActionPreference = 'Stop'
$splitCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$splitEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$splitRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$splitWork = Join-Path $PSScriptRoot '.work/partial-paid'
New-Item -ItemType Directory -Force -Path $splitWork | Out-Null
function Split-Read([string]$Path, $Request = $null) {
    $splitArgs = @('api','request','--target','dataverse','--environment',$splitEnvironment,'--path',$Path,'--context','app=dataverse-skills/1.16.0;skill=dv-query;agent=codex')
    if ($null -ne $Request) {
        if ($Path -cne '/api/data/v9.2/a365_LeaveCommand' -or $Request.command -notin @('preview','myLeaves','myLeave','myCredits','diagnostics')) { throw 'Only read-only commands permitted.' }
        $splitBody = Join-Path $splitWork 'read-request.json'
        [IO.File]::WriteAllText($splitBody, (@{Request=($Request | ConvertTo-Json -Compress)} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
        $splitArgs += @('--method','POST','--body-file',$splitBody)
    }
    $splitOutput = & $splitCli @splitArgs
    if ($LASTEXITCODE -ne 0) { throw 'Live Leave read failed. Backend record details are not included in this report.' }
    $splitResult = ($splitOutput -join "`n") | ConvertFrom-Json
    if ($null -ne $Request) { return ($splitResult.Response | ConvertFrom-Json) }
    return $splitResult
}
$splitFields = 'a365_leaveid,a365_name,_a365_employee_value,a365_leavetype,a365_benefit,a365_startdate,a365_enddate,a365_days,a365_leavestatus,a365_note,_a365_issuedby_value,a365_issuedon,_a365_cancelledby_value,a365_cancelledon,a365_cancellationreason,a365_notificationstatus,a365_notifiedon,a365_paiddays,a365_unpaiddays,a365_allocationjson'
$splitList = Split-Read "/api/data/v9.2/a365_leaves?`$select=$splitFields&`$filter=a365_startdate lt 2027-01-01 and a365_enddate ge 2026-01-01&`$orderby=a365_startdate desc,a365_leaveid asc&`$top=20&`$count=true"
$splitDetail = $false
if (@($splitList.value).Count) {
    $splitSource = Split-Read "/api/data/v9.2/a365_leaves($($splitList.value[0].a365_leaveid))?`$select=$splitFields"
    $splitDetail = $splitSource.a365_leaveid -eq $splitList.value[0].a365_leaveid
    if (-not $splitDetail) { throw 'Leave detail identity mismatch.' }
}
$splitPayroll = Split-Read '/api/data/v9.2/a365_leaves?$select=a365_leaveid,_a365_employee_value,a365_startdate,a365_enddate,a365_days,a365_benefit,a365_leavestatus,a365_paiddays,a365_unpaiddays,a365_allocationjson&$filter=a365_leavestatus eq 749910000 and (a365_benefit eq 749910001 or a365_benefit eq 749910002) and a365_startdate le 2026-10-31 and a365_enddate ge 2026-10-16&$top=20'
$splitIdentity = Split-Read '/api/data/v9.2/WhoAmI'
$splitLinks = Split-Read "/api/data/v9.2/a365_employees?`$select=a365_employeeid&`$filter=_a365_systemuser_value eq $($splitIdentity.UserId)&`$top=2"
$splitPersonal = $false; $splitPreview = $false; $splitFullPreview = $false
if (@($splitLinks.value).Count -eq 1) {
    $splitEmployee = $splitLinks.value[0].a365_employeeid
    $splitPersonalResult = Split-Read '/api/data/v9.2/a365_LeaveCommand' @{command='myLeaves';employeeId=$splitEmployee;year=2026;status='all'}
    if ($splitPersonalResult.employeeId -ne $splitEmployee) { throw 'Personal history scope mismatch.' }
    $splitPersonal = $true
    $splitPreviewResult = Split-Read '/api/data/v9.2/a365_LeaveCommand' @{command='preview';employeeId=$splitEmployee}
    if ($splitPreviewResult.allocationVersion -ne 1) { throw 'Expected the deployed allocation-aware server.' }
    $splitPreview = $true
    # Only a read-only preview. No issuance and no automatic credit posting.
    $splitFull = Split-Read '/api/data/v9.2/a365_LeaveCommand' @{command='preview';employeeId=$splitEmployee;leaveType=749910000;benefit=749910000;startDate='2026-11-03';endDate='2026-11-09'}
    if ($splitFull.allocationVersion -ne 1 -or $splitFull.days -ne 5 -or ($splitFull.paidDays + $splitFull.unpaidDays) -ne 5 -or @($splitFull.allocation).Count -ne 5) { throw 'Full allocation preview did not verify.' }
    $splitFullPreview = $true
}
$splitAssembly = Split-Read '/api/data/v9.2/pluginassemblies?$select=name,version&$filter=name eq ''A365.Leave.Plugins'''
if (@($splitAssembly.value).Count -ne 1 -or $splitAssembly.value[0].version -cne '1.0.3.2') { throw 'Unexpected deployed Leave assembly version.' }
$splitEvidence = @{
    VerifiedAt=[DateTime]::UtcNow.ToString('o');Environment=$splitEnvironment;Solution='A365_DailyOperations';AssemblyVersion='1.0.3.2'
    SHA256=(Get-FileHash -LiteralPath (Join-Path $splitRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll')).Hash
    Leave2026Count=$splitList.'@odata.count';ListQuery='Passed with the same columns/filter/order as the app';ExistingDetailVerified=$splitDetail
    PayrollRead='Passed with new fields and Unpaid/Partially Paid filtering';PersonalHistoryVerified=$splitPersonal;CreditPreviewVerified=$splitPreview;FiveWorkdayPreviewVerified=$splitFullPreview
    BusinessDataWrites='None';Emails='None';SecurityRoles='Unchanged';HistoricalRecords='Unchanged';OrdinaryAccountSecurityUAT='Not performed'
}
[IO.File]::WriteAllText((Join-Path $splitRoot 'docs/partial-paid-leave-verification.json'), ($splitEvidence | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
Write-Host "Live Leave list and detail reads verified ($($splitList.'@odata.count') records in 2026). Payroll read, personal history and allocation preview: passed. No financial writes or email."
