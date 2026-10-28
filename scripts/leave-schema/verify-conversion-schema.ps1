$ErrorActionPreference='Stop'
$conversionRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$conversionCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
function Read-Conversion([string]$Path){
    $output=& $conversionCli api request --target dataverse --environment https://org9a7651f0.crm5.dynamics.com --path $Path --method GET --context 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex'
    if($LASTEXITCODE -ne 0){throw 'Read-only conversion verification failed.'}
    return (($output -join "`n")|ConvertFrom-Json)
}
$report=[ordered]@{VerifiedAt=[DateTime]::UtcNow.ToString('o');Environment='https://org9a7651f0.crm5.dynamics.com';Tables=@();RoleChanges='Only four approved parent Payroll Admin privileges';LiveOrdinaryAccountChecks='Not performed';ServerAndAppDeployment='Pending explicit request'}
foreach($table in @('a365_leaveconversionyear','a365_leavecashconversion')){
    $definition=Read-Conversion "/api/data/v9.2/EntityDefinitions(LogicalName='$table')?`$select=LogicalName,SchemaName,EntitySetName,PrimaryIdAttribute,IsOptimisticConcurrencyEnabled,Privileges&`$expand=Keys(`$select=LogicalName,KeyAttributes,EntityKeyIndexStatus),ManyToOneRelationships(`$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName,ReferencedEntity)"
    if(@($definition.Keys).Count -ne 1 -or $definition.Keys[0].EntityKeyIndexStatus -cne 'Active' -or -not $definition.IsOptimisticConcurrencyEnabled){throw 'Conversion unique index/concurrency is not ready.'}
    $count=Read-Conversion "/api/data/v9.2/$($definition.EntitySetName)?`$select=$($definition.PrimaryIdAttribute)&`$count=true&`$top=1"
    $report.Tables+=@{LogicalName=$definition.LogicalName;SchemaName=$definition.SchemaName;EntitySetName=$definition.EntitySetName;Keys=$definition.Keys;Records=$count.'@odata.count';OptimisticConcurrency=$true;BusinessLookups=@($definition.ManyToOneRelationships|Where-Object ReferencingAttribute -in @('a365_conversionyear','a365_employee','a365_convertedby'))}
    $roles=Read-Conversion '/api/data/v9.2/roles?$select=roleid,name&$filter=name eq ''A365 - Payroll Employee'''
    foreach($role in $roles.value){
        $permissions=Read-Conversion "/api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=$($role.roleid))"
        if(@($permissions.RolePrivileges|Where-Object {$_.PrivilegeId -in $definition.Privileges.PrivilegeId}).Count){throw 'Employee role has conversion table privileges; review effective access.'}
    }
}
$days=Read-Conversion '/api/data/v9.2/EntityDefinitions(LogicalName=''a365_leavecashconversion'')/Attributes(LogicalName=''a365_days'')/Microsoft.Dynamics.CRM.DecimalAttributeMetadata?$select=MinValue,MaxValue,Precision'
$available=Read-Conversion '/api/data/v9.2/EntityDefinitions(LogicalName=''a365_leavecashconversion'')/Attributes(LogicalName=''a365_availablevl'')/Microsoft.Dynamics.CRM.DecimalAttributeMetadata?$select=LogicalName,SchemaName,MinValue,MaxValue,Precision'
if($days.MinValue -ne 0 -or $days.MaxValue -ne 5 -or $days.Precision -ne 2 -or $available.MinValue -ne 0 -or $available.Precision -ne 2){throw 'Unexpected day column limits.'}
$report.DaysLimits=@{Min=$days.MinValue;Max=$days.MaxValue;Precision=$days.Precision};$report.AvailableVL=$available
[IO.File]::WriteAllText((Join-Path $conversionRoot 'docs/leave-conversion-schema-verification.json'),($report|ConvertTo-Json -Depth 20),(New-Object Text.UTF8Encoding($false)))
Write-Host 'Verified both Active unique keys, concurrency, day limits, empty tables and zero Employee-role conversion privileges. No environment writes.'
