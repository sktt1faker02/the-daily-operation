param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$ledgerRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$ledgerEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$ledgerSolution = 'A365_DailyOperations'
$ledgerCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$ledgerWork = Join-Path $PSScriptRoot '.work'
New-Item -ItemType Directory -Force -Path $ledgerWork | Out-Null
function Ledger-Api([string]$Path, [string]$Method='GET', $Body=$null) {
    if ($Path -notmatch '^/api/data/v9\.2/(EntityDefinitions|RelationshipDefinitions|solutions\?|AddSolutionComponent|PublishXml|a365_ledgercoordination)') { throw 'Outside ledger schema scope.' }
    if ($Method -ne 'GET' -and -not $Apply) { throw 'Explicit -Apply required.' }
    $ledgerArguments = @('api','request','--target','dataverse','--environment',$ledgerEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex')
    if ($Method -ne 'GET') {
        $ledgerFile=Join-Path $ledgerWork 'request.json'
        [IO.File]::WriteAllText($ledgerFile,($Body|ConvertTo-Json -Depth 50 -Compress),(New-Object Text.UTF8Encoding($false)))
        $ledgerArguments+=@('--body-file',$ledgerFile,'--header',"MSCRM.SolutionUniqueName:$ledgerSolution",'--header','Prefer:return=representation')
    }
    $ledgerResult=& $ledgerCli @ledgerArguments
    if ($LASTEXITCODE -ne 0) { throw "Ledger request failed: $Method $Path. Inspect live metadata before retrying." }
    if ($ledgerResult) { return (($ledgerResult -join "`n")|ConvertFrom-Json) }
}
function Ledger-Label([string]$Text) { return @{LocalizedLabels=@(@{Label=$Text;LanguageCode=1033})} }
function Ledger-Table([string]$Schema,[string]$Display) {
    $logical=$Schema.ToLowerInvariant()
    $found=Ledger-Api "/api/data/v9.2/EntityDefinitions?`$select=LogicalName,SchemaName,OwnershipType,MetadataId&`$filter=LogicalName eq '$logical'"
    if (@($found.value).Count) {
        if ($found.value[0].SchemaName -cne $Schema -or $found.value[0].OwnershipType -cne 'OrganizationOwned') { throw "Incompatible ledger table $logical" }
        return
    }
    Ledger-Api '/api/data/v9.2/EntityDefinitions' POST @{
        '@odata.type'='Microsoft.Dynamics.CRM.EntityMetadata';SchemaName=$Schema;DisplayName=(Ledger-Label $Display);DisplayCollectionName=(Ledger-Label "$Display Records")
        OwnershipType='OrganizationOwned';HasActivities=$false;HasNotes=$false;IsActivity=$false;IsAuditEnabled=@{Value=$true};IsOptimisticConcurrencyEnabled=$true;PrimaryNameAttribute='a365_name'
        Attributes=@(@{'@odata.type'='Microsoft.Dynamics.CRM.StringAttributeMetadata';SchemaName='a365_Name';DisplayName=(Ledger-Label 'Name');MaxLength=200;IsPrimaryName=$true;RequiredLevel=@{Value='ApplicationRequired'}})
    } | Out-Null
}
function Ledger-Column([string]$Table,[string]$Schema,[string]$Display,[string]$Type,[int]$Length=0) {
    $logical=$Schema.ToLowerInvariant()
    $found=Ledger-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$Table')/Attributes?`$select=LogicalName,SchemaName,AttributeType&`$filter=LogicalName eq '$logical'"
    if (@($found.value).Count) {
        if ($found.value[0].SchemaName -cne $Schema -or $found.value[0].AttributeType -cne $Type) { throw "Incompatible ledger column $Table/$logical" }
        return
    }
    $body=@{'@odata.type'="Microsoft.Dynamics.CRM.${Type}AttributeMetadata";SchemaName=$Schema;DisplayName=(Ledger-Label $Display);RequiredLevel=@{Value='None'};IsAuditEnabled=@{Value=$true}}
    if ($Type -in @('String','Memo')) {$body.MaxLength=$Length}
    if ($Type -eq 'Decimal') {$body.Precision=2;$body.MinValue=-1000000000;$body.MaxValue=1000000000}
    if ($Type -eq 'Integer') {$body.MinValue=0;$body.MaxValue=1000000000}
    if ($Type -eq 'DateTime') {
        if($Schema -ceq 'a365_Date') {$body.Format='DateOnly';$body.DateTimeBehavior=@{Value='DateOnly'}}
        else {$body.Format='DateAndTime';$body.DateTimeBehavior=@{Value='UserLocal'}}
    }
    if ($Type -eq 'Boolean') {$body.DefaultValue=$false;$body.OptionSet=@{TrueOption=@{Value=1;Label=(Ledger-Label 'Yes')};FalseOption=@{Value=0;Label=(Ledger-Label 'No')}}}
    if ($Type -eq 'Picklist') {
        $labels=@('Utilities','Payroll','Government Contributions','Taxes','Software and Licenses','Rent and Coworking','Capital Deposits','Capital Withdrawals','Client Payments')
        $options=@();for($index=0;$index -lt $labels.Count;$index++) {$options+=@{Value=(749910000+$index);Label=(Ledger-Label $labels[$index])}}
        $body.OptionSet=@{'@odata.type'='Microsoft.Dynamics.CRM.OptionSetMetadata';IsGlobal=$false;OptionSetType='Picklist';Options=$options}
    }
    Ledger-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$Table')/Attributes" POST $body | Out-Null
}
function Ledger-Lookup([string]$Table,[string]$Schema,[string]$Display,[string]$Target) {
    $logical=$Schema.ToLowerInvariant()
    $found=Ledger-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$Table')/ManyToOneRelationships?`$select=ReferencingAttribute,ReferencedEntity,CascadeConfiguration&`$filter=ReferencingAttribute eq '$logical'"
    if (@($found.value).Count) {
        if (@($found.value).Count -ne 1 -or $found.value[0].ReferencedEntity -cne $Target -or $found.value[0].CascadeConfiguration.Delete -cne 'Restrict') {throw "Incompatible source relationship $Table/$logical"};return
    }
    Ledger-Api '/api/data/v9.2/RelationshipDefinitions' POST @{
        '@odata.type'='Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata';SchemaName="${Table}_${logical}";ReferencedEntity=$Target;ReferencingEntity=$Table
        Lookup=@{'@odata.type'='Microsoft.Dynamics.CRM.LookupAttributeMetadata';SchemaName=$Schema;DisplayName=(Ledger-Label $Display);RequiredLevel=@{Value='None'};IsAuditEnabled=@{Value=$true}}
        CascadeConfiguration=@{Assign='NoCascade';Delete='Restrict';Merge='NoCascade';Reparent='NoCascade';Share='NoCascade';Unshare='NoCascade'}
    } | Out-Null
}
$config=Get-Content -Raw (Join-Path $ledgerRoot 'power.config.json')|ConvertFrom-Json
if ($config.environmentId -cne 'b58b083e-d27d-eabd-a143-2a49dcb9d89a') {throw 'Unexpected Code App environment.'}
$solution=Ledger-Api "/api/data/v9.2/solutions?`$select=solutionid,uniquename,ismanaged&`$expand=publisherid(`$select=customizationprefix,customizationoptionvalueprefix)&`$filter=uniquename eq '$ledgerSolution'"
if (@($solution.value).Count -ne 1 -or $solution.value[0].ismanaged -or $solution.value[0].publisherid.customizationprefix -cne 'a365' -or $solution.value[0].publisherid.customizationoptionvalueprefix -ne 74991) {throw 'Expected verified unmanaged solution/publisher.'}
if (-not $Apply) {Write-Host 'Read-only Ledger preflight passed for The Daily Operation - Dev / A365_DailyOperations / a365. No changes.';return}
Ledger-Table 'a365_LedgerTransaction' 'Ledger Transaction'
Ledger-Table 'a365_LedgerOperation' 'Ledger Operation'
Ledger-Table 'a365_LedgerCoordination' 'Ledger Coordination'
Ledger-Table 'a365_LedgerHistory' 'Ledger Historical Posting'
$transaction='a365_ledgertransaction'
Ledger-Column $transaction 'a365_Date' 'Date' 'DateTime'
Ledger-Column $transaction 'a365_Receipt' 'OR Number' 'String' 100
Ledger-Column $transaction 'a365_Reference' 'Reference' 'String' 500
Ledger-Column $transaction 'a365_Direction' 'Direction' 'String' 6
Ledger-Column $transaction 'a365_Amount' 'Amount (PHP)' 'Decimal'
Ledger-Column $transaction 'a365_Category' 'Chart of Account' 'Picklist'
Ledger-Column $transaction 'a365_Description' 'Description' 'Memo' 2000
Ledger-Column $transaction 'a365_SourceEntry' 'Payroll Entry Identity' 'String' 36
Ledger-Column $transaction 'a365_SourceKey' 'Payroll Source Key' 'String' 73
Ledger-Column $transaction 'a365_PostedOn' 'Posted On' 'DateTime'
Ledger-Column $transaction 'a365_PaidSnapshot' 'Paid On Snapshot' 'DateTime'
Ledger-Column $transaction 'a365_HistoryReviewed' 'Unrelated Manual Payment Reviewed' 'Boolean'
Ledger-Column 'a365_ledgeroperation' 'a365_Fingerprint' 'Request Fingerprint' 'String' 64
Ledger-Column 'a365_ledgeroperation' 'a365_Result' 'Committed Result' 'Memo' 100000
Ledger-Column 'a365_ledgeroperation' 'a365_CompletedOn' 'Completed On' 'DateTime'
Ledger-Column 'a365_ledgercoordination' 'a365_LockToken' 'Lock Token' 'String' 36
Ledger-Column 'a365_ledgercoordination' 'a365_Revision' 'Financial Revision' 'String' 36
Ledger-Column 'a365_ledgercoordination' 'a365_Categories' 'Verified Category Metadata' 'Memo' 10000
foreach ($field in @('CreatedCount','SkippedCount','FailedCount')) {Ledger-Column 'a365_ledgerhistory' "a365_$field" $field 'Integer'}
Ledger-Column 'a365_ledgerhistory' 'a365_Status' 'Posting Status' 'String' 16
Ledger-Column 'a365_ledgerhistory' 'a365_Attempt' 'Attempt Identity' 'String' 36
Ledger-Column 'a365_ledgerhistory' 'a365_Error' 'Safe Posting Error' 'String' 500
Ledger-Lookup $transaction 'a365_SourcePeriod' 'Source Payroll Period' 'a365_payrollperiod'
Ledger-Lookup $transaction 'a365_SourceEmployee' 'Source Employee' 'a365_employee'
Ledger-Lookup $transaction 'a365_PostedBy' 'Posted By' 'systemuser'
Ledger-Lookup 'a365_ledgeroperation' 'a365_Actor' 'Acting Admin' 'systemuser'
Ledger-Lookup 'a365_ledgerhistory' 'a365_Period' 'Payroll Period' 'a365_payrollperiod'
Ledger-Lookup 'a365_ledgerhistory' 'a365_RequestedBy' 'Requested By' 'systemuser'
$keys=Ledger-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$transaction')/Keys?`$select=SchemaName,KeyAttributes,EntityKeyIndexStatus"
if (-not @($keys.value|Where-Object SchemaName -ceq 'a365_LedgerSourceKey').Count) {
    Ledger-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$transaction')/Keys" POST @{SchemaName='a365_LedgerSourceKey';DisplayName=(Ledger-Label 'Unique payroll source');KeyAttributes=@('a365_sourcekey')} | Out-Null
}
foreach ($table in @($transaction,'a365_ledgeroperation','a365_ledgercoordination','a365_ledgerhistory')) {
    $meta=Ledger-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$table')?`$select=MetadataId,LogicalName,EntitySetName"
    Ledger-Api '/api/data/v9.2/AddSolutionComponent' POST @{ComponentId=$meta.MetadataId;ComponentType=1;SolutionUniqueName=$ledgerSolution;AddRequiredComponents=$false} | Out-Null
}
Ledger-Api '/api/data/v9.2/PublishXml' POST @{ParameterXml='<importexportxml><entities><entity>a365_ledgertransaction</entity><entity>a365_ledgeroperation</entity><entity>a365_ledgercoordination</entity><entity>a365_ledgerhistory</entity></entities></importexportxml>'} | Out-Null
$choice=Ledger-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$transaction')/Attributes(LogicalName='a365_category')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet"
$categories=@{};foreach($option in $choice.OptionSet.Options) {$categories[$option.Label.UserLocalizedLabel.Label]=[int]$option.Value}
if($categories.Count -ne 9) {throw 'Expected exactly nine verified categories.'}
$coordinationMeta=Ledger-Api "/api/data/v9.2/EntityDefinitions(LogicalName='a365_ledgercoordination')?`$select=EntitySetName"
$ledgerCompany='25886558-8d32-45f8-8294-f13b220ba37a'
$existing=Ledger-Api "/api/data/v9.2/$($coordinationMeta.EntitySetName)?`$select=a365_ledgercoordinationid,a365_categories&`$filter=a365_ledgercoordinationid eq $ledgerCompany"
if(-not @($existing.value).Count) {
    Ledger-Api "/api/data/v9.2/$($coordinationMeta.EntitySetName)" POST @{a365_ledgercoordinationid=$ledgerCompany;a365_name='Company ledger';a365_revision=([guid]::NewGuid().ToString());a365_locktoken=([guid]::NewGuid().ToString());a365_categories=($categories|ConvertTo-Json -Compress)} | Out-Null
}
$evidence=[ordered]@{Environment=$ledgerEnvironment;Solution=$ledgerSolution;Publisher='a365';Categories=$categories;Tables=@($transaction,'a365_ledgeroperation','a365_ledgercoordination','a365_ledgerhistory');ServerRegistered=$false;RoleGrantsApplied=$false}
$evidence|ConvertTo-Json -Depth 10|Set-Content -Encoding UTF8 (Join-Path $ledgerRoot 'docs/ledger-schema-verification.json')
Write-Host 'Ledger metadata and coordination configuration created. No financial rows, role grants, plugin registration, app push or history posting.'
