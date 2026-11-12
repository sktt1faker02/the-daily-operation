param([string]$AssemblyVersion='1.0.3.13',[string]$ExpectedSHA256='')
# Read-only Dev verification. Never issues/deletes Leave or sends email.
$ErrorActionPreference='Stop'
$splitRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$splitCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$splitEnvironment='https://org9a7651f0.crm5.dynamics.com'
$splitWork=Join-Path $PSScriptRoot '.work/manual-split'
New-Item -ItemType Directory -Force -Path $splitWork|Out-Null
function Split-Read([string]$Path,[hashtable]$Request=$null,[switch]$AllowValidationFailure) {
    $arguments=@('api','request','--target','dataverse','--environment',$splitEnvironment,'--path',$Path,'--context','app=dataverse-skills/1.16.0;skill=dv-query;agent=codex')
    if($Request) {
        if($Path -cne '/api/data/v9.2/a365_LeaveCommand' -or $Request.command -notin @('diagnostics','preview')){throw 'Read-only commands only.'}
        $body=Join-Path $splitWork 'readonly.json'
        [IO.File]::WriteAllText($body,(@{Request=($Request|ConvertTo-Json -Compress)}|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
        $arguments+=@('--method','POST','--body-file',$body)
    }
    $previous=$ErrorActionPreference; $ErrorActionPreference='Continue'
    $raw=& $splitCli @arguments 2>&1; $code=$LASTEXITCODE; $ErrorActionPreference=$previous
    if($code -ne 0){
        if($AllowValidationFailure -and ($raw -join ' ') -like '*LEAVE:*'){return $null}
        throw 'Read-only manual split verification failed; inspect the Dev API response.'
    }
    $data=($raw -join "`n")|ConvertFrom-Json
    if($Request){return ($data.Response|ConvertFrom-Json)}
    return $data
}
$assembly=Split-Read '/api/data/v9.2/pluginassemblies(1d8034c7-e2cd-f111-a05a-000d3a8014e4)?$select=name,version,content'
if($assembly.version -cne $AssemblyVersion){throw 'Unexpected installed Leave version.'}
$download=Join-Path $splitWork 'installed.dll'
[IO.File]::WriteAllBytes($download,[Convert]::FromBase64String($assembly.content))
$hash=(Get-FileHash $download -Algorithm SHA256).Hash
if(-not $ExpectedSHA256){$ExpectedSHA256=(Get-FileHash (Join-Path $splitRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll') -Algorithm SHA256).Hash}
if($hash -cne $ExpectedSHA256){throw 'Installed Leave DLL differs from tested build.'}
$before=Split-Read '/api/data/v9.2/a365_leaves?$select=a365_leaveid&$count=true&$top=1'
$credits=Split-Read '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$count=true&$top=1'
$diagnostics=Split-Read '/api/data/v9.2/a365_LeaveCommand' @{command='diagnostics'}
if(-not $diagnostics.isInTransaction -or -not $diagnostics.serverValidation){throw 'Transactional API context not verified.'}
$today=[datetime]::UtcNow.AddHours(8).Date
$employees=Split-Read ('/api/data/v9.2/a365_employees?$select=a365_employeeid&$filter=a365_employmentstatus eq 749910000 and a365_datehired le '+$today.ToString('yyyy-MM-dd')+'T00:00:00Z&$top=10')
$verified=$false; $testRequest=$null
foreach($employee in $employees.value){
    for($offset=1;$offset -le 7;$offset++){
        $day=$today.AddDays($offset)
        if($day.Year -ne $today.Year -or $day.DayOfWeek -in @([DayOfWeek]::Saturday,[DayOfWeek]::Sunday)){continue}
        $request=@{command='preview';employeeId=$employee.a365_employeeid;startDate=$day.ToString('yyyy-MM-dd');endDate=$day.ToString('yyyy-MM-dd');leaveType=749910000;benefit=749910000;halfDay=$false;manualPaidDays=0.5}
        $preview=Split-Read '/api/data/v9.2/a365_LeaveCommand' $request -AllowValidationFailure
        if($null -eq $preview){continue}
        if($preview.manualPaidDays -ne 0.5 -or $preview.days -ne 1 -or $preview.paidDays -ne 0.5 -or $preview.unpaidDays -ne 0.5 -or $preview.benefit -ne 749910002 -or @($preview.allocation).Count -ne 1 -or $preview.allocation[0].paidDays -ne 0.5 -or $preview.allocation[0].unpaidDays -ne 0.5){throw 'Unexpected manual split preview contract.'}
        $verified=$true; $testRequest=$request; break
    }
    if($verified){break}
}
if(-not $verified){throw 'No eligible non-overlapping one-day VL preview with 0.5 available credit was verified. No live records were changed.'}
$testRequest.manualPaidDays=1.001
$invalid=Split-Read '/api/data/v9.2/a365_LeaveCommand' $testRequest -AllowValidationFailure
if($null -ne $invalid){throw 'Server accepted an invalid manual paid amount.'}
$after=Split-Read '/api/data/v9.2/a365_leaves?$select=a365_leaveid&$count=true&$top=1'
$afterCredits=Split-Read '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$count=true&$top=1'
if($before.'@odata.count' -ne $after.'@odata.count' -or $credits.'@odata.count' -ne $afterCredits.'@odata.count'){throw 'Counts changed during read-only verification; inspect concurrent activity.'}
$evidence=[ordered]@{VerifiedAt=[datetime]::UtcNow.ToString('o');Environment=$splitEnvironment;EnvironmentId='b58b083e-d27d-eabd-a143-2a49dcb9d89a';AssemblyVersion=$AssemblyVersion;SHA256=$hash;OneDayVLPaid=0.5;OneDayVLUnpaid=0.5;Benefit='Partially Paid';ManualModeEchoVerified=$true;InvalidAmountRejected=$true;TransactionContextVerified=$true;SourceAndCreditCountsUnchanged=$true;BusinessDataWrites='None';EmailsSent=$false;LiveIssuanceDeletionSecurity='Owner UAT pending'}
$evidence|ConvertTo-Json -Depth 5|Set-Content -Encoding UTF8 (Join-Path $splitRoot 'docs/leave-manual-split-deployment.json')
$evidence|ConvertTo-Json -Depth 5
