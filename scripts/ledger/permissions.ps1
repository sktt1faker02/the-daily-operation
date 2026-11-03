param([switch]$Apply)
# Additive role grants only, gated on installed guards. Not run during this task.
$ErrorActionPreference='Stop'
$ledgerCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$ledgerEnvironment='https://org9a7651f0.crm5.dynamics.com'
$ledgerWork=Join-Path $PSScriptRoot '.work/permissions'
New-Item -ItemType Directory -Force -Path $ledgerWork|Out-Null
function Permission-Api([string]$Path,[string]$Method='GET',$Body=$null) {
    if($Path -notmatch '^/api/data/v9\.2/(roles|EntityDefinitions|RetrieveRolePrivilegesRole|sdkmessageprocessingsteps)'){throw 'Outside ledger role scope.'}
    if($Method -ne 'GET' -and (-not $Apply -or $Path -notmatch '^/api/data/v9\.2/roles\([0-9a-f-]+\)/Microsoft.Dynamics.CRM.AddPrivilegesRole$')){throw 'Only explicit additive role grants allowed.'}
    $arguments=@('api','request','--target','dataverse','--environment',$ledgerEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-security;agent=codex')
    if($Method -ne 'GET'){$file=Join-Path $ledgerWork 'request.json';[IO.File]::WriteAllText($file,($Body|ConvertTo-Json -Depth 15 -Compress),(New-Object Text.UTF8Encoding($false)));$arguments+=@('--body-file',$file,'--header','MSCRM.SolutionUniqueName:A365_DailyOperations')}
    $result=& $ledgerCli @arguments;if($LASTEXITCODE -ne 0){throw 'Ledger role request failed; inspect before retrying.'};if($result){return (($result -join "`n")|ConvertFrom-Json)}
}
$role=Permission-Api '/api/data/v9.2/roles?$select=roleid,name,_businessunitid_value&$filter=name eq ''A365 - Payroll Admin'''
if(@($role.value).Count -ne 1 -or $role.value[0].roleid -cne '6217c17c-3ea8-f111-aaad-000d3a853079'){throw 'Unexpected Payroll Admin role.'}
$role=$role.value[0]
$expected=[ordered]@{a365_ledgertransaction=@('Create','Read','Write','Delete','Append');a365_ledgeroperation=@('Read');a365_ledgerhistory=@('Create','Read','Write','Append');a365_payrollperiod=@('Read','Write','AppendTo');a365_employee=@('Read','AppendTo');systemuser=@('Read','AppendTo')}
$grants=@()
foreach($table in $expected.Keys) {
    $meta=Permission-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$table')?`$select=LogicalName,Privileges"
    foreach($type in $expected[$table]) {
        $matches=@($meta.Privileges|Where-Object PrivilegeType -ceq $type)
        if($matches.Count -ne 1 -or -not $matches[0].CanBeGlobal){throw "Missing expected privilege $table/$type"}
        $grants+=@{PrivilegeId=$matches[0].PrivilegeId;PrivilegeName=$matches[0].Name;Depth='Global';BusinessUnitId=$role._businessunitid_value}
    }
}
$before=Permission-Api "/api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=$($role.roleid))"
$missing=@($grants|Where-Object {$grant=$_;-not @($before.RolePrivileges|Where-Object {$_.PrivilegeId -ceq $grant.PrivilegeId -and $_.Depth -ceq 'Global'}).Count})
if(-not $Apply){Write-Host "Read-only ledger role proposal: $($missing.Count) missing additive grants; none applied. No coordination, operation Write/Delete, assignments or elevation.";return}
foreach($table in @('a365_ledgertransaction','a365_ledgeroperation','a365_ledgercoordination','a365_ledgerhistory')) {
    foreach($message in @('Create','Update','Delete')) {
        $name="A365 Ledger ProtectLedgerWrites $table $message"
        $steps=Permission-Api "/api/data/v9.2/sdkmessageprocessingsteps?`$select=name,stage,mode,statecode&`$filter=name eq '$name'"
        if(@($steps.value).Count -ne 1 -or $steps.value[0].stage -ne 20 -or $steps.value[0].mode -ne 0 -or $steps.value[0].statecode -ne 0){throw 'Active synchronous Ledger guards must be verified before grants.'}
    }
}
if($missing.Count){Permission-Api "/api/data/v9.2/roles($($role.roleid))/Microsoft.Dynamics.CRM.AddPrivilegesRole" POST @{Privileges=$missing}|Out-Null}
$after=Permission-Api "/api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=$($role.roleid))"
foreach($grant in $grants){if(-not @($after.RolePrivileges|Where-Object {$_.PrivilegeId -ceq $grant.PrivilegeId -and $_.Depth -ceq 'Global'}).Count){throw 'A ledger grant is not yet visible; inspect propagation before retry.'}}
foreach($old in $before.RolePrivileges){if(-not @($after.RolePrivileges|Where-Object {$_.PrivilegeId -ceq $old.PrivilegeId -and $_.Depth -ceq $old.Depth}).Count){throw 'Unrelated role privilege changed; inspect immediately.'}}
Write-Host 'Ledger grants verified; unrelated privileges preserved. No financial rows changed.'
