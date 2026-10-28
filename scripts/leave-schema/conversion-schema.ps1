param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$conversionRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$conversionEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$conversionSolution = 'A365_DailyOperations'
$conversionCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$conversionWork = Join-Path $PSScriptRoot '.work/conversion'
New-Item -ItemType Directory -Force -Path $conversionWork | Out-Null
function Conversion-Api([string]$Path, [string]$Method='GET', $Body=$null) {
    if ($Path -notmatch '^/api/data/v9\.2/(EntityDefinitions|RelationshipDefinitions|solutions|publishers|roles|RetrieveRolePrivilegesRole|AddSolutionComponent|PublishXml|a365_leavecashconversions)') { throw 'Outside conversion schema scope.' }
    if ($Method -ne 'GET' -and -not $Apply) { throw 'Explicit -Apply required.' }
    $conversionArgs=@('api','request','--target','dataverse','--environment',$conversionEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex')
    if($Method -ne 'GET') {
        $conversionFile=Join-Path $conversionWork 'request.json'
        [IO.File]::WriteAllText($conversionFile,($Body|ConvertTo-Json -Depth 40 -Compress),(New-Object Text.UTF8Encoding($false)))
        $conversionArgs+=@('--body-file',$conversionFile,'--header',"MSCRM.SolutionUniqueName:$conversionSolution",'--header','Prefer:return=representation')
    }
    $conversionOutput=& $conversionCli @conversionArgs
    if($LASTEXITCODE -ne 0){throw "Conversion schema request failed: $Method $Path : $($conversionOutput -join ' '). Inspect current state before retrying."}
    if($conversionOutput){return (($conversionOutput -join "`n")|ConvertFrom-Json)}
}
function Conversion-Label([string]$Text){return @{LocalizedLabels=@(@{Label=$Text;LanguageCode=1033})}}
function Conversion-Component([guid]$Id,[int]$Type){Conversion-Api '/api/data/v9.2/AddSolutionComponent' POST @{ComponentId=$Id;ComponentType=$Type;SolutionUniqueName=$conversionSolution;AddRequiredComponents=$false}|Out-Null}
function Conversion-Attribute([string]$Table,[string]$Schema,[string]$Display,[string]$Type) {
    $logical=$Schema.ToLowerInvariant()
    $found=Conversion-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$Table')/Attributes?`$select=LogicalName,SchemaName,AttributeType&`$filter=LogicalName eq '$logical'"
    if(@($found.value).Count){if($found.value[0].SchemaName -cne $Schema -or $found.value[0].AttributeType -cne $Type){throw 'Incompatible existing conversion column.'};return}
    $body=@{'@odata.type'="Microsoft.Dynamics.CRM.${Type}AttributeMetadata";SchemaName=$Schema;DisplayName=(Conversion-Label $Display);RequiredLevel=@{Value='ApplicationRequired'};IsAuditEnabled=@{Value=$true}}
    if($Type -eq 'Integer'){$body.MinValue=1900;$body.MaxValue=9998}
    else {$body.MinValue=0;$body.MaxValue=1000000000;$body.Precision=2}
    Conversion-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$Table')/Attributes" POST $body|Out-Null
}
$conversionConfig=Get-Content -Raw (Join-Path $conversionRoot 'power.config.json')|ConvertFrom-Json
if($conversionConfig.environmentId -cne 'b58b083e-d27d-eabd-a143-2a49dcb9d89a'){throw 'Unexpected environment.'}
$solution=Conversion-Api "/api/data/v9.2/solutions?`$select=solutionid,uniquename,ismanaged&`$filter=uniquename eq '$conversionSolution'"
if(@($solution.value).Count -ne 1 -or $solution.value[0].ismanaged){throw 'Expected existing unmanaged solution.'}
$count=Conversion-Api '/api/data/v9.2/a365_leavecashconversions?$select=a365_leavecashconversionid&$count=true&$top=1'
if($count.'@odata.count' -ne 0){throw 'Conversion records now exist; review historical compatibility before applying.'}
if(-not $Apply){Write-Host 'Conversion schema preflight passed; no writes.';return}
$header=Conversion-Api '/api/data/v9.2/EntityDefinitions?$select=LogicalName,SchemaName,OwnershipType&$filter=LogicalName eq ''a365_leaveconversionyear'''
if(-not @($header.value).Count){
    Conversion-Api '/api/data/v9.2/EntityDefinitions' POST @{
        '@odata.type'='Microsoft.Dynamics.CRM.EntityMetadata';SchemaName='a365_LeaveConversionYear';DisplayName=(Conversion-Label 'Leave Conversion Year');DisplayCollectionName=(Conversion-Label 'Leave Conversion Years');OwnershipType='UserOwned';HasActivities=$false;HasNotes=$false;IsActivity=$false;IsAuditEnabled=@{Value=$true};PrimaryNameAttribute='a365_name';IsOptimisticConcurrencyEnabled=$true
        Attributes=@(@{'@odata.type'='Microsoft.Dynamics.CRM.StringAttributeMetadata';SchemaName='a365_Name';DisplayName=(Conversion-Label 'Name');MaxLength=200;IsPrimaryName=$true;RequiredLevel=@{Value='ApplicationRequired'}})
    }|Out-Null
}elseif($header.value[0].SchemaName -cne 'a365_LeaveConversionYear' -or $header.value[0].OwnershipType -cne 'UserOwned'){throw 'Incompatible conversion parent.'}
Conversion-Attribute 'a365_leaveconversionyear' 'a365_Year' 'Year' 'Integer'
Conversion-Attribute 'a365_leavecashconversion' 'a365_AvailableVL' 'Available VL' 'Decimal'
$lookup=Conversion-Api '/api/data/v9.2/EntityDefinitions(LogicalName=''a365_leavecashconversion'')/Attributes?$select=LogicalName&$filter=LogicalName eq ''a365_conversionyear'''
if(-not @($lookup.value).Count){
    Conversion-Api '/api/data/v9.2/RelationshipDefinitions' POST @{
        '@odata.type'='Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata';SchemaName='a365_leaveconversionyear_leavecashconversion';ReferencedEntity='a365_leaveconversionyear';ReferencedAttribute='a365_leaveconversionyearid';ReferencingEntity='a365_leavecashconversion'
        Lookup=@{'@odata.type'='Microsoft.Dynamics.CRM.LookupAttributeMetadata';SchemaName='a365_ConversionYear';DisplayName=(Conversion-Label 'Conversion Year');RequiredLevel=@{Value='ApplicationRequired'};IsAuditEnabled=@{Value=$true}}
        CascadeConfiguration=@{Assign='NoCascade';Delete='Restrict';Merge='NoCascade';Reparent='NoCascade';Share='NoCascade';Unshare='NoCascade'}
    }|Out-Null
}
$days=Conversion-Api '/api/data/v9.2/EntityDefinitions(LogicalName=''a365_leavecashconversion'')/Attributes(LogicalName=''a365_days'')/Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
if($days.MaxValue -ne 5 -or $days.Precision -ne 2 -or $days.MinValue -notin @(0,0.5)){throw 'Unexpected existing days limits.'}
if($days.MinValue -ne 0){Conversion-Api '/api/data/v9.2/EntityDefinitions(LogicalName=''a365_leavecashconversion'')/Attributes(LogicalName=''a365_days'')' PUT @{'@odata.type'='Microsoft.Dynamics.CRM.DecimalAttributeMetadata';SchemaName=$days.SchemaName;DisplayName=$days.DisplayName;RequiredLevel=$days.RequiredLevel;MinValue=0;MaxValue=5;Precision=2}|Out-Null}
foreach($key in @(@{Table='a365_leaveconversionyear';Name='a365_ConversionYearUnique';Columns=@('a365_year')},@{Table='a365_leavecashconversion';Name='a365_ConversionYearEmployeeUnique';Columns=@('a365_conversionyear','a365_employee')})){
    $existing=Conversion-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$($key.Table)')/Keys?`$select=LogicalName,KeyAttributes,EntityKeyIndexStatus"
    if(-not @($existing.value|Where-Object LogicalName -eq $key.Name.ToLowerInvariant()).Count){Conversion-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$($key.Table)')/Keys" POST @{SchemaName=$key.Name;DisplayName=(Conversion-Label $key.Name);KeyAttributes=$key.Columns}|Out-Null}
}
Conversion-Api '/api/data/v9.2/PublishXml' POST @{ParameterXml='<importexportxml><entities><entity>a365_leaveconversionyear</entity><entity>a365_leavecashconversion</entity></entities></importexportxml>'}|Out-Null
foreach($table in @('a365_leaveconversionyear','a365_leavecashconversion')){
    $metadata=Conversion-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$table')?`$select=MetadataId,LogicalName,SchemaName,EntitySetName,PrimaryIdAttribute,IsOptimisticConcurrencyEnabled&`$expand=Attributes(`$select=LogicalName,SchemaName),ManyToOneRelationships(`$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName,ReferencedEntity),Keys(`$select=LogicalName,KeyAttributes,EntityKeyIndexStatus)"
    Conversion-Component ([guid]$metadata.MetadataId) 1
    [IO.File]::WriteAllText((Join-Path $conversionWork "$table.json"),($metadata|ConvertTo-Json -Depth 30),(New-Object Text.UTF8Encoding($false)))
    Write-Host "$($metadata.LogicalName): $($metadata.EntitySetName), concurrency $($metadata.IsOptimisticConcurrencyEnabled)"
    $metadata.Keys|ForEach-Object {Write-Host "Key $($_.LogicalName): $($_.EntityKeyIndexStatus)"}
}
$roles=Conversion-Api '/api/data/v9.2/roles?$select=roleid,name,_businessunitid_value&$filter=name eq ''A365 - Payroll Admin'''
if(@($roles.value).Count -ne 1){throw 'Expected one Payroll Admin role.'}
$role=$roles.value[0]
$before=Conversion-Api "/api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=$($role.roleid))"
$privileges=Conversion-Api '/api/data/v9.2/EntityDefinitions(LogicalName=''a365_leaveconversionyear'')?$select=Privileges'
$grants=@($privileges.Privileges|Where-Object PrivilegeType -in @('Create','Read','Write','AppendTo'))
if($grants.Count -ne 4 -or @($grants|Where-Object {-not $_.CanBeGlobal}).Count){throw 'Unexpected parent privileges.'}
$missing=@($grants|Where-Object { $grant=$_; -not @($before.RolePrivileges|Where-Object {$_.PrivilegeId -eq $grant.PrivilegeId -and $_.Depth -eq 'Global'}).Count })
if($missing.Count){Conversion-Api "/api/data/v9.2/roles($($role.roleid))/Microsoft.Dynamics.CRM.AddPrivilegesRole" POST @{Privileges=@($missing|ForEach-Object {@{PrivilegeId=$_.PrivilegeId;PrivilegeName=$_.Name;Depth='Global';BusinessUnitId=$role._businessunitid_value}})}|Out-Null}
$after=Conversion-Api "/api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=$($role.roleid))"
foreach($grant in $grants){if(-not @($after.RolePrivileges|Where-Object {$_.PrivilegeId -eq $grant.PrivilegeId -and $_.Depth -eq 'Global'}).Count){throw 'Parent grant not verified; inspect before retrying.'}}
foreach($old in $before.RolePrivileges){if(-not @($after.RolePrivileges|Where-Object {$_.PrivilegeId -eq $old.PrivilegeId -and $_.Depth -eq $old.Depth}).Count){throw 'Unrelated privilege changed.'}}
Write-Host 'Verified four parent grants; unrelated privileges preserved. No employee grants or business records written.'
