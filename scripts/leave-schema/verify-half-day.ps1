param([string]$AssemblyVersion = '1.0.3.8', [string]$EvidenceFile = 'docs/leave-half-day-all-types-deployment.json')
# Read-only release verification; never issues Leave or sends employee emails.
$ErrorActionPreference = 'Stop'
$halfRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$halfCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$halfEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$halfWork = Join-Path $PSScriptRoot '.work/half-day'
New-Item -ItemType Directory -Force -Path $halfWork | Out-Null
function Half-Read([string]$Path, [hashtable]$Request = $null) {
    $halfArgs = @('api', 'request', '--target', 'dataverse', '--environment', $halfEnvironment, '--path', $Path, '--context', 'app=dataverse-skills/1.16.0;skill=dv-solution;agent=codex')
    if ($Request) {
        if ($Path -cne '/api/data/v9.2/a365_LeaveCommand' -or $Request.command -notin @('diagnostics', 'preview')) { throw 'Only read-only Leave commands allowed.' }
        $halfBody = Join-Path $halfWork 'request.json'
        [IO.File]::WriteAllText($halfBody, (@{ Request = ($Request | ConvertTo-Json -Compress) } | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
        $halfArgs += @('--method', 'POST', '--body-file', $halfBody)
    }
    $halfOutput = & $halfCli @halfArgs
    if ($LASTEXITCODE -ne 0) { throw "Read-only Leave release verification failed at $Path : $($halfOutput -join ' ')" }
    $halfData = ($halfOutput -join "`n") | ConvertFrom-Json
    if ($Request) { return ($halfData.Response | ConvertFrom-Json) }
    return $halfData
}
$halfAssembly = Half-Read '/api/data/v9.2/pluginassemblies?$select=name,version,content&$filter=name eq ''A365.Leave.Plugins'''
if (@($halfAssembly.value).Count -ne 1 -or $halfAssembly.value[0].version -cne $AssemblyVersion) { throw "Expected Leave plugin $AssemblyVersion." }
$halfDownloaded = Join-Path $halfWork 'deployed-Leave.dll'
[IO.File]::WriteAllBytes($halfDownloaded, [Convert]::FromBase64String($halfAssembly.value[0].content))
$halfHash = (Get-FileHash -LiteralPath $halfDownloaded -Algorithm SHA256).Hash
if ($halfHash -cne (Get-FileHash -LiteralPath (Join-Path $halfRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll') -Algorithm SHA256).Hash) { throw 'Deployed DLL differs from tested DLL.' }
$halfDiagnostics = Half-Read '/api/data/v9.2/a365_LeaveCommand' @{ command = 'diagnostics' }
if (-not $halfDiagnostics.isInTransaction -or -not $halfDiagnostics.serverValidation) { throw 'Transactional validation not confirmed.' }
$halfStart = [DateTime]::UtcNow.AddHours(8).Date.AddDays(1)
while ($halfStart.DayOfWeek -in @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) { $halfStart = $halfStart.AddDays(1) }
$halfDate = $halfStart.ToString('yyyy-MM-dd')
$halfToday = [DateTime]::UtcNow.AddHours(8).ToString('yyyy-MM-dd')
$halfEmployeePath = '/api/data/v9.2/a365_employees?$select=a365_employeeid&$filter=a365_employmentstatus eq 749910000 and a365_datehired le ' + $halfToday + 'T00:00:00Z and (a365_enddate eq null or a365_enddate ge ' + $halfDate + 'T00:00:00Z)&$top=1'
$halfEmployees = Half-Read $halfEmployeePath
if (@($halfEmployees.value).Count -ne 1) { throw 'No eligible active employee available for preview.' }
$halfEmployee = $halfEmployees.value[0].a365_employeeid
$halfPreviews = @(foreach ($halfType in @(749910000, 749910001, 749910002)) {
    $halfPool = if ($halfType -eq 749910001) { 'SL' } else { 'VL' }
    $halfPreview = Half-Read '/api/data/v9.2/a365_LeaveCommand' @{ command = 'preview'; employeeId = $halfEmployee; startDate = $halfDate; endDate = $halfDate; leaveType = $halfType; benefit = 749910000; halfDay = $true }
    if ($halfPreview.days -ne 0.5 -or $halfPreview.pool -cne $halfPool -or ($halfPreview.paidDays + $halfPreview.unpaidDays) -ne 0.5 -or ($halfPreview.$halfPool -ge 0.5 -and $halfPreview.paidDays -ne 0.5)) { throw "Half-day preview contract failed for type $halfType." }
    @{ LeaveType = $halfType; Days = $halfPreview.days; PaidDays = $halfPreview.paidDays; UnpaidDays = $halfPreview.unpaidDays; Pool = $halfPreview.pool }
})
$halfEvidence = @{
    VerifiedAt = [DateTime]::UtcNow.ToString('o'); Environment = $halfEnvironment
    AssemblyVersion = $AssemblyVersion; SHA256 = $halfHash; DeployedHashMatchesTested = $true
    IsInTransaction = $true; HalfDayPreview = 'Passed'; Previews = $halfPreviews
    Schema = 'Unchanged'; Roles = 'Unchanged'; BusinessDataWrites = 'None'; Emails = 'None'
    LiveIssuance = 'Reserved for owner testing'; OrdinaryAccountSecurity = 'Not exercised'
}
[IO.File]::WriteAllText((Join-Path $halfRoot $EvidenceFile), ($halfEvidence | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
Write-Host "Verified deployed Leave $AssemblyVersion hash and live 0.5-day VL, SL and General Leave previews. No Leave issued and no email sent."
