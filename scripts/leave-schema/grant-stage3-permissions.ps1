# Explicit owner authorization: grant the planned Payroll Admin Leave access.
# Additive role change only; no role assignment, data writes, deletes or elevation.
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leaveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$leaveRoleId = '6217c17c-3ea8-f111-aaad-000d3a853079'
$leaveCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveContext = 'app=dataverse-skills/1.16.0;skill=dv-security;agent=codex'
$leaveAction = "/api/data/v9.2/roles($leaveRoleId)/Microsoft.Dynamics.CRM.AddPrivilegesRole"
function Invoke-LeaveRoleApi {
    param([string]$Path, [string]$Method = 'GET', [string]$BodyFile)
    if ($Method -eq 'GET') {
        if ($Path -notmatch '^/api/data/v9\.2/(roles\?|EntityDefinitions\(|RetrieveRolePrivilegesRole\()') { throw 'Read outside approved role scope.' }
    } elseif ($Method -ne 'POST' -or $Path -cne $leaveAction -or -not $BodyFile) { throw 'Only the additive action on the verified Payroll Admin role is permitted.' }
    $leaveArguments = @('api','request','--target','dataverse','--environment',$leaveEnvironment,'--path',$Path,'--method',$Method,'--context',$leaveContext)
    if ($Method -eq 'POST') { $leaveArguments += @('--body-file',$BodyFile,'--header','MSCRM.SolutionUniqueName:A365_DailyOperations') }
    $leaveOutput = & $leaveCli @leaveArguments
    if ($LASTEXITCODE -ne 0) { throw 'Dataverse role request failed. Read current privileges before any retry.' }
    if ($leaveOutput) { return (($leaveOutput -join "`n") | ConvertFrom-Json) }
}
$leaveApp = Get-Content -Raw -LiteralPath (Join-Path $leaveRoot 'power.config.json') | ConvertFrom-Json
if ($leaveApp.environmentId -cne 'b58b083e-d27d-eabd-a143-2a49dcb9d89a') { throw 'Unexpected Code App environment.' }
$leaveRoles = Invoke-LeaveRoleApi "/api/data/v9.2/roles?`$select=roleid,name,_businessunitid_value&`$filter=name eq 'A365 - Payroll Admin'"
if (@($leaveRoles.value).Count -ne 1 -or $leaveRoles.value[0].roleid -cne $leaveRoleId) { throw 'Expected the previously verified, unique Payroll Admin role.' }
$leaveRole = $leaveRoles.value[0]
$leaveExpected = [ordered]@{
    a365_leave = @('Create','Read','Write','Append','AppendTo')
    a365_leavecashconversion = @('Create','Read','Write','Append','AppendTo')
    a365_leavecredittransaction = @('Create','Read','Append')
    systemuser = @('AppendTo')
}
$leaveApproved = @()
foreach ($leaveTable in $leaveExpected.Keys) {
    $leaveMetadata = Invoke-LeaveRoleApi "/api/data/v9.2/EntityDefinitions(LogicalName='$leaveTable')?`$select=LogicalName,Privileges"
    foreach ($leaveType in $leaveExpected[$leaveTable]) {
        $leaveMatches = @($leaveMetadata.Privileges | Where-Object PrivilegeType -ceq $leaveType)
        if ($leaveMatches.Count -ne 1 -or -not $leaveMatches[0].CanBeGlobal) { throw "Missing or incompatible privilege: $leaveTable $leaveType" }
        $leaveApproved += [ordered]@{
            Table = $leaveTable; Type = $leaveType; PrivilegeName = $leaveMatches[0].Name
            PrivilegeId = $leaveMatches[0].PrivilegeId; Depth = 'Global'
        }
    }
}
if ($leaveApproved.Count -ne 14) { throw 'Expected exactly 14 approved grants.' }
$leaveBefore = Invoke-LeaveRoleApi "/api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=$leaveRoleId)"
$leaveMissing = @($leaveApproved | Where-Object {
    $leaveGrant = $_
    -not @($leaveBefore.RolePrivileges | Where-Object { $_.PrivilegeId -ceq $leaveGrant.PrivilegeId -and $_.Depth -ceq 'Global' }).Count
})
$leaveWork = Join-Path $PSScriptRoot '.work'
New-Item -ItemType Directory -Force -Path $leaveWork | Out-Null
if ($leaveMissing.Count) {
    $leavePayload = @{ Privileges = @($leaveMissing | ForEach-Object {
        @{ PrivilegeId = $_.PrivilegeId; PrivilegeName = $_.PrivilegeName; Depth = 'Global'; BusinessUnitId = $leaveRole._businessunitid_value }
    }) }
    $leavePayloadFile = Join-Path $leaveWork 'stage3-role-grant.json'
    [IO.File]::WriteAllText($leavePayloadFile, ($leavePayload | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText((Join-Path $leaveWork 'stage3-role-before.json'), ($leaveBefore | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
    Write-Host "Adding $($leaveMissing.Count) reviewed Organization-scope grants to A365 - Payroll Admin in Dev."
    Invoke-LeaveRoleApi $leaveAction 'POST' $leavePayloadFile | Out-Null
} else { Write-Host 'All approved grants already exist; no role write needed.' }
$leaveDeadline = [DateTime]::UtcNow.AddMinutes(2)
do {
    $leaveAfter = Invoke-LeaveRoleApi "/api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=$leaveRoleId)"
    $leaveUnverified = @($leaveApproved | Where-Object {
        $leaveGrant = $_
        -not @($leaveAfter.RolePrivileges | Where-Object { $_.PrivilegeId -ceq $leaveGrant.PrivilegeId -and $_.Depth -ceq 'Global' }).Count
    })
    if (-not $leaveUnverified.Count) { break }
    if ([DateTime]::UtcNow -ge $leaveDeadline) { throw 'Granted privileges are not all visible at Organization scope. Inspect before retrying.' }
    Start-Sleep -Seconds 5
} while ($true)
foreach ($leaveExisting in $leaveBefore.RolePrivileges) {
    if ($leaveApproved.PrivilegeId -contains $leaveExisting.PrivilegeId) { continue }
    if (-not @($leaveAfter.RolePrivileges | Where-Object { $_.PrivilegeId -ceq $leaveExisting.PrivilegeId -and $_.Depth -ceq $leaveExisting.Depth }).Count) { throw 'An unrelated privilege changed; inspect before continuing.' }
}
$leaveReport = [ordered]@{
    VerifiedAt = [DateTime]::UtcNow.ToString('o'); Environment = $leaveEnvironment
    Role = $leaveRole.name; RoleId = $leaveRoleId; GrantedNow = $leaveMissing.Count
    ApprovedPrivileges = $leaveApproved; Verified = $true; UnrelatedPrivilegesPreserved = $true
    Authorization = 'Owner explicitly requested granting Payroll Admin access, overriding the earlier manual-only instruction for these planned grants.'
    Scope = 'No Delete, Assign, Share, ledger Write, user-role assignment or System Administrator grant. No business records changed.'
}
[IO.File]::WriteAllText((Join-Path $leaveRoot 'docs/leave-permission-grant.json'), ($leaveReport | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
Write-Host 'Verified all 14 approved grants at Organization scope; unrelated role privileges preserved.'
