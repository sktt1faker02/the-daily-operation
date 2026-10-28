param([switch]$Apply)
# Owner-authorized additive Leave metadata only. No record or role changes.
$ErrorActionPreference = 'Stop'
$splitEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$splitSolution = 'A365_DailyOperations'
$splitCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$splitRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$splitWork = Join-Path $PSScriptRoot '.work/partial-paid'
New-Item -ItemType Directory -Force -Path $splitWork | Out-Null
function Split-Api([string]$Path, [string]$Method = 'GET', $Body = $null) {
    if ($Path -notmatch '^/api/data/v9\.2/(EntityDefinitions|solutions|publishers|AddSolutionComponent|InsertOptionValue|PublishXml)') { throw 'Outside approved metadata scope.' }
    if ($Method -ne 'GET' -and -not $Apply) { throw 'Explicit -Apply required.' }
    $splitArgs = @('api','request','--target','dataverse','--environment',$splitEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex')
    if ($null -ne $Body) {
        $splitBody = Join-Path $splitWork 'schema-request.json'
        [IO.File]::WriteAllText($splitBody, ($Body | ConvertTo-Json -Depth 30 -Compress), (New-Object Text.UTF8Encoding($false)))
        $splitArgs += @('--body-file',$splitBody,'--header',"MSCRM.SolutionUniqueName:$splitSolution")
    }
    $splitOutput = & $splitCli @splitArgs
    if ($LASTEXITCODE -ne 0) { throw "Metadata request failed: $Method $Path. Inspect existing metadata before retrying." }
    if ($splitOutput) { return (($splitOutput -join "`n") | ConvertFrom-Json) }
}
function Split-Label([string]$Text) { return @{LocalizedLabels=@(@{Label=$Text;LanguageCode=1033})} }
$splitConfig = Get-Content -Raw -LiteralPath (Join-Path $splitRoot 'power.config.json') | ConvertFrom-Json
if ($splitConfig.environmentId -cne 'b58b083e-d27d-eabd-a143-2a49dcb9d89a') { throw 'Unexpected project environment.' }
$splitSolutions = Split-Api "/api/data/v9.2/solutions?`$select=solutionid,uniquename,ismanaged,_publisherid_value&`$filter=uniquename eq '$splitSolution'"
if (@($splitSolutions.value).Count -ne 1 -or $splitSolutions.value[0].ismanaged) { throw 'Expected the existing unmanaged solution.' }
$splitPublisher = Split-Api "/api/data/v9.2/publishers($($splitSolutions.value[0]._publisherid_value))?`$select=customizationprefix"
if ($splitPublisher.customizationprefix -cne 'a365') { throw 'Unexpected solution publisher.' }
$splitBase = "/api/data/v9.2/EntityDefinitions(LogicalName='a365_leave')/Attributes"
$splitChoicePath = "$splitBase(LogicalName='a365_benefit')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$expand=OptionSet"
$splitChoice = Split-Api $splitChoicePath
if ($splitChoice.OptionSet.IsGlobal) { throw 'Expected the confirmed local Benefit choice.' }
foreach ($splitOriginal in @(@(749910000,'Paid'),@(749910001,'Unpaid'))) {
    $splitOption = @($splitChoice.OptionSet.Options | Where-Object { $_.Value -eq $splitOriginal[0] })
    if ($splitOption.Count -ne 1 -or $splitOption[0].Label.UserLocalizedLabel.Label -cne $splitOriginal[1]) { throw 'Existing Benefit options differ.' }
}
$splitExisting = Split-Api "$splitBase`?`$select=LogicalName,SchemaName,AttributeType,MetadataId&`$filter=LogicalName eq 'a365_paiddays' or LogicalName eq 'a365_unpaiddays' or LogicalName eq 'a365_allocationjson'"
if (-not $Apply) { Write-Host "Verified Dev/solution/publisher and existing Paid/Unpaid choices; $(@($splitExisting.value).Count) allocation fields already exist. No writes."; return }
foreach ($splitColumn in @(@('a365_PaidDays','Paid Days','Decimal'),@('a365_UnpaidDays','Unpaid Days','Decimal'),@('a365_AllocationJson','Allocation JSON','Memo'))) {
    $splitLogical = $splitColumn[0].ToLowerInvariant()
    $splitFound = @($splitExisting.value | Where-Object { $_.LogicalName -ceq $splitLogical })
    if ($splitFound.Count) {
        if ($splitFound[0].SchemaName -cne $splitColumn[0] -or $splitFound[0].AttributeType -cne $splitColumn[2]) { throw 'Incompatible existing allocation column.' }
    } else {
        $splitMetadata = @{'@odata.type'="Microsoft.Dynamics.CRM.$($splitColumn[2])AttributeMetadata";SchemaName=$splitColumn[0];DisplayName=(Split-Label $splitColumn[1]);RequiredLevel=@{Value='None'};IsAuditEnabled=@{Value=$true}}
        if ($splitColumn[2] -eq 'Decimal') { $splitMetadata.MinValue=0; $splitMetadata.MaxValue=366; $splitMetadata.Precision=2 }
        else { $splitMetadata.MaxLength=100000; $splitMetadata.Format='TextArea' }
        Split-Api $splitBase POST $splitMetadata | Out-Null
    }
    $splitReadRows = $null
    for ($splitAttempt = 0; $splitAttempt -lt 10; $splitAttempt++) {
        $splitReadRows = Split-Api "$splitBase/Microsoft.Dynamics.CRM.$($splitColumn[2])AttributeMetadata`?`$filter=LogicalName eq '$splitLogical'"
        if (@($splitReadRows.value).Count -eq 1) { break }
        # Metadata propagation can lag a successful create. Retry reads only.
        Start-Sleep -Seconds 2
    }
    if (@($splitReadRows.value).Count -ne 1) { throw 'Created allocation column could not be read back.' }
    $splitReadBack = $splitReadRows.value[0]
    if ($splitReadBack.RequiredLevel.Value -cne 'None' -or -not $splitReadBack.IsAuditEnabled.Value) { throw 'Unexpected required/audit settings.' }
    if ($splitColumn[2] -eq 'Decimal' -and ($splitReadBack.Precision -ne 2 -or $splitReadBack.MinValue -ne 0 -or $splitReadBack.MaxValue -ne 366)) { throw 'Unexpected decimal constraints.' }
    if ($splitColumn[2] -eq 'Memo' -and $splitReadBack.MaxLength -ne 100000) { throw 'Unexpected allocation text length.' }
    Split-Api '/api/data/v9.2/AddSolutionComponent' POST @{ComponentId=$splitReadBack.MetadataId;ComponentType=2;SolutionUniqueName=$splitSolution;AddRequiredComponents=$false} | Out-Null
    Write-Host "Verified $splitLogical in $splitSolution."
}
$splitPartial = @($splitChoice.OptionSet.Options | Where-Object { $_.Value -eq 749910002 })
if (-not $splitPartial.Count) {
    Split-Api '/api/data/v9.2/InsertOptionValue' POST @{EntityLogicalName='a365_leave';AttributeLogicalName='a365_benefit';Value=749910002;Label=(Split-Label 'Partially Paid');SolutionUniqueName=$splitSolution} | Out-Null
} elseif ($splitPartial[0].Label.UserLocalizedLabel.Label -cne 'Partially Paid') { throw 'Partially Paid value already has a different meaning.' }
Split-Api '/api/data/v9.2/PublishXml' POST @{ParameterXml='<importexportxml><entities><entity>a365_leave</entity></entities></importexportxml>'} | Out-Null
$splitPublished = Split-Api $splitChoicePath
if (-not @($splitPublished.OptionSet.Options | Where-Object { $_.Value -eq 749910002 -and $_.Label.UserLocalizedLabel.Label -ceq 'Partially Paid' }).Count) { throw 'Published benefit option not verified.' }
Write-Host 'Published and verified additive Leave allocation schema. Existing records and security roles were not changed.'
