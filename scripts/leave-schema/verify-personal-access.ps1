# Read-only effective-access checks using Dataverse's supported user
# impersonation header. Never changes users, roles, links or financial records.
$ErrorActionPreference = 'Stop'
$portalRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$portalCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$portalEnv = 'https://org9a7651f0.crm5.dynamics.com'
$portalWork = Join-Path $PSScriptRoot '.work/personal-reads'
New-Item -ItemType Directory -Force -Path $portalWork | Out-Null
function Invoke-PersonalCheck([string]$Path, [string]$Caller, $Request) {
    $arguments = @('api','request','--target','dataverse','--environment',$portalEnv,'--path',$Path,'--context','app=dataverse-skills/1.16.0;skill=dv-security;agent=codex')
    if ($Caller) { $arguments += @('--header',"CallerObjectId:$Caller") }
    if ($null -ne $Request) {
        if ($Path -cne '/api/data/v9.2/a365_LeaveCommand' -or $Request.command -notin @('myLeaves','myLeave','myCredits','diagnostics')) { throw 'Only read-only API commands are permitted.' }
        $payload = Join-Path $portalWork 'read-check.json'
        [IO.File]::WriteAllText($payload, (@{Request=($Request | ConvertTo-Json -Compress)} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
        $arguments += @('--method','POST','--body-file',$payload)
    } else {
        if ($Path -notmatch '^/api/data/v9\.2/(WhoAmI|a365_employees|a365_leaves|roles|systemusers)') { throw 'Outside read-only access-check scope.' }
        $arguments += @('--method','GET')
    }
    # Capture errors without writing backend record values into the report.
    $previousPreference = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $output = & $portalCli @arguments 2>&1
    $exitCode = $LASTEXITCODE; $ErrorActionPreference = $previousPreference
    if ($exitCode -ne 0) {
        $category = if (($output -join ' ') -match 'prvActOnBehalfOfAnotherUser') { 'Impersonation privilege unavailable' } elseif (($output -join ' ') -match '(?i)disabled') { 'Target account disabled' } elseif (($output -join ' ') -match '(?i)license') { 'Target account license/access restriction' } else { 'Dataverse request failed' }
        return @{ Success=$false; Data=$null; Category=$category }
    }
    try { return @{ Success=$true; Data=(($output -join "`n") | ConvertFrom-Json) } } catch { return @{ Success=$false; Data=$null } }
}
function Must([bool]$Value,[string]$Label) { if (-not $Value) { throw "Personal access check failed: $Label" }; $script:portalChecks += $Label }
$portalChecks = @()
$portalIdentity = Invoke-PersonalCheck '/api/data/v9.2/WhoAmI' '' $null
Must $portalIdentity.Success 'Authenticated Dev connection'
$portalLinks = Invoke-PersonalCheck '/api/data/v9.2/a365_employees?$select=a365_employeeid,_a365_systemuser_value&$filter=_a365_systemuser_value ne null&$top=50' '' $null
Must $portalLinks.Success 'Read employee account mappings for access verification'
$portalCandidates = @()
foreach ($link in $portalLinks.Data.value) {
    $user = $link._a365_systemuser_value
    $roles = Invoke-PersonalCheck "/api/data/v9.2/roles?`$select=name&`$filter=systemuserroles_association/any(u:u/systemuserid eq $user) or teamroles_association/any(t:t/teammembership_association/any(u:u/systemuserid eq $user))" '' $null
    if (-not $roles.Success) { throw 'Cannot verify the test account role memberships.' }
    $names = @($roles.Data.value.name)
    if ($names -contains 'A365 - Payroll Employee' -and $names -notcontains 'A365 - Payroll Admin' -and $names -notcontains 'System Administrator') { $portalCandidates += $link }
}
$portalOrdinary = 0
$portalLimit = 'Direct signed-in browser UAT remains separate from server impersonation checks.'
foreach ($link in @($portalCandidates | Select-Object -First 2)) {
    $user = $link._a365_systemuser_value; $employee = $link.a365_employeeid
    $directory = Invoke-PersonalCheck "/api/data/v9.2/systemusers($user)?`$select=azureactivedirectoryobjectid" '' $null
    Must ($directory.Success -and [bool]$directory.Data.azureactivedirectoryobjectid) 'Ordinary employee directory identity resolved'
    $callerObject = $directory.Data.azureactivedirectoryobjectid
    $who = Invoke-PersonalCheck '/api/data/v9.2/WhoAmI' $callerObject $null
    if (-not $who.Success -or $who.Data.UserId -ine $user) {
        $portalLimit = if (-not $who.Success) { "Ordinary-account impersonation could not be verified: $($who.Category). Direct employee A/B checks remain unverified." } else { 'The CLI did not return the requested impersonated user identity. Direct employee A/B checks remain unverified.' }
        Write-Host $portalLimit
        break
    }
    $own = Invoke-PersonalCheck '/api/data/v9.2/a365_LeaveCommand' $callerObject @{command='myLeaves';employeeId=$employee;year=2026;status='all'}
    Must $own.Success 'Ordinary employee can read own leave history'
    $ownRows = $own.Data.Response | ConvertFrom-Json
    Must ($ownRows.employeeId -ceq $employee -and @($ownRows.rows | Where-Object { $_._a365_employee_value -cne $employee }).Count -eq 0) 'Own history response contains only caller employee'
    $credits = Invoke-PersonalCheck '/api/data/v9.2/a365_LeaveCommand' $callerObject @{command='myCredits';employeeId=$employee;year=2026}
    Must $credits.Success 'Ordinary employee can read own scoped credit history'
    $other = @($portalLinks.Data.value | Where-Object { $_.a365_employeeid -cne $employee } | Select-Object -First 1)
    if ($other.Count) {
        $spoof = Invoke-PersonalCheck '/api/data/v9.2/a365_LeaveCommand' $callerObject @{command='myLeaves';employeeId=$other[0].a365_employeeid;year=2026}
        Must (-not $spoof.Success) 'Spoofed employee scope denied by live server'
    }
    $foreign = Invoke-PersonalCheck "/api/data/v9.2/a365_leaves?`$select=a365_leaveid&`$filter=_a365_employee_value ne $employee&`$top=1" '' $null
    Must $foreign.Success 'Locate a foreign leave ID without reading its business details'
    if (@($foreign.Data.value).Count) {
        $foreignId = $foreign.Data.value[0].a365_leaveid
        $detail = Invoke-PersonalCheck '/api/data/v9.2/a365_LeaveCommand' $callerObject @{command='myLeave';employeeId=$employee;operationId=$foreignId}
        Must (-not $detail.Success) 'Foreign detail ID denied by live personal API'
        $direct = Invoke-PersonalCheck "/api/data/v9.2/a365_leaves($foreignId)?`$select=a365_leaveid" $callerObject $null
        Must (-not $direct.Success) 'Direct Dataverse access to foreign leave denied'
    }
    $adminOnly = Invoke-PersonalCheck '/api/data/v9.2/a365_LeaveCommand' $callerObject @{command='diagnostics'}
    Must (-not $adminOnly.Success) 'Existing admin command gate denies ordinary employee'
    $portalOrdinary++
}
$portalAdminLink = @($portalLinks.Data.value | Where-Object { $_._a365_systemuser_value -ceq $portalIdentity.Data.UserId })
if ($portalAdminLink.Count -eq 1) {
    $adminRead = Invoke-PersonalCheck '/api/data/v9.2/a365_LeaveCommand' '' @{command='myLeaves';employeeId=$portalAdminLink[0].a365_employeeid;year=2026}
    Must $adminRead.Success 'Authenticated linked admin can read own personal history'
}
$portalReport = [ordered]@{ Environment=$portalEnv; VerifiedAt=[DateTime]::UtcNow.ToString('o'); Checks=$portalChecks; OrdinaryEmployeeAccountsVerified=$portalOrdinary; EligibleOrdinaryAccounts=@($portalCandidates).Count; Method='Read-only requests; ordinary-account checks count only after impersonated WhoAmI identity is verified'; Limits=if($portalOrdinary -lt 2 -and $portalLimit -like 'Direct signed-in*'){'Fewer than two eligible ordinary employee accounts available; remaining signed-in A/B checks are unverified.'}else{$portalLimit}; BusinessWrites='None' }
[IO.File]::WriteAllText((Join-Path $portalRoot 'docs/leave-history-effective-access.json'), ($portalReport | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
Write-Host "Verified $($portalChecks.Count) read-only access checks; $portalOrdinary ordinary employee accounts. Report contains no names, account IDs or leave values."
