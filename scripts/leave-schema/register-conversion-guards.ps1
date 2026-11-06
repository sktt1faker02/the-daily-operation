param([switch]$Apply)
# Run only with deployment authorization, after updating the signed Leave DLL.
$ErrorActionPreference='Stop'
$conversionCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$conversionEnvironment='https://org9a7651f0.crm5.dynamics.com'
$conversionWork=Join-Path $PSScriptRoot '.work/conversion'
function Guard-Api([string]$Path,[string]$Method='GET',$Body=$null){
    if($Path -notmatch '^/api/data/v9\.2/(EntityDefinitions|plugintypes|sdkmessages|sdkmessagefilters|sdkmessageprocessingsteps|AddSolutionComponent)'){throw 'Outside guard registration scope.'}
    if($Method -ne 'GET' -and -not $Apply){throw 'Deployment authorization and -Apply required.'}
    $arguments=@('api','request','--target','dataverse','--environment',$conversionEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex')
    if($Method -ne 'GET'){
        $file=Join-Path $conversionWork 'guard.json';[IO.File]::WriteAllText($file,($Body|ConvertTo-Json -Depth 12 -Compress),(New-Object Text.UTF8Encoding($false)))
        $arguments+=@('--body-file',$file,'--header','MSCRM.SolutionUniqueName:A365_DailyOperations','--header','Prefer:return=representation')
    }
    $output=& $conversionCli @arguments
    if($LASTEXITCODE -ne 0){throw 'Guard registration failed; inspect state before retrying.'}
    if($output){return (($output -join "`n")|ConvertFrom-Json)}
}
$types=Guard-Api '/api/data/v9.2/plugintypes?$select=plugintypeid&$filter=typename eq ''A365.Leave.Plugins.ProtectLeaveWrites'''
if(@($types.value).Count -ne 1){throw 'Expected existing Leave write guard type.'}
$stepDefinition=Guard-Api '/api/data/v9.2/EntityDefinitions(LogicalName=''sdkmessageprocessingstep'')?$select=LogicalName&$expand=ManyToOneRelationships($select=ReferencingAttribute,ReferencingEntityNavigationPropertyName,ReferencedEntity)'
function Step-Binding($Body,[string]$Attribute,[string]$Target,[string]$EntitySet,[string]$Id){
    $link=@($stepDefinition.ManyToOneRelationships|Where-Object {$_.ReferencingAttribute -ceq $Attribute -and $_.ReferencedEntity -ceq $Target})
    if($link.Count -ne 1){throw 'Unverified step navigation property.'}
    $Body["$($link[0].ReferencingEntityNavigationPropertyName)@odata.bind"]="/$EntitySet($Id)"
}
foreach($table in @('a365_leaveconversionyear','a365_leavecashconversion')){
    foreach($message in @('Create','Update','Delete','Upsert','CreateMultiple','UpdateMultiple','UpsertMultiple','Assign','SetState','Merge')){
        $messages=Guard-Api "/api/data/v9.2/sdkmessages?`$select=sdkmessageid&`$filter=name eq '$message'"
        if(@($messages.value).Count -ne 1){continue}
        $filters=Guard-Api "/api/data/v9.2/sdkmessagefilters?`$select=sdkmessagefilterid&`$filter=_sdkmessageid_value eq $($messages.value[0].sdkmessageid) and primaryobjecttypecode eq '$table'"
        if(@($filters.value).Count -ne 1){continue}
        $name="A365 Conversion Guard $table $message"
        $existing=Guard-Api "/api/data/v9.2/sdkmessageprocessingsteps?`$select=sdkmessageprocessingstepid,stage,mode,statecode&`$filter=name eq '$name'"
        if(@($existing.value).Count -gt 1){throw 'Duplicate guard registrations need review.'}
        if(@($existing.value).Count){if($existing.value[0].stage -ne 20 -or $existing.value[0].mode -ne 0 -or $existing.value[0].statecode -ne 0){throw 'Existing guard is disabled or has an unexpected stage/mode.'};continue}
        if(-not $Apply){Write-Host "Planned: $name";continue}
        $body=@{name=$name;stage=20;mode=0;rank=1;supporteddeployment=0}
        Step-Binding $body 'eventhandler' 'plugintype' 'plugintypes' $types.value[0].plugintypeid
        Step-Binding $body 'sdkmessageid' 'sdkmessage' 'sdkmessages' $messages.value[0].sdkmessageid
        Step-Binding $body 'sdkmessagefilterid' 'sdkmessagefilter' 'sdkmessagefilters' $filters.value[0].sdkmessagefilterid
        $created=Guard-Api '/api/data/v9.2/sdkmessageprocessingsteps' POST $body
        if(-not $created.sdkmessageprocessingstepid){throw 'No verified guard id; inspect before retry.'}
        Guard-Api '/api/data/v9.2/AddSolutionComponent' POST @{ComponentId=$created.sdkmessageprocessingstepid;ComponentType=92;SolutionUniqueName='A365_DailyOperations';AddRequiredComponents=$false}|Out-Null
    }
}
Write-Host 'Guard plan complete. No business records written.'
