param([string]$ExpectedVersion = '1.0.2.0')
$ErrorActionPreference = 'Stop'
$conversionCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$conversionRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$conversionWork = Join-Path $PSScriptRoot '.work/conversion'
function Read-ConversionRelease([string]$Path) {
    $output = & $conversionCli api request --target dataverse --environment https://org9a7651f0.crm5.dynamics.com --path $Path --method GET --context 'app=dataverse-skills/1.16.0;skill=dv-solution;agent=codex'
    if ($LASTEXITCODE -ne 0) { throw "Read-only release verification failed for $Path : $($output -join ' ')" }
    return (($output -join "`n") | ConvertFrom-Json)
}
$assemblies = Read-ConversionRelease '/api/data/v9.2/pluginassemblies?$select=pluginassemblyid,name,version,content&$filter=name eq ''A365.Leave.Plugins'''
if (@($assemblies.value).Count -ne 1 -or $assemblies.value[0].version -cne $ExpectedVersion) { throw "Expected deployed Leave assembly $ExpectedVersion." }
$liveFile = Join-Path $conversionWork 'verified-release.dll'
[IO.File]::WriteAllBytes($liveFile, [Convert]::FromBase64String($assemblies.value[0].content))
$liveHash = (Get-FileHash -LiteralPath $liveFile -Algorithm SHA256).Hash
$localHash = (Get-FileHash -LiteralPath (Join-Path $conversionRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll') -Algorithm SHA256).Hash
if ($liveHash -cne $localHash) { throw 'Deployed Leave DLL differs from the tested local DLL.' }
$steps = Read-ConversionRelease '/api/data/v9.2/sdkmessageprocessingsteps?$select=name,stage,mode,statecode&$filter=startswith(name,''A365 Conversion Guard '')'
foreach ($table in @('a365_leaveconversionyear', 'a365_leavecashconversion')) {
    foreach ($message in @('Create', 'Update', 'Delete', 'CreateMultiple', 'UpdateMultiple', 'Assign', 'SetState')) {
        $matching = @($steps.value | Where-Object name -ceq "A365 Conversion Guard $table $message")
        if ($matching.Count -ne 1 -or $matching[0].stage -ne 20 -or $matching[0].mode -ne 0 -or $matching[0].statecode -ne 0) { throw "Missing or inactive conversion guard: $table $message" }
    }
}
$requestFile = Join-Path $conversionWork 'verify-years.json'
[IO.File]::WriteAllText($requestFile, '{"Request":"{\"command\":\"conversionYears\"}"}', (New-Object Text.UTF8Encoding($false)))
$output = & $conversionCli api request --target dataverse --environment https://org9a7651f0.crm5.dynamics.com --path '/api/data/v9.2/a365_LeaveCommand' --method POST --body-file $requestFile --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
if ($LASTEXITCODE -ne 0) { throw 'Live read-only conversionYears failed.' }
$years = ((($output -join "`n") | ConvertFrom-Json).Response | ConvertFrom-Json)
if ($null -eq $years.years -or $null -eq $years.nextYear) { throw 'Unconfirmed live year-list response.' }
if ([version]$ExpectedVersion -ge [version]'1.0.3.0' -and @($years.years | Where-Object { $_.paid -isnot [bool] }).Count) { throw 'Payment status missing from year-list response.' }
$counts = @()
foreach ($table in @('a365_leaveconversionyears', 'a365_leavecashconversions')) {
    $primaryId = if ($table -ceq 'a365_leaveconversionyears') { 'a365_leaveconversionyearid' } else { 'a365_leavecashconversionid' }
    $result = Read-ConversionRelease "/api/data/v9.2/$($table)?`$select=$primaryId&`$count=true&`$top=1"
    $counts += @{ EntitySet = $table; Records = $result.'@odata.count' }
}
$report = [ordered]@{
    VerifiedAt = [DateTime]::UtcNow.ToString('o')
    Environment = 'https://org9a7651f0.crm5.dynamics.com'
    AssemblyVersion = $ExpectedVersion
    AssemblySHA256 = $liveHash
    ConversionWriteGuards = @($steps.value)
    YearListRead = 'Passed'
    StoredYears = @($years.years).Count
    NextYear = $years.nextYear
    RecordCounts = $counts
    LiveFinancialWrites = 'Not performed'
    OrdinaryAccountChecks = 'Not performed'
}
[IO.File]::WriteAllText((Join-Path $conversionRoot 'docs/leave-conversion-release-verification.json'), ($report | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding($false)))
Write-Host "Verified deployed DLL hash, $(@($steps.value).Count) active conversion guards and live year-list read. No business writes."
