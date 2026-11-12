param([switch]$Apply, [switch]$Inspect, [switch]$GuardsOnly)
$ErrorActionPreference = 'Stop'
$deleteRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$deleteEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$deleteSolution = 'A365_DailyOperations'
$deleteCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$deleteWork = Join-Path $PSScriptRoot '.work'
New-Item -ItemType Directory -Force -Path $deleteWork | Out-Null
$deleteMetadata = @{}
function Request-DeleteSetup([string]$Path, [string]$Method = 'GET', $Body = $null) {
    if ($Path -notmatch '^/api/data/v9\.2/(WhoAmI|EntityDefinitions|RelationshipDefinitions|solutions|solutioncomponents|publishers|pluginassemblies|plugintypes|customapis|customapirequestparameters|customapiresponseproperties|sdkmessages|sdkmessagefilters|sdkmessageprocessingsteps|AddSolutionComponent|PublishXml)') { throw 'Outside deletion setup scope.' }
    if ($Method -ne 'GET' -and -not $Apply) { throw 'Use -Apply for authorized setup.' }
    $deleteArguments = @('api','request','--target','dataverse','--environment',$deleteEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex')
    if ($Method -ne 'GET') {
        $deleteBodyFile = Join-Path $deleteWork 'request.json'
        [IO.File]::WriteAllText($deleteBodyFile, ($Body | ConvertTo-Json -Depth 55 -Compress), (New-Object Text.UTF8Encoding($false)))
        $deleteArguments += @('--body-file',$deleteBodyFile,'--header',"MSCRM.SolutionUniqueName:$deleteSolution",'--header','Prefer:return=representation')
    }
    $deleteResult = & $deleteCli @deleteArguments
    if ($LASTEXITCODE -ne 0) { throw "Deletion setup failed: $Method $Path : $($deleteResult -join ' ')" }
    if ($deleteResult) { return (($deleteResult -join "`n") | ConvertFrom-Json) }
}
function Metadata-Delete([string]$Table) {
    if (-not $deleteMetadata.ContainsKey($Table)) {
        $deleteMetadata[$Table] = Request-DeleteSetup "/api/data/v9.2/EntityDefinitions(LogicalName='$Table')?`$select=LogicalName,SchemaName,PrimaryIdAttribute,EntitySetName&`$expand=ManyToOneRelationships(`$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName,ReferencedEntity)"
    }
    return $deleteMetadata[$Table]
}
function Add-DeleteBinding($Body,[string]$Table,[string]$Attribute,[string]$Target,[guid]$Id) {
    $deleteLinks = @((Metadata-Delete $Table).ManyToOneRelationships | Where-Object { $_.ReferencingAttribute -ceq $Attribute -and $_.ReferencedEntity -ceq $Target })
    if ($deleteLinks.Count -ne 1) { throw "Unverified relationship $Table/$Attribute" }
    $deleteKey = "$($deleteLinks[0].ReferencingEntityNavigationPropertyName)@odata.bind"
    $Body[$deleteKey] = "/$((Metadata-Delete $Target).EntitySetName)($Id)"
}
function Ensure-DeleteRecord([string]$Table,[string]$Filter,$Body) {
    $deleteDefinition = Metadata-Delete $Table
    $deleteRows = Request-DeleteSetup "/api/data/v9.2/$($deleteDefinition.EntitySetName)?`$select=$($deleteDefinition.PrimaryIdAttribute)&`$filter=$Filter"
    if (@($deleteRows.value).Count -gt 1) { throw "Duplicate $Table registrations." }
    if (@($deleteRows.value).Count -eq 1) { return [guid]$deleteRows.value[0].($deleteDefinition.PrimaryIdAttribute) }
    $deleteCreated = Request-DeleteSetup "/api/data/v9.2/$($deleteDefinition.EntitySetName)" POST $Body
    if (-not $deleteCreated.($deleteDefinition.PrimaryIdAttribute)) { throw "Missing $Table identity; inspect before retrying." }
    return [guid]$deleteCreated.($deleteDefinition.PrimaryIdAttribute)
}
function Label-Delete([string]$Text) { return @{ LocalizedLabels=@(@{Label=$Text;LanguageCode=1033}) } }
function Add-DeleteSolution([guid]$Id,[int]$Type) {
    Request-DeleteSetup '/api/data/v9.2/AddSolutionComponent' POST @{ComponentId=$Id;ComponentType=$Type;SolutionUniqueName=$deleteSolution;AddRequiredComponents=$false} | Out-Null
}

$deleteConfig = Get-Content -Raw (Join-Path $deleteRoot 'power.config.json') | ConvertFrom-Json
if ($deleteConfig.environmentId -cne 'b58b083e-d27d-eabd-a143-2a49dcb9d89a') { throw 'Unexpected app environment.' }
$deleteIdentity = Request-DeleteSetup '/api/data/v9.2/WhoAmI'
if ($deleteIdentity.OrganizationId -cne 'fe0edb27-c4a6-f111-aaa0-002248ed6f85') { throw 'Unexpected Dataverse organization.' }
$deleteSolutions = Request-DeleteSetup "/api/data/v9.2/solutions?`$select=solutionid,uniquename,ismanaged&`$filter=uniquename eq '$deleteSolution'"
if (@($deleteSolutions.value).Count -ne 1 -or $deleteSolutions.value[0].ismanaged) { throw 'Expected existing unmanaged solution.' }
$deletePublisher = Request-DeleteSetup "/api/data/v9.2/solutions($($deleteSolutions.value[0].solutionid))?`$expand=publisherid(`$select=customizationprefix)"
if ($deletePublisher.publisherid.customizationprefix -cne 'a365') { throw 'Unexpected solution publisher.' }
$deletePreflight = @{}
foreach ($deleteTable in @('a365_employee','a365_payrollperiod','a365_payrollentry')) {
    $deleteDefinition = Request-DeleteSetup "/api/data/v9.2/EntityDefinitions(LogicalName='$deleteTable')?`$select=LogicalName,SchemaName,EntitySetName,IsOptimisticConcurrencyEnabled&`$expand=OneToManyRelationships(`$select=SchemaName,ReferencingEntity,ReferencingAttribute,CascadeConfiguration),ManyToManyRelationships(`$select=SchemaName,Entity1LogicalName,Entity2LogicalName,IntersectEntityName)"
    if (-not $deleteDefinition.IsOptimisticConcurrencyEnabled) { throw "Concurrency not enabled for $deleteTable" }
    $deletePreflight[$deleteTable] = $deleteDefinition
}
$deletePreflight | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $deleteWork 'preflight.json')
$deleteEntryRelationship = @($deletePreflight.a365_payrollperiod.OneToManyRelationships | Where-Object { $_.ReferencingEntity -ceq 'a365_payrollentry' -and $_.ReferencingAttribute -ceq 'a365_payrollperiod' })
if ($deleteEntryRelationship.Count -ne 1 -or $deleteEntryRelationship[0].CascadeConfiguration.Delete -cne 'Restrict') { throw 'Entry-to-period deletion must already be Restrict; no relationship changes made.' }
if ($Inspect -or -not $Apply) {
    Write-Host 'Read-only deletion preflight passed for The Daily Operation - Dev / A365_DailyOperations. Metadata saved locally; no changes.'
    return
}

if(-not $GuardsOnly){
$deleteExisting = Request-DeleteSetup "/api/data/v9.2/EntityDefinitions?`$select=LogicalName,SchemaName,OwnershipType&`$filter=LogicalName eq 'a365_payrolldeletionreceipt'"
if (@($deleteExisting.value).Count -eq 0) {
    Request-DeleteSetup '/api/data/v9.2/EntityDefinitions' POST @{
        '@odata.type'='Microsoft.Dynamics.CRM.EntityMetadata';SchemaName='a365_PayrollDeletionReceipt';DisplayName=(Label-Delete 'Deletion Receipt');DisplayCollectionName=(Label-Delete 'Deletion Receipts')
        OwnershipType='OrganizationOwned';HasActivities=$false;HasNotes=$false;IsActivity=$false;PrimaryNameAttribute='a365_name'
        Attributes=@(@{'@odata.type'='Microsoft.Dynamics.CRM.StringAttributeMetadata';SchemaName='a365_Name';DisplayName=(Label-Delete 'Name');MaxLength=200;IsPrimaryName=$true;RequiredLevel=@{Value='ApplicationRequired'}})
    } | Out-Null
} elseif ($deleteExisting.value[0].SchemaName -cne 'a365_PayrollDeletionReceipt' -or $deleteExisting.value[0].OwnershipType -cne 'OrganizationOwned') { throw 'Incompatible receipt table.' }
foreach ($deleteColumn in @(
    @('PeriodId','Period ID',36),@('PeriodName','Period Name',200),@('DeletedById','Deleted By User ID',36),
    @('TargetType','Target Type',32),@('TargetId','Target ID',36),@('TargetName','Target Name',200),@('DeletedEntries','Deleted Entries',0)
)) {
    $deleteSchema = 'a365_' + $deleteColumn[0]
    $deleteLogical = $deleteSchema.ToLowerInvariant()
    $deleteColumns = Request-DeleteSetup "/api/data/v9.2/EntityDefinitions(LogicalName='a365_payrolldeletionreceipt')/Attributes?`$select=LogicalName,SchemaName,AttributeType&`$filter=LogicalName eq '$deleteLogical'"
    if (@($deleteColumns.value).Count) {
        if ($deleteColumns.value[0].SchemaName -cne $deleteSchema) { throw "Incompatible receipt column $deleteLogical" }
        continue
    }
    $deleteColumnBody=@{SchemaName=$deleteSchema;DisplayName=(Label-Delete $deleteColumn[1]);RequiredLevel=@{Value='None'}}
    if ($deleteColumn[2] -gt 0) { $deleteColumnBody['@odata.type']='Microsoft.Dynamics.CRM.StringAttributeMetadata';$deleteColumnBody.MaxLength=$deleteColumn[2] }
    else { $deleteColumnBody['@odata.type']='Microsoft.Dynamics.CRM.IntegerAttributeMetadata';$deleteColumnBody.MinValue=0;$deleteColumnBody.MaxValue=100000 }
    Request-DeleteSetup "/api/data/v9.2/EntityDefinitions(LogicalName='a365_payrolldeletionreceipt')/Attributes" POST $deleteColumnBody | Out-Null
}
Request-DeleteSetup '/api/data/v9.2/PublishXml' POST @{ParameterXml='<importexportxml><entities><entity>a365_payrolldeletionreceipt</entity></entities></importexportxml>'} | Out-Null
Add-DeleteSolution ([guid](Request-DeleteSetup "/api/data/v9.2/EntityDefinitions(LogicalName='a365_payrolldeletionreceipt')?`$select=MetadataId").MetadataId) 1
}

$deleteAssemblyPath = Join-Path $deleteRoot 'plugins/A365.Payroll.Deletion/bin/A365.Payroll.Deletion.dll'
$deleteAssemblyName = [Reflection.AssemblyName]::GetAssemblyName($deleteAssemblyPath)
$deleteToken = ($deleteAssemblyName.GetPublicKeyToken() | ForEach-Object {$_.ToString('x2')}) -join ''
$deleteAssemblyBody=@{name='A365.Payroll.Deletion';version=$deleteAssemblyName.Version.ToString();culture='neutral';publickeytoken=$deleteToken;isolationmode=2;sourcetype=0;content=[Convert]::ToBase64String([IO.File]::ReadAllBytes($deleteAssemblyPath))}
$deleteAssemblyId=Ensure-DeleteRecord 'pluginassembly' "name eq 'A365.Payroll.Deletion'" $deleteAssemblyBody
$deleteRegisteredAssembly=Request-DeleteSetup "/api/data/v9.2/pluginassemblies($deleteAssemblyId)?`$select=name,version,publickeytoken"
if($deleteRegisteredAssembly.name -cne $deleteAssemblyName.Name -or $deleteRegisteredAssembly.publickeytoken -cne $deleteToken){throw 'Deletion assembly signing identity mismatch; do not replace the existing signing key.'}
$deletePreviousVersion=[version]$deleteRegisteredAssembly.version
if($deletePreviousVersion.Major -ne $deleteAssemblyName.Version.Major -or $deletePreviousVersion.Minor -ne $deleteAssemblyName.Version.Minor -or $deleteAssemblyName.Version -lt $deletePreviousVersion){throw 'Only same-major/minor non-downgrade updates are supported.'}
Request-DeleteSetup "/api/data/v9.2/pluginassemblies($deleteAssemblyId)" PATCH @{content=$deleteAssemblyBody.content} | Out-Null
Add-DeleteSolution $deleteAssemblyId 91
$deleteTypeBody=@{typename='A365.Payroll.Deletion.DeletePayrollPeriod';name='A365.Payroll.Deletion.DeletePayrollPeriod';friendlyname='A365 Validated Deletion'}
Add-DeleteBinding $deleteTypeBody 'plugintype' 'pluginassemblyid' 'pluginassembly' $deleteAssemblyId
$deleteTypeId=Ensure-DeleteRecord 'plugintype' "typename eq 'A365.Payroll.Deletion.DeletePayrollPeriod'" $deleteTypeBody
$deleteGuardBody=@{typename='A365.Payroll.Deletion.ProtectDeletionWrites';name='A365.Payroll.Deletion.ProtectDeletionWrites';friendlyname='A365 Protect Deletion Writes'}
Add-DeleteBinding $deleteGuardBody 'plugintype' 'pluginassemblyid' 'pluginassembly' $deleteAssemblyId
$deleteGuardType=Ensure-DeleteRecord 'plugintype' "typename eq 'A365.Payroll.Deletion.ProtectDeletionWrites'" $deleteGuardBody
foreach($deleteGuardPair in @(@('a365_payrollperiod','Delete'),@('a365_payrollentry','Delete'),@('a365_employee','Delete'),@('a365_payrolldeletionreceipt','Create'),@('a365_payrolldeletionreceipt','Update'),@('a365_payrolldeletionreceipt','Delete'),@('a365_payrolldeletionreceipt','Upsert'),@('a365_payrolldeletionreceipt','CreateMultiple'),@('a365_payrolldeletionreceipt','UpdateMultiple'),@('a365_payrolldeletionreceipt','UpsertMultiple'))){
    $deleteGuardTable=$deleteGuardPair[0];$deleteGuardMessage=$deleteGuardPair[1]
    $deleteMessages=Request-DeleteSetup "/api/data/v9.2/sdkmessages?`$select=sdkmessageid&`$filter=name eq '$deleteGuardMessage'"
    if(@($deleteMessages.value).Count -ne 1){continue}
    $deleteMessageId=[guid]$deleteMessages.value[0].sdkmessageid
    $deleteFilters=Request-DeleteSetup "/api/data/v9.2/sdkmessagefilters?`$select=sdkmessagefilterid&`$filter=_sdkmessageid_value eq $deleteMessageId and primaryobjecttypecode eq '$deleteGuardTable'"
    if(@($deleteFilters.value).Count -ne 1){if($deleteGuardMessage -eq 'Delete'){throw "Missing mandatory Delete guard filter for $deleteGuardTable"};continue}
    $deleteGuardName="A365 Deletion Guard $deleteGuardTable $deleteGuardMessage"
    $deleteStepBody=@{name=$deleteGuardName;stage=20;mode=0;rank=1;supporteddeployment=0}
    Add-DeleteBinding $deleteStepBody 'sdkmessageprocessingstep' 'eventhandler' 'plugintype' $deleteGuardType
    Add-DeleteBinding $deleteStepBody 'sdkmessageprocessingstep' 'sdkmessageid' 'sdkmessage' $deleteMessageId
    Add-DeleteBinding $deleteStepBody 'sdkmessageprocessingstep' 'sdkmessagefilterid' 'sdkmessagefilter' ([guid]$deleteFilters.value[0].sdkmessagefilterid)
    $deleteStepId=Ensure-DeleteRecord 'sdkmessageprocessingstep' "name eq '$deleteGuardName'" $deleteStepBody
    Add-DeleteSolution $deleteStepId 92
}
if($GuardsOnly){Write-Host 'Updated only the existing deletion assembly and added deletion/receipt guards. Existing API definitions, role grants and business records unchanged.';return}
foreach ($deleteApiName in @('a365_DeletePayrollPeriod','a365_DeletePayrollEntry','a365_DeleteEmployee')) {
    $deleteApiBody=@{uniquename=$deleteApiName;name=$deleteApiName;displayname=$deleteApiName;description='Admin-only transactional deletion with dependency, current-status and concurrency checks plus a durable receipt.';bindingtype=0;isfunction=$false;isprivate=$false;allowedcustomprocessingsteptype=0}
    Add-DeleteBinding $deleteApiBody 'customapi' 'plugintypeid' 'plugintype' $deleteTypeId
    $deleteApiId=Ensure-DeleteRecord 'customapi' "uniquename eq '$deleteApiName'" $deleteApiBody
    foreach ($deleteParameterTable in @('customapirequestparameter','customapiresponseproperty')) {
        $deleteParameterName=if ($deleteParameterTable -eq 'customapirequestparameter') {'Request'} else {'Response'}
        $deleteParameterBody=@{uniquename=$deleteParameterName;name="$deleteApiName.$deleteParameterName";displayname=$deleteParameterName;description="Deletion JSON $deleteParameterName";type=10}
        if ($deleteParameterTable -eq 'customapirequestparameter') {$deleteParameterBody.isoptional=$false}
        Add-DeleteBinding $deleteParameterBody $deleteParameterTable 'customapiid' 'customapi' $deleteApiId
        Ensure-DeleteRecord $deleteParameterTable "_customapiid_value eq $deleteApiId and uniquename eq '$deleteParameterName'" $deleteParameterBody | Out-Null
    }
    $deleteComponents=Request-DeleteSetup "/api/data/v9.2/solutioncomponents?`$select=componenttype,objectid&`$filter=objectid eq $deleteApiId and _solutionid_value eq $($deleteSolutions.value[0].solutionid)"
    if (@($deleteComponents.value).Count -ne 1) { throw "Missing solution membership for $deleteApiName" }
}
Write-Host 'Deletion receipt and three scoped APIs registered in the existing Dev solution. No business records deleted; role privileges unchanged.'
