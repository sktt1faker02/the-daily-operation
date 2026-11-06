param([switch]$Apply)
# Deployment tool: intentionally NOT executed during implementation.
$ErrorActionPreference='Stop'
$ledgerRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$ledgerEnvironment='https://org9a7651f0.crm5.dynamics.com'
$ledgerSolution='A365_DailyOperations'
$ledgerCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$ledgerWork=Join-Path $PSScriptRoot '.work/registration'
New-Item -ItemType Directory -Force -Path $ledgerWork|Out-Null
function Register-Api([string]$Path,[string]$Method='GET',$Body=$null) {
    if($Path -notmatch '^/api/data/v9\.2/(EntityDefinitions|solutions\?|pluginassemblies|plugintypes|customapis|customapirequestparameters|customapiresponseproperties|sdkmessages|sdkmessagefilters|sdkmessageprocessingsteps|AddSolutionComponent)'){throw 'Outside Ledger registration scope.'}
    if($Method -ne 'GET' -and -not $Apply){throw 'Explicit -Apply required for deployment.'}
    $arguments=@('api','request','--target','dataverse','--environment',$ledgerEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex')
    if($Method -ne 'GET') {
        $file=Join-Path $ledgerWork 'request.json'
        [IO.File]::WriteAllText($file,($Body|ConvertTo-Json -Depth 40 -Compress),(New-Object Text.UTF8Encoding($false)))
        $arguments+=@('--body-file',$file,'--header',"MSCRM.SolutionUniqueName:$ledgerSolution",'--header','Prefer:return=representation')
    }
    $result=& $ledgerCli @arguments
    if($LASTEXITCODE -ne 0){throw "Registration failed: $Method $Path. Inspect current state before retrying."}
    if($result){return (($result -join "`n")|ConvertFrom-Json)}
}
$ledgerMetadata=@{}
function Register-Meta([string]$Table) {
    if(-not $ledgerMetadata.ContainsKey($Table)) {$ledgerMetadata[$Table]=Register-Api "/api/data/v9.2/EntityDefinitions(LogicalName='$Table')?`$select=LogicalName,PrimaryIdAttribute,EntitySetName&`$expand=ManyToOneRelationships(`$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName,ReferencedEntity)"}
    return $ledgerMetadata[$Table]
}
function Register-Bind($Body,[string]$Table,[string]$Column,[string]$Target,[guid]$Id) {
    $links=@((Register-Meta $Table).ManyToOneRelationships|Where-Object {$_.ReferencingAttribute -ceq $Column -and $_.ReferencedEntity -ceq $Target})
    if($links.Count -ne 1){throw "Unverified registration relationship $Table/$Column"}
    $Body["$($links[0].ReferencingEntityNavigationPropertyName)@odata.bind"]="/$((Register-Meta $Target).EntitySetName)($Id)"
}
function Register-Record([string]$Table,[string]$Filter,$Body) {
    $meta=Register-Meta $Table
    $found=Register-Api "/api/data/v9.2/$($meta.EntitySetName)?`$select=$($meta.PrimaryIdAttribute)&`$filter=$Filter"
    if(@($found.value).Count -gt 1){throw "Duplicate $Table registration"}
    if(@($found.value).Count){return [guid]$found.value[0].($meta.PrimaryIdAttribute)}
    $created=Register-Api "/api/data/v9.2/$($meta.EntitySetName)" POST $Body
    if(-not $created.($meta.PrimaryIdAttribute)){throw 'Registration outcome uncertain; inspect before retry.'}
    return [guid]$created.($meta.PrimaryIdAttribute)
}
function Register-Component([guid]$Id,[int]$Type){Register-Api '/api/data/v9.2/AddSolutionComponent' POST @{ComponentId=$Id;ComponentType=$Type;SolutionUniqueName=$ledgerSolution;AddRequiredComponents=$false}|Out-Null}
$config=Get-Content -Raw (Join-Path $ledgerRoot 'power.config.json')|ConvertFrom-Json
if($config.environmentId -cne 'b58b083e-d27d-eabd-a143-2a49dcb9d89a'){throw 'Unexpected environment.'}
$solutions=Register-Api "/api/data/v9.2/solutions?`$select=solutionid,ismanaged&`$filter=uniquename eq '$ledgerSolution'"
if(@($solutions.value).Count -ne 1 -or $solutions.value[0].ismanaged){throw 'Expected existing unmanaged solution.'}
$source=Register-Api "/api/data/v9.2/EntityDefinitions(LogicalName='a365_ledgertransaction')?`$select=LogicalName,IsAuditEnabled&`$expand=Keys(`$select=SchemaName,KeyAttributes,EntityKeyIndexStatus)"
if(-not $source.IsAuditEnabled.Value -or @($source.Keys|Where-Object {$_.SchemaName -ceq 'a365_LedgerSourceKey' -and $_.EntityKeyIndexStatus -ceq 'Active'}).Count -ne 1){throw 'Auditing and active source uniqueness are required.'}
if(-not $Apply){Write-Host 'Read-only server registration preflight passed. No deployment.';return}
$assemblyPath=Join-Path $ledgerRoot 'plugins/A365.Ledger.Plugins/bin/A365.Ledger.Plugins.dll'
$assembly=[Reflection.AssemblyName]::GetAssemblyName($assemblyPath)
$token=($assembly.GetPublicKeyToken()|ForEach-Object {$_.ToString('x2')}) -join ''
$body=@{name='A365.Ledger.Plugins';version=$assembly.Version.ToString();culture='neutral';publickeytoken=$token;isolationmode=2;sourcetype=0;content=[Convert]::ToBase64String([IO.File]::ReadAllBytes($assemblyPath))}
$assemblyId=Register-Record 'pluginassembly' "name eq 'A365.Ledger.Plugins'" $body
Register-Api "/api/data/v9.2/pluginassemblies($assemblyId)" PATCH @{content=$body.content}|Out-Null
Register-Component $assemblyId 91
$types=@{}
foreach($type in @('LedgerCommand','ProtectLedgerWrites','ProtectPayrollPayment','ProtectPayrollEntries','HistoryWorker')) {
    $body=@{typename="A365.Ledger.Plugins.$type";name="A365.Ledger.Plugins.$type";friendlyname="A365 $type"}
    Register-Bind $body 'plugintype' 'pluginassemblyid' 'pluginassembly' $assemblyId
    $types[$type]=Register-Record 'plugintype' "typename eq 'A365.Ledger.Plugins.$type'" $body
}
$apiBody=@{uniquename='a365_LedgerCommand';name='A365 Ledger Command';displayname='A365 Ledger Command';description='Payroll Admin ledger reads, validated CRUD, atomic payment and durable history commands.';bindingtype=0;isfunction=$false;isprivate=$false;allowedcustomprocessingsteptype=0}
Register-Bind $apiBody 'customapi' 'plugintypeid' 'plugintype' $types.LedgerCommand
$apiId=Register-Record 'customapi' "uniquename eq 'a365_LedgerCommand'" $apiBody
foreach($parameterTable in @('customapirequestparameter','customapiresponseproperty')) {
    $name=if($parameterTable -eq 'customapirequestparameter'){'Request'}else{'Response'}
    $body=@{uniquename=$name;name="a365_LedgerCommand.$name";displayname=$name;type=10}
    if($parameterTable -eq 'customapirequestparameter'){$body.isoptional=$false}
    Register-Bind $body $parameterTable 'customapiid' 'customapi' $apiId
    Register-Record $parameterTable "_customapiid_value eq $apiId and uniquename eq '$name'" $body|Out-Null
}
function Register-Step([string]$Table,[string]$Message,[string]$Type,[int]$Mode,[string]$Filtering='') {
    $messages=Register-Api "/api/data/v9.2/sdkmessages?`$select=sdkmessageid&`$filter=name eq '$Message'"
    if(@($messages.value).Count -ne 1){throw "Unknown SDK message $Message"}
    $messageId=[guid]$messages.value[0].sdkmessageid
    $filters=Register-Api "/api/data/v9.2/sdkmessagefilters?`$select=sdkmessagefilterid&`$filter=_sdkmessageid_value eq $messageId and primaryobjecttypecode eq '$Table'"
    if(@($filters.value).Count -ne 1){Write-Host "No supported $Message filter for $Table";return}
    $name="A365 Ledger $Type $Table $Message"
    $body=@{name=$name;stage=20;mode=$Mode;rank=1;supporteddeployment=0}
    if($Mode -eq 1){$body.stage=40;$body.asyncautodelete=$false}
    if($Filtering){$body.filteringattributes=$Filtering}
    Register-Bind $body 'sdkmessageprocessingstep' 'eventhandler' 'plugintype' $types[$Type]
    Register-Bind $body 'sdkmessageprocessingstep' 'sdkmessageid' 'sdkmessage' $messageId
    Register-Bind $body 'sdkmessageprocessingstep' 'sdkmessagefilterid' 'sdkmessagefilter' ([guid]$filters.value[0].sdkmessagefilterid)
    $stepId=Register-Record 'sdkmessageprocessingstep' "name eq '$name'" $body
    Register-Component $stepId 92
}
foreach($table in @('a365_ledgertransaction','a365_ledgeroperation','a365_ledgercoordination','a365_ledgerhistory')) {
    foreach($message in @('Create','Update','Delete','Upsert','CreateMultiple','UpdateMultiple','UpsertMultiple','Assign','SetState','Merge')) {Register-Step $table $message 'ProtectLedgerWrites' 0}
}
foreach($message in @('Create','CreateMultiple','Update','UpdateMultiple','Upsert','UpsertMultiple')) {Register-Step 'a365_payrollperiod' $message 'ProtectPayrollPayment' 0}
foreach($message in @('Create','Update','Delete','CreateMultiple','UpdateMultiple','DeleteMultiple','Upsert','UpsertMultiple')) {Register-Step 'a365_payrollentry' $message 'ProtectPayrollEntries' 0}
Register-Step 'a365_ledgerhistory' 'Create' 'HistoryWorker' 1
Register-Step 'a365_ledgerhistory' 'Update' 'HistoryWorker' 1 'a365_attempt'
Write-Host 'Ledger server registered. Verify guard coverage before granting roles. Generate the API data source and test before app release.'
