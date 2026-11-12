param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leaveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$leaveSolution = 'A365_DailyOperations'
$leaveCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveWork = Join-Path $PSScriptRoot '.work/posting'
New-Item -ItemType Directory -Force -Path $leaveWork | Out-Null
$leaveMeta = @{}
function Request-Leave([string]$Path, [string]$Method = 'GET', $Body = $null) {
    if ($Path -notmatch '^/api/data/v9\.2/(EntityDefinitions|solutions|solutioncomponents|publishers|pluginassemblies|plugintypes|customapis|customapirequestparameters|customapiresponseproperties|sdkmessages|sdkmessagefilters|sdkmessageprocessingsteps|AddSolutionComponent|PublishXml|a365_leavepolic)') { throw 'Request outside approved provisioning scope.' }
    if ($Method -ne 'GET' -and -not $Apply) { throw 'Use -Apply for authorized changes.' }
    $leaveArgs = @('api','request','--target','dataverse','--environment',$leaveEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex')
    if ($Method -ne 'GET') {
        $leaveBodyPath = Join-Path $leaveWork 'request.json'
        [IO.File]::WriteAllText($leaveBodyPath, ($Body | ConvertTo-Json -Depth 55 -Compress), (New-Object Text.UTF8Encoding($false)))
        $leaveArgs += @('--body-file',$leaveBodyPath,'--header',"MSCRM.SolutionUniqueName:$leaveSolution",'--header','Prefer:return=representation')
    }
    $leaveOutput = & $leaveCli @leaveArgs
    if ($LASTEXITCODE -ne 0) { throw "Dataverse provisioning failed: $Method $Path : $($leaveOutput -join ' ')" }
    if ($leaveOutput) { return (($leaveOutput -join "`n") | ConvertFrom-Json) }
}
function Label-Leave([string]$Text) { return @{ LocalizedLabels = @(@{ Label=$Text; LanguageCode=1033 }) } }
function Metadata-Leave([string]$Table) {
    if (-not $leaveMeta.ContainsKey($Table)) {
        $leaveMeta[$Table] = Request-Leave "/api/data/v9.2/EntityDefinitions(LogicalName='$Table')?`$select=LogicalName,SchemaName,PrimaryIdAttribute,EntitySetName&`$expand=ManyToOneRelationships(`$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName,ReferencedEntity)"
    }
    return $leaveMeta[$Table]
}
function Binding-Leave([string]$Table,[string]$Attribute,[string]$Target,[guid]$Id) {
    $leaveLink = @((Metadata-Leave $Table).ManyToOneRelationships | Where-Object { $_.ReferencingAttribute -ceq $Attribute -and $_.ReferencedEntity -ceq $Target })
    if ($leaveLink.Count -ne 1) { throw "Unverified relationship: $Table/$Attribute" }
    return @{ Key = "$($leaveLink[0].ReferencingEntityNavigationPropertyName)@odata.bind"; Value = "/$((Metadata-Leave $Target).EntitySetName)($Id)" }
}
function Add-Binding($Body,[string]$Table,[string]$Attribute,[string]$Target,[guid]$Id) {
    $leaveBinding = Binding-Leave $Table $Attribute $Target $Id
    $Body[$leaveBinding.Key] = $leaveBinding.Value
}
function Ensure-Column([string]$Table,[string]$Schema,[string]$Display,[string]$Type,[int]$Length=0) {
    $leaveLogical = $Schema.ToLowerInvariant()
    $leaveExisting = Request-Leave "/api/data/v9.2/EntityDefinitions(LogicalName='$Table')/Attributes?`$select=LogicalName,SchemaName,AttributeType&`$filter=LogicalName eq '$leaveLogical'"
    if (@($leaveExisting.value).Count) {
        if ($leaveExisting.value[0].SchemaName -cne $Schema) { throw "Incompatible column $Table/$leaveLogical" }
        return
    }
    $leaveBody = @{ '@odata.type'="Microsoft.Dynamics.CRM.${Type}AttributeMetadata"; SchemaName=$Schema; DisplayName=(Label-Leave $Display); RequiredLevel=@{Value='None'}; IsAuditEnabled=@{Value=$true} }
    if ($Type -eq 'String' -or $Type -eq 'Memo') { $leaveBody.MaxLength = $Length }
    if ($Type -eq 'Integer') { $leaveBody.MinValue = 749910000; $leaveBody.MaxValue=749910001 }
    if ($Type -eq 'DateTime') { $leaveBody.Format='DateAndTime'; $leaveBody.DateTimeBehavior=@{Value='UserLocal'} }
    Request-Leave "/api/data/v9.2/EntityDefinitions(LogicalName='$Table')/Attributes" POST $leaveBody | Out-Null
}
function Ensure-Table([string]$Schema,[string]$Display) {
    $leaveLogical = $Schema.ToLowerInvariant()
    $leaveRows = Request-Leave "/api/data/v9.2/EntityDefinitions?`$select=LogicalName,SchemaName,OwnershipType&`$filter=LogicalName eq '$leaveLogical'"
    if (@($leaveRows.value).Count) {
        if ($leaveRows.value[0].SchemaName -cne $Schema -or $leaveRows.value[0].OwnershipType -cne 'OrganizationOwned') { throw "Incompatible existing table $leaveLogical" }
        return
    }
    $leaveBody = @{
        '@odata.type'='Microsoft.Dynamics.CRM.EntityMetadata'; SchemaName=$Schema; DisplayName=(Label-Leave $Display); DisplayCollectionName=(Label-Leave "$Display Records")
        OwnershipType='OrganizationOwned'; HasActivities=$false; HasNotes=$false; IsActivity=$false; IsAuditEnabled=@{Value=$true}; PrimaryNameAttribute='a365_name'
        Attributes=@(@{ '@odata.type'='Microsoft.Dynamics.CRM.StringAttributeMetadata'; SchemaName='a365_Name'; DisplayName=(Label-Leave 'Name'); MaxLength=200; IsPrimaryName=$true; RequiredLevel=@{Value='ApplicationRequired'} })
    }
    Request-Leave '/api/data/v9.2/EntityDefinitions' POST $leaveBody | Out-Null
}
function Ensure-Record([string]$Table,[string]$Filter,$Body) {
    $leaveDefinition = Metadata-Leave $Table
    $leaveRows = Request-Leave "/api/data/v9.2/$($leaveDefinition.EntitySetName)?`$select=$($leaveDefinition.PrimaryIdAttribute)&`$filter=$Filter"
    if (@($leaveRows.value).Count -gt 1) { throw "Duplicate $Table registrations; manual review required." }
    if (@($leaveRows.value).Count -eq 1) { return [guid]$leaveRows.value[0].($leaveDefinition.PrimaryIdAttribute) }
    $leaveCreated = Request-Leave "/api/data/v9.2/$($leaveDefinition.EntitySetName)" POST $Body
    if (-not $leaveCreated.($leaveDefinition.PrimaryIdAttribute)) { throw "No verified $Table id returned. Reinspect before retrying." }
    return [guid]$leaveCreated.($leaveDefinition.PrimaryIdAttribute)
}
function Add-Solution([guid]$Id,[int]$Type) {
    Request-Leave '/api/data/v9.2/AddSolutionComponent' POST @{ComponentId=$Id;ComponentType=$Type;SolutionUniqueName=$leaveSolution;AddRequiredComponents=$false} | Out-Null
}

$leaveConfig = Get-Content -Raw (Join-Path $leaveRoot 'power.config.json') | ConvertFrom-Json
if ($leaveConfig.environmentId -cne 'b58b083e-d27d-eabd-a143-2a49dcb9d89a') { throw 'Unexpected environment.' }
$leaveSolutions = Request-Leave "/api/data/v9.2/solutions?`$select=solutionid,uniquename,ismanaged&`$filter=uniquename eq '$leaveSolution'"
if (@($leaveSolutions.value).Count -ne 1 -or $leaveSolutions.value[0].ismanaged) { throw 'Expected existing unmanaged solution.' }
if (-not $Apply) { Write-Host 'Read-only preflight passed. Target: The Daily Operation - Dev; existing A365_DailyOperations. No changes.'; return }

Ensure-Table 'a365_LeavePolicy' 'Leave Policy'
Ensure-Table 'a365_LeaveCoordination' 'Leave Coordination'
Ensure-Column 'a365_leavepolicy' 'a365_PolicyJson' 'Policy JSON' 'Memo' 100000
Ensure-Column 'a365_leavecoordination' 'a365_Token' 'Token' 'String' 36
Ensure-Column 'a365_leavecredittransaction' 'a365_CreditPeriod' 'Credit Period' 'String' 10
Ensure-Column 'a365_leave' 'a365_RequestedBenefit' 'Requested Benefit' 'Integer'
Ensure-Column 'a365_leave' 'a365_EmailAttempt' 'Email Attempt' 'String' 36
Ensure-Column 'a365_leave' 'a365_EmailOutcome' 'Email Outcome' 'String' 16
Ensure-Column 'a365_leave' 'a365_EmailStartedOn' 'Email Started On' 'DateTime'
Request-Leave '/api/data/v9.2/PublishXml' POST @{ ParameterXml='<importexportxml><entities><entity>a365_leave</entity><entity>a365_leavecredittransaction</entity><entity>a365_leavepolicy</entity><entity>a365_leavecoordination</entity></entities></importexportxml>' } | Out-Null
foreach ($leaveTable in @('a365_leavepolicy','a365_leavecoordination')) { Add-Solution ([guid](Request-Leave "/api/data/v9.2/EntityDefinitions(LogicalName='$leaveTable')?`$select=MetadataId").MetadataId) 1 }

$leavePolicyJson = [IO.File]::ReadAllText((Join-Path $leaveRoot 'src/features/leave/approved-policy.json'))
$leavePolicyId = Ensure-Record 'a365_leavepolicy' "a365_name eq 'active'" @{a365_name='active';a365_policyjson=$leavePolicyJson}
# Existing policy is never overwritten silently on reruns.
$leaveSavedPolicy = Request-Leave "/api/data/v9.2/$((Metadata-Leave 'a365_leavepolicy').EntitySetName)($leavePolicyId)?`$select=a365_policyjson"
if ($leaveSavedPolicy.a365_policyjson -cne $leavePolicyJson) { throw 'Existing active policy differs. Review before updating configuration.' }

$leaveAssemblyPath = Join-Path $leaveRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
$leaveAssemblyName = [Reflection.AssemblyName]::GetAssemblyName($leaveAssemblyPath)
$leaveToken = ($leaveAssemblyName.GetPublicKeyToken() | ForEach-Object {$_.ToString('x2')}) -join ''
$leaveAssemblyBody = @{name='A365.Leave.Plugins';version=$leaveAssemblyName.Version.ToString();culture='neutral';publickeytoken=$leaveToken;isolationmode=2;sourcetype=0;content=[Convert]::ToBase64String([IO.File]::ReadAllBytes($leaveAssemblyPath))}
$leaveAssemblyId = Ensure-Record 'pluginassembly' "name eq 'A365.Leave.Plugins'" $leaveAssemblyBody
Request-Leave "/api/data/v9.2/pluginassemblies($leaveAssemblyId)" PATCH @{content=$leaveAssemblyBody.content} | Out-Null
Add-Solution $leaveAssemblyId 91
$leaveTypes=@{}
foreach ($leaveType in @('LeaveCommand','ProtectLeaveWrites')) {
    $leaveTypeBody=@{typename="A365.Leave.Plugins.$leaveType";name="A365.Leave.Plugins.$leaveType";friendlyname="A365 $leaveType"}
    Add-Binding $leaveTypeBody 'plugintype' 'pluginassemblyid' 'pluginassembly' $leaveAssemblyId
    $leaveTypes[$leaveType]=Ensure-Record 'plugintype' "typename eq 'A365.Leave.Plugins.$leaveType'" $leaveTypeBody
}
$leaveApiBody=@{uniquename='a365_LeaveCommand';name='A365 Leave Command';displayname='A365 Leave Command';description='Validated transactional Leave issuance, preview and post-commit notification state.';bindingtype=0;isfunction=$false;isprivate=$false;allowedcustomprocessingsteptype=0}
Add-Binding $leaveApiBody 'customapi' 'plugintypeid' 'plugintype' $leaveTypes.LeaveCommand
$leaveApiId=Ensure-Record 'customapi' "uniquename eq 'a365_LeaveCommand'" $leaveApiBody
$leaveApiComponents=Request-Leave "/api/data/v9.2/solutioncomponents?`$select=componenttype,objectid&`$filter=objectid eq $leaveApiId and _solutionid_value eq $($leaveSolutions.value[0].solutionid)"
if (@($leaveApiComponents.value).Count -ne 1) { throw 'Custom API was not added to the existing solution by the solution header. Inspect before proceeding.' }
Write-Host "Custom API solution membership verified; component type $($leaveApiComponents.value[0].componenttype)."
foreach ($leaveParameterTable in @('customapirequestparameter','customapiresponseproperty')) {
    $leaveParameterName=if($leaveParameterTable -eq 'customapirequestparameter') {'Request'} else {'Response'}
    $leaveParameterBody=@{uniquename=$leaveParameterName;name="a365_LeaveCommand.$leaveParameterName";displayname=$leaveParameterName;description="Leave command JSON $leaveParameterName";type=10}
    if($leaveParameterTable -eq 'customapirequestparameter') {$leaveParameterBody.isoptional=$false}
    Add-Binding $leaveParameterBody $leaveParameterTable 'customapiid' 'customapi' $leaveApiId
    Ensure-Record $leaveParameterTable "_customapiid_value eq $leaveApiId and uniquename eq '$leaveParameterName'" $leaveParameterBody | Out-Null
}

$leaveSteps=0
foreach ($leaveTable in @('a365_leave','a365_leavecredittransaction','a365_leavecoordination')) {
    foreach ($leaveMessage in @('Create','Update','Delete','Upsert','CreateMultiple','UpdateMultiple','UpsertMultiple','Assign','SetState','Merge')) {
        $leaveMessages=Request-Leave "/api/data/v9.2/sdkmessages?`$select=sdkmessageid,name&`$filter=name eq '$leaveMessage'"
        if(@($leaveMessages.value).Count -ne 1) {continue}
        $leaveMessageId=[guid]$leaveMessages.value[0].sdkmessageid
        $leaveFilters=Request-Leave "/api/data/v9.2/sdkmessagefilters?`$select=sdkmessagefilterid&`$filter=_sdkmessageid_value eq $leaveMessageId and primaryobjecttypecode eq '$leaveTable'"
        if(@($leaveFilters.value).Count -ne 1) {Write-Host "Not supported for $leaveTable : $leaveMessage";continue}
        $leaveStepName="A365 Leave Guard $leaveTable $leaveMessage"
        $leaveStepBody=@{name=$leaveStepName;stage=20;mode=0;rank=1;supporteddeployment=0}
        Add-Binding $leaveStepBody 'sdkmessageprocessingstep' 'eventhandler' 'plugintype' $leaveTypes.ProtectLeaveWrites
        Add-Binding $leaveStepBody 'sdkmessageprocessingstep' 'sdkmessageid' 'sdkmessage' $leaveMessageId
        Add-Binding $leaveStepBody 'sdkmessageprocessingstep' 'sdkmessagefilterid' 'sdkmessagefilter' ([guid]$leaveFilters.value[0].sdkmessagefilterid)
        $leaveStepId=Ensure-Record 'sdkmessageprocessingstep' "name eq '$leaveStepName'" $leaveStepBody
        Add-Solution $leaveStepId 92
        $leaveSteps++
    }
}
Write-Host "Registered Leave API and $leaveSteps supported direct-write guard steps. Existing role grants unchanged. No Leave/ledger test records or emails."
