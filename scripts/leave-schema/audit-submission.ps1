param([ValidateSet('before','after')][string]$Label='before')
# Read-only inspection of the existing Leave command deployment.
$ErrorActionPreference = 'Stop'
$leaveCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$leaveWork = Join-Path $PSScriptRoot '.work/submission-audit'
New-Item -ItemType Directory -Force $leaveWork | Out-Null
function Read-Submission([string]$Path) {
    $leaveRaw = & $leaveCli api request --target dataverse --environment $leaveEnvironment --path $Path --context 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex'
    if ($LASTEXITCODE -ne 0) { throw "Read-only audit failed: $Path" }
    return (($leaveRaw -join "`n") | ConvertFrom-Json)
}
$leaveWho = Read-Submission '/api/data/v9.2/WhoAmI'
$leaveAssemblies = Read-Submission '/api/data/v9.2/pluginassemblies?$select=pluginassemblyid,name,version,modifiedon,publickeytoken,content&$filter=name eq ''A365.Leave.Plugins'''
if (@($leaveAssemblies.value).Count -ne 1) { throw 'Expected one Leave assembly.' }
$leaveAssembly = $leaveAssemblies.value[0]
$leaveLiveDll = Join-Path $leaveWork "live-$Label.dll"
[IO.File]::WriteAllBytes($leaveLiveDll, [Convert]::FromBase64String($leaveAssembly.content))
$leaveLocalDll = Join-Path $PSScriptRoot '../../plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
$leaveAssembly.content = $null
$leaveTypes = Read-Submission '/api/data/v9.2/plugintypes?$select=plugintypeid,typename,_pluginassemblyid_value&$filter=startswith(typename,''A365.Leave.Plugins.'')'
$leaveSteps = Read-Submission '/api/data/v9.2/sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid,name,stage,mode,statecode,_eventhandler_value,_sdkmessageid_value,_sdkmessagefilterid_value&$filter=startswith(name,''A365 Leave Guard '')'
$leaveMessages = Read-Submission '/api/data/v9.2/sdkmessages?$select=sdkmessageid,name&$filter=name eq ''a365_LeaveCommand'' or name eq ''Create'' or name eq ''Update'' or name eq ''Delete'' or name eq ''Upsert'' or name eq ''CreateMultiple'' or name eq ''UpdateMultiple'' or name eq ''UpsertMultiple'' or name eq ''Assign'' or name eq ''SetState'' or name eq ''Merge'''
$leaveFilters = Read-Submission '/api/data/v9.2/sdkmessagefilters?$select=sdkmessagefilterid,primaryobjecttypecode,_sdkmessageid_value&$filter=primaryobjecttypecode eq ''a365_leave'' or primaryobjecttypecode eq ''a365_leavecredittransaction'' or primaryobjecttypecode eq ''a365_leavecoordination'''
$leaveApi = Read-Submission '/api/data/v9.2/customapis?$select=customapiid,uniquename,bindingtype,isfunction,allowedcustomprocessingsteptype,_plugintypeid_value&$filter=uniquename eq ''a365_LeaveCommand'''
if (@($leaveApi.value).Count -ne 1) { throw 'Expected one Leave API.' }
$leaveApiId = $leaveApi.value[0].customapiid
$leaveRequest = Read-Submission "/api/data/v9.2/customapirequestparameters?`$select=uniquename,type,isoptional&`$filter=_customapiid_value eq $leaveApiId"
$leaveResponse = Read-Submission "/api/data/v9.2/customapiresponseproperties?`$select=uniquename,type&`$filter=_customapiid_value eq $leaveApiId"
$leaveApiMessage = @($leaveMessages.value | Where-Object name -ceq 'a365_LeaveCommand')
if ($leaveApiMessage.Count -ne 1) { throw 'Expected one API message.' }
$leaveExtraSteps = Read-Submission "/api/data/v9.2/sdkmessageprocessingsteps?`$select=name,stage,mode,statecode&`$filter=_sdkmessageid_value eq $($leaveApiMessage[0].sdkmessageid)"
$leaveOrg = Read-Submission '/api/data/v9.2/organizations?$select=organizationid,name,plugintracelogsetting'
$leaveDirectRoles = Read-Submission "/api/data/v9.2/systemusers($($leaveWho.UserId))/systemuserroles_association?`$select=name,roleid"
$leaveCommandFile = Join-Path $leaveWork 'diagnostics.json'
[IO.File]::WriteAllText($leaveCommandFile, '{"Request":"{\"command\":\"diagnostics\"}"}', (New-Object Text.UTF8Encoding($false)))
$leaveRaw = & $leaveCli api request --target dataverse --environment $leaveEnvironment --path '/api/data/v9.2/a365_LeaveCommand' --method POST --body-file $leaveCommandFile --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
if ($LASTEXITCODE -ne 0) { throw 'Read-only command diagnostics failed.' }
$leaveDiagnostics = ((($leaveRaw -join "`n") | ConvertFrom-Json).Response | ConvertFrom-Json)
$leaveReport = [ordered]@{
    Environment=$leaveEnvironment; VerifiedAt=[datetime]::UtcNow.ToString('o'); Assembly=$leaveAssembly
    LiveHash=(Get-FileHash $leaveLiveDll -Algorithm SHA256).Hash
    LocalHash=(Get-FileHash $leaveLocalDll -Algorithm SHA256).Hash
    Types=@($leaveTypes.value); Api=@($leaveApi.value); Request=@($leaveRequest.value); Response=@($leaveResponse.value)
    OtherApiSteps=@($leaveExtraSteps.value); Diagnostics=$leaveDiagnostics
    AdminRolePresent=(@($leaveDirectRoles.value | Where-Object name -ceq 'A365 - Payroll Admin').Count -gt 0)
    Organization=@($leaveOrg.value); Steps=@($leaveSteps.value | ForEach-Object {
        $leaveStep=$_
        [ordered]@{Id=$leaveStep.sdkmessageprocessingstepid;Name=$leaveStep.name;Stage=$leaveStep.stage;Mode=$leaveStep.mode;State=$leaveStep.statecode;Handler=$leaveStep._eventhandler_value
            Message=(@($leaveMessages.value | Where-Object sdkmessageid -eq $leaveStep._sdkmessageid_value)[0].name)
            Entity=(@($leaveFilters.value | Where-Object sdkmessagefilterid -eq $leaveStep._sdkmessagefilterid_value)[0].primaryobjecttypecode)}
    })
}
$leaveJson=$leaveReport | ConvertTo-Json -Depth 10
[IO.File]::WriteAllText((Join-Path $leaveWork "audit-$Label.json"), $leaveJson, (New-Object Text.UTF8Encoding($false)))
$leaveJson
