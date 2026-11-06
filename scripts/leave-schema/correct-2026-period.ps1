param([switch]$Apply)
# Owner-authorized Dev correction. No direct ledger updates or guard bypass.
$ErrorActionPreference = 'Stop'
$correctionRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$correctionWork = Join-Path $PSScriptRoot ('.work/calendar-correction/run-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $correctionWork | Out-Null
$correctionCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$correctionEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
function Request-Correction([string]$Path, [string]$Method = 'GET', $Body = $null) {
    $arguments = @('api','request','--target','dataverse','--environment',$correctionEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-data;agent=codex')
    if ($Body) {
        $bodyPath = Join-Path $correctionWork 'request.json'
        [IO.File]::WriteAllText($bodyPath, ($Body | ConvertTo-Json -Depth 10 -Compress))
        $arguments += @('--body-file', $bodyPath)
    }
    $raw = & $correctionCli @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Correction request unconfirmed. Inspect server state and receipts before retry.' }
    if ($raw) { return (($raw -join "`n") | ConvertFrom-Json) }
}
function Read-Correction([string]$Path) {
    $rows = @(); $seen = @{}
    do {
        if ($seen.ContainsKey($Path)) { throw 'Repeated pagination cursor.' }; $seen[$Path] = $true
        $page = Request-Correction $Path; $rows += @($page.value)
        $Path = $page.'@odata.nextLink'; if ($Path) { $Path = ([uri]$Path).PathAndQuery }
    } while ($Path)
    return ,$rows
}
function Send-Correction($Request) {
    $result = Request-Correction '/api/data/v9.2/a365_LeaveCommand' 'POST' @{Request=($Request | ConvertTo-Json -Compress)}
    return ($result.Response | ConvertFrom-Json)
}
$who = Request-Correction '/api/data/v9.2/WhoAmI'
if ($who.OrganizationId -ne 'fe0edb27-c4a6-f111-aaa0-002248ed6f85') { throw 'Unexpected Dev organization.' }
$creditPath = '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid,a365_creditperiod,a365_year,a365_days,a365_transactionkey,a365_periodkey,_a365_employee_value,_a365_leave_value,_a365_cashconversion_value,a365_transactiontype,a365_creditpool,a365_note&$filter=a365_year eq 2026&$orderby=a365_leavecredittransactionid'
$before = Read-Correction $creditPath
$before | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $correctionWork 'before.json')
$employees = @($before | Where-Object { $_.a365_creditperiod -eq '2026-04-01' } | ForEach-Object { $_._a365_employee_value } | Sort-Object -Unique)
$results = @(); $corrected = 0
foreach ($employee in $employees) {
    $review = Send-Correction @{command='correct2026Preview';year=2026;employeeId=$employee}
    $review | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $correctionWork ($employee + '-review.json'))
    if ($Apply) {
        $result = Send-Correction @{command='correct2026';year=2026;employeeId=$employee;version=$review.version}
        $corrected += $result.affected; $results += $result
        $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $correctionWork ($employee + '-result.json'))
        $retry = Send-Correction @{command='correct2026';year=2026;employeeId=$employee;version=$review.version}
        if ($retry.affected -ne 0) { throw 'Correction retry was not idempotent.' }
    } else { $results += $review }
}
$after = Read-Correction $creditPath
$after | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $correctionWork 'after.json')
if ($Apply) {
    if (@($after | Where-Object { $_.a365_creditperiod -ne '2026-01-01' }).Count) { throw '2026 still contains an uncorrected period.' }
    if ($after.Count -ne $before.Count + $corrected) { throw 'Unexpected ledger record count after correction.' }
    foreach ($original in $before) {
        $saved = @($after | Where-Object { $_.a365_leavecredittransactionid -eq $original.a365_leavecredittransactionid })
        if ($saved.Count -ne 1) { throw 'An original credit identity was lost.' }
        foreach ($field in @('a365_days','a365_year','_a365_employee_value','_a365_leave_value','_a365_cashconversion_value','a365_transactiontype','a365_creditpool','a365_note')) {
            if ($saved[0].$field -cne $original.$field) { throw "Unexpected mutation of $field" }
        }
    }
    foreach ($group in ($before | Group-Object _a365_employee_value,a365_creditpool)) {
        [decimal]$oldTotal = 0; [decimal]$newTotal = 0
        foreach ($row in $group.Group) { $oldTotal += [decimal]$row.a365_days }
        foreach ($row in $after | Where-Object { $_._a365_employee_value -eq $group.Group[0]._a365_employee_value -and $_.a365_creditpool -eq $group.Group[0].a365_creditpool }) { $newTotal += [decimal]$row.a365_days }
        if ($oldTotal -ne $newTotal) { throw 'Employee signed balance changed.' }
    }
}
$evidence = [ordered]@{ Environment=$correctionEnvironment; Year=2026; PeriodStart='2026-01-01'; PeriodEnd='2026-12-31'; Applied=[bool]$Apply; EmployeeCount=$employees.Count; CorrectedRows=$corrected; OriginalRows=$before.Count; FinalRows=$after.Count; AuditReceipts=$corrected; OriginalAmountsAndLinks=$(if($Apply){'Verified unchanged'}else{'Preview only'}); PerEmployeeSignedTotals=$(if($Apply){'Verified unchanged'}else{'Preview only'}); Retry=$(if($Apply){'Verified no additional rows'}else{'Not run (preview only)'}); VerifiedAt=[DateTime]::UtcNow.ToString('o'); Production='Unchanged' }
if ($Apply) { $evidence | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $correctionRoot 'docs/leave-2026-correction-verification.json') }
$evidence | ConvertTo-Json
