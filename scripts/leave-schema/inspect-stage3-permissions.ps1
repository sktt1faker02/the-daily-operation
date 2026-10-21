# Read-only role configuration inspection. Does not change roles or user access.
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leaveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$leaveCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
function Read-LeaveSecurity {
    param([string]$Path)
    if ($Path -notmatch '^/api/data/v9\.2/(roles\?|EntityDefinitions\(|RetrieveRolePrivilegesRole\()') { throw 'Read outside approved role-inspection scope.' }
    $leaveOutput = & $leaveCli api request --target dataverse --environment $leaveEnvironment --path $Path --method GET --context 'app=dataverse-skills/1.16.0;skill=dv-security;agent=codex'
    if ($LASTEXITCODE -ne 0) { throw 'Read-only role inspection failed.' }
    return (($leaveOutput -join "`n") | ConvertFrom-Json)
}
$leaveApp = Get-Content -Raw -LiteralPath (Join-Path $leaveRoot 'power.config.json') | ConvertFrom-Json
if ($leaveApp.environmentId -cne 'b58b083e-d27d-eabd-a143-2a49dcb9d89a') { throw 'Unexpected Code App environment.' }
$leaveTables = @{}
foreach ($leaveTableName in @('a365_leave','a365_leavecashconversion','a365_leavecredittransaction','a365_employee','systemuser')) {
    $leaveTables[$leaveTableName] = Read-LeaveSecurity "/api/data/v9.2/EntityDefinitions(LogicalName='$leaveTableName')?`$select=LogicalName,Privileges"
}
$leaveExpected = @{
    a365_leave = @('Create','Read','Write','Append','AppendTo')
    a365_leavecashconversion = @('Create','Read','Write','Append','AppendTo')
    a365_leavecredittransaction = @('Create','Read','Append')
}
$leaveReport = [ordered]@{
    VerifiedAt = [DateTime]::UtcNow.ToString('o'); Environment = $leaveEnvironment
    ConfigurationMatchesPlan = $true; Roles = @(); RoleWritesByThisInspection = 'None'
    EffectiveAccess = 'Not verified: other user/team roles, sharing and direct requests as ordinary users require separate verification.'
}
foreach ($leaveRoleName in @('A365 - Payroll Admin','A365 - Payroll Employee')) {
    $leaveRoles = Read-LeaveSecurity "/api/data/v9.2/roles?`$select=roleid,name,_businessunitid_value&`$filter=name eq '$leaveRoleName'"
    if (-not @($leaveRoles.value).Count) { throw "Role not found: $leaveRoleName" }
    foreach ($leaveRole in $leaveRoles.value) {
        $leavePrivileges = Read-LeaveSecurity "/api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=$($leaveRole.roleid))"
        $leaveChecks = @()
        foreach ($leaveTableName in $leaveTables.Keys) {
            foreach ($leavePrivilege in $leaveTables[$leaveTableName].Privileges) {
                $leaveIsSource = $leaveTableName -in @('a365_employee','systemuser')
                if ($leaveIsSource -and ($leaveRoleName -ne 'A365 - Payroll Admin' -or $leavePrivilege.PrivilegeType -notin @('Read','AppendTo'))) { continue }
                $leaveActual = @($leavePrivileges.RolePrivileges | Where-Object PrivilegeId -eq $leavePrivilege.PrivilegeId)
                $leaveActualDepth = if ($leaveActual.Count) { @($leaveActual.Depth) -join ',' } else { 'None' }
                $leaveExpectedDepth = if ($leaveRoleName -eq 'A365 - Payroll Admin' -and ($leaveIsSource -or $leaveExpected[$leaveTableName] -contains $leavePrivilege.PrivilegeType)) { 'Global' } else { 'None' }
                $leaveMatches = $leaveActualDepth -ceq $leaveExpectedDepth
                if (-not $leaveMatches) { $leaveReport.ConfigurationMatchesPlan = $false }
                $leaveChecks += [ordered]@{ Table = $leaveTableName; Privilege = $leavePrivilege.PrivilegeType; Actual = $leaveActualDepth; Expected = $leaveExpectedDepth; Matches = $leaveMatches }
            }
        }
        $leaveReport.Roles += [ordered]@{ Name = $leaveRole.name; RoleId = $leaveRole.roleid; Checks = $leaveChecks }
        Write-Host "$leaveRoleName : $(@($leaveChecks | Where-Object { -not $_.Matches }).Count) privilege differences"
        $leaveChecks | Where-Object { -not $_.Matches } | ForEach-Object { Write-Host "$($_.Table) $($_.Privilege): $($_.Actual); expected $($_.Expected)" }
    }
}
[IO.File]::WriteAllText((Join-Path $leaveRoot 'docs/leave-permissions-verification.json'), ($leaveReport | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
Write-Host "Role configuration matches plan: $($leaveReport.ConfigurationMatchesPlan). No roles changed."
