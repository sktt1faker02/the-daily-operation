param([switch]$VerifyOnly)

# Calls the installed Microsoft CLI; does not implement HTTP or authentication.
# Scoped to PLANS.md Stage 1. No records, roles, keys or environment settings are written.
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leaveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$leaveEnvironmentId = 'b58b083e-d27d-eabd-a143-2a49dcb9d89a'
$leaveSolution = 'A365_DailyOperations'
$leaveCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveContext = 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex'
$leaveWork = Join-Path $PSScriptRoot '.work'
if (-not (Test-Path -LiteralPath $leaveCli)) { throw 'Installed Dataverse CLI not found.' }

function Invoke-LeaveMetadata {
    param([string]$Path, [string]$Method = 'GET', [string]$BodyFile)
    if ($Path -notmatch '^/api/data/v9\.2/(EntityDefinitions|RelationshipDefinitions|PublishXml$|solutions\?|publishers\(|solutioncomponents\?|a365_(leave|leavecashconversion|leavecredittransaction)s\?)') {
        throw "Path is outside the Stage 1 allowlist: $Path"
    }
    if ($Method -notin @('GET', 'POST', 'PUT')) { throw 'Unsupported metadata method.' }
    if ($Method -ne 'GET') {
        if ($VerifyOnly) { throw 'VerifyOnly prohibits metadata writes.' }
        if ($Path -notmatch '^/api/data/v9\.2/(EntityDefinitions|RelationshipDefinitions|PublishXml$)') { throw 'Only table/column/relationship definitions may be written.' }
        if (-not $BodyFile) { throw 'A reviewed JSON metadata payload is required.' }
    }
    $leaveArgs = @('api', 'request', '--target', 'dataverse', '--environment', $leaveEnvironment,
        '--path', $Path, '--method', $Method, '--context', $leaveContext)
    if ($Method -ne 'GET') {
        $leaveArgs += @('--header', "MSCRM.SolutionUniqueName:$leaveSolution", '--body-file', $BodyFile)
        if ($Method -eq 'PUT') { $leaveArgs += @('--header', 'MSCRM.MergeLabels:true') }
    }
    $leaveOutput = & $leaveCli @leaveArgs
    if ($LASTEXITCODE -ne 0) { throw "Dataverse CLI failed ($Method $Path): $($leaveOutput -join ' ')" }
    if ($leaveOutput) { return (($leaveOutput -join "`n") | ConvertFrom-Json) }
}

function Get-LeaveTable {
    param([string]$LogicalName)
    $leaveResult = Invoke-LeaveMetadata "/api/data/v9.2/EntityDefinitions?`$select=LogicalName,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute,EntitySetName,OwnershipType,IsAuditEnabled&`$filter=LogicalName eq '$LogicalName'"
    if (@($leaveResult.value).Count -gt 1) { throw "Duplicate table metadata for $LogicalName" }
    return @($leaveResult.value)[0]
}

function Get-LeaveRelationships {
    param([string]$LogicalName)
    $leaveResult = Invoke-LeaveMetadata "/api/data/v9.2/EntityDefinitions(LogicalName='$LogicalName')/ManyToOneRelationships?`$select=SchemaName,ReferencedEntity,ReferencedAttribute,ReferencingEntity,ReferencingAttribute,ReferencingEntityNavigationPropertyName,CascadeConfiguration"
    return @($leaveResult.value)
}

function Assert-LeaveEqual {
    param($Actual, $Expected, [string]$Description)
    if ($Actual -cne $Expected) { throw "Verification failed: $Description. Expected '$Expected'; received '$Actual'." }
}

function Save-LeaveJson {
    param([string]$Path, $Value)
    [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 45), (New-Object Text.UTF8Encoding($false)))
}

Set-Location -LiteralPath $leaveRoot
$leaveApp = Get-Content -Raw -LiteralPath (Join-Path $leaveRoot 'power.config.json') | ConvertFrom-Json
Assert-LeaveEqual $leaveApp.environmentId $leaveEnvironmentId 'Code App environment'
$leaveOrgRaw = & $leaveCli org who --environment $leaveEnvironment --json
if ($LASTEXITCODE -ne 0) { throw 'Unable to verify the active Dataverse environment.' }
$leaveOrg = ($leaveOrgRaw -join "`n") | ConvertFrom-Json
Assert-LeaveEqual $leaveOrg.EnvironmentId $leaveEnvironmentId 'Dataverse environment'
Write-Host "Verified environment: $($leaveOrg.FriendlyName)"

$leaveSolutionRows = Invoke-LeaveMetadata "/api/data/v9.2/solutions?`$select=solutionid,uniquename,ismanaged,_publisherid_value&`$filter=uniquename eq '$leaveSolution'"
if (@($leaveSolutionRows.value).Count -ne 1) { throw 'Expected exactly one existing solution.' }
$leaveSolutionRow = $leaveSolutionRows.value[0]
Assert-LeaveEqual $leaveSolutionRow.ismanaged $false 'Unmanaged development solution'
$leavePublisher = Invoke-LeaveMetadata "/api/data/v9.2/publishers($($leaveSolutionRow._publisherid_value))?`$select=uniquename,customizationprefix,customizationoptionvalueprefix"
Assert-LeaveEqual $leavePublisher.customizationprefix 'a365' 'Publisher prefix'
Write-Host "Verified solution: $leaveSolution; publisher: $($leavePublisher.uniquename)"

$leaveParentTables = @{}
foreach ($leaveParent in @('a365_employee', 'systemuser')) {
    $leaveParentMetadata = Get-LeaveTable $leaveParent
    if (-not $leaveParentMetadata) { throw "Missing required existing parent: $leaveParent" }
    $leaveParentTables[$leaveParent] = $leaveParentMetadata
}
Assert-LeaveEqual $leaveParentTables['a365_employee'].PrimaryIdAttribute 'a365_employeeid' 'Employee primary key'
Assert-LeaveEqual $leaveParentTables['systemuser'].PrimaryIdAttribute 'systemuserid' 'User primary key'

$leaveTablePayloads = @('01-leave.json', '02-leave-cash-conversion.json', '03-leave-credit-transaction.json')
$leaveTableMetadata = @{}
foreach ($leaveTableFile in $leaveTablePayloads) {
    $leavePayloadPath = Join-Path $PSScriptRoot $leaveTableFile
    $leavePayload = Get-Content -Raw -LiteralPath $leavePayloadPath | ConvertFrom-Json
    $leaveLogical = $leavePayload.SchemaName.ToLowerInvariant()
    if ($leaveLogical -notin @('a365_leave', 'a365_leavecashconversion', 'a365_leavecredittransaction')) { throw 'Unexpected table payload.' }
    $leaveTable = Get-LeaveTable $leaveLogical
    if (-not $leaveTable) {
        if ($VerifyOnly) { throw "Missing table: $leaveLogical" }
        Write-Host "Creating table: $leaveLogical"
        Invoke-LeaveMetadata '/api/data/v9.2/EntityDefinitions' 'POST' $leavePayloadPath | Out-Null
        Start-Sleep -Seconds 6
        $leaveTable = Get-LeaveTable $leaveLogical
    }
    if (-not $leaveTable) { throw "Table not visible after creation; inspect before retrying: $leaveLogical" }
    Assert-LeaveEqual $leaveTable.OwnershipType 'UserOwned' "$leaveLogical ownership"
    Assert-LeaveEqual $leaveTable.PrimaryNameAttribute 'a365_name' "$leaveLogical primary name"
    Assert-LeaveEqual $leaveTable.IsAuditEnabled.Value $true "$leaveLogical auditing"
    $leavePrimaryKey = Invoke-LeaveMetadata "/api/data/v9.2/EntityDefinitions(LogicalName='$leaveLogical')/Attributes(LogicalName='$($leaveTable.PrimaryIdAttribute)')"
    Assert-LeaveEqual $leavePrimaryKey.AttributeType 'Uniqueidentifier' "$leaveLogical primary key type"
    Assert-LeaveEqual $leavePrimaryKey.IsPrimaryId $true "$leaveLogical primary key flag"
    $leaveTableMetadata[$leaveLogical] = $leaveTable
    $leaveParentTables[$leaveLogical] = $leaveTable
    Write-Host "Verified table: $leaveLogical; key: $($leaveTable.PrimaryIdAttribute); set: $($leaveTable.EntitySetName)"
}

if (-not $VerifyOnly) { Start-Sleep -Seconds 15 }
$leaveExistingRelationships = @{}
foreach ($leaveLogical in $leaveTableMetadata.Keys) { $leaveExistingRelationships[$leaveLogical] = @(Get-LeaveRelationships $leaveLogical) }
$leaveRelationshipFiles = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'relationships') -Filter '*.json' | Sort-Object Name)
if ($leaveRelationshipFiles.Count -ne 9) { throw 'Expected exactly nine business relationship payloads.' }
foreach ($leaveRelationshipFile in $leaveRelationshipFiles) {
    $leaveRelationship = Get-Content -Raw -LiteralPath $leaveRelationshipFile.FullName | ConvertFrom-Json
    if (-not $leaveTableMetadata.ContainsKey($leaveRelationship.ReferencingEntity)) { throw 'Unexpected relationship child.' }
    $leaveParent = $leaveParentTables[$leaveRelationship.ReferencedEntity]
    if (-not $leaveParent) { throw 'Unknown relationship parent.' }
    Assert-LeaveEqual $leaveRelationship.ReferencedAttribute $leaveParent.PrimaryIdAttribute "$($leaveRelationship.SchemaName) parent key"
    $leaveExisting = @($leaveExistingRelationships[$leaveRelationship.ReferencingEntity] | Where-Object { $_.ReferencingAttribute -eq $leaveRelationship.Lookup.SchemaName.ToLowerInvariant() })
    if ($leaveExisting.Count -gt 1) { throw 'Multiple relationships use the proposed lookup.' }
    if (-not $leaveExisting.Count) {
        if ($VerifyOnly) { throw "Missing relationship: $($leaveRelationship.SchemaName)" }
        Write-Host "Creating relationship: $($leaveRelationship.SchemaName)"
        Invoke-LeaveMetadata '/api/data/v9.2/RelationshipDefinitions' 'POST' $leaveRelationshipFile.FullName | Out-Null
        Start-Sleep -Seconds 3
    }
    # CreateOneToMany may not retain the lookup's requested audit flag.
    # Verify and, where supported, enable it on the new child lookup only.
    $leaveLookupPath = "/api/data/v9.2/EntityDefinitions(LogicalName='$($leaveRelationship.ReferencingEntity)')/Attributes(LogicalName='$($leaveRelationship.Lookup.SchemaName.ToLowerInvariant())')"
    $leaveLookupMetadata = Invoke-LeaveMetadata $leaveLookupPath
    if (-not $leaveLookupMetadata.IsAuditEnabled.Value) {
        if ($VerifyOnly) { throw "Lookup auditing is disabled: $($leaveRelationship.SchemaName)" }
        if (-not $leaveLookupMetadata.IsAuditEnabled.CanBeChanged) { throw "Lookup auditing cannot be changed: $($leaveRelationship.SchemaName)" }
        $leaveLookupMetadata.IsAuditEnabled.Value = $true
        $leaveLookupMetadata | Add-Member -NotePropertyName '@odata.type' -NotePropertyValue 'Microsoft.Dynamics.CRM.LookupAttributeMetadata' -Force
        New-Item -ItemType Directory -Force -Path $leaveWork | Out-Null
        $leaveLookupFile = Join-Path $leaveWork "$($leaveRelationship.ReferencingEntity)-$($leaveRelationship.Lookup.SchemaName)-audit.json"
        Save-LeaveJson $leaveLookupFile $leaveLookupMetadata
        Write-Host "Enabling lookup auditing: $($leaveRelationship.ReferencingEntity).$($leaveRelationship.Lookup.SchemaName)"
        Invoke-LeaveMetadata $leaveLookupPath 'PUT' $leaveLookupFile | Out-Null
    }
}

# Let Dataverse allocate option integers, then set defaults using the returned values.
$leaveDefaults = @(
    @{ Table = 'a365_leave'; Column = 'a365_leavestatus'; Label = 'Issued' },
    @{ Table = 'a365_leave'; Column = 'a365_notificationstatus'; Label = 'Not sent' },
    @{ Table = 'a365_leavecashconversion'; Column = 'a365_conversionstatus'; Label = 'Recorded' }
)
foreach ($leaveDefault in $leaveDefaults) {
    $leaveAttributePath = "/api/data/v9.2/EntityDefinitions(LogicalName='$($leaveDefault.Table)')/Attributes(LogicalName='$($leaveDefault.Column)')"
    $leaveAttribute = Invoke-LeaveMetadata "$leaveAttributePath/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$expand=OptionSet"
    $leaveOption = @($leaveAttribute.OptionSet.Options | Where-Object { @($_.Label.LocalizedLabels | Where-Object { $_.LanguageCode -eq 1033 -and $_.Label -ceq $leaveDefault.Label }).Count -eq 1 })
    if ($leaveOption.Count -ne 1) { throw 'Expected default option label was not returned by Dataverse.' }
    if ($leaveAttribute.DefaultFormValue -ne $leaveOption[0].Value) {
        if ($VerifyOnly) { throw "Incorrect default: $($leaveDefault.Column)" }
        $leaveAttribute.DefaultFormValue = $leaveOption[0].Value
        # A cast GET may omit @odata.type; PUT to the base collection needs it.
        $leaveAttribute | Add-Member -NotePropertyName '@odata.type' -NotePropertyValue 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata' -Force
        New-Item -ItemType Directory -Force -Path $leaveWork | Out-Null
        $leaveDefaultFile = Join-Path $leaveWork "$($leaveDefault.Table)-$($leaveDefault.Column).json"
        Save-LeaveJson $leaveDefaultFile $leaveAttribute
        Write-Host "Setting default: $($leaveDefault.Table).$($leaveDefault.Column) = $($leaveDefault.Label) ($($leaveOption[0].Value))"
        Invoke-LeaveMetadata $leaveAttributePath 'PUT' $leaveDefaultFile | Out-Null
    }
}

if (-not $VerifyOnly) {
    Write-Host 'Publishing only the three Leave table definitions.'
    Invoke-LeaveMetadata '/api/data/v9.2/PublishXml' 'POST' (Join-Path $PSScriptRoot 'publish.json') | Out-Null
}

$leaveReport = [ordered]@{
    VerifiedAt = [DateTime]::UtcNow.ToString('o'); Environment = $leaveEnvironment; EnvironmentId = $leaveEnvironmentId
    Solution = $leaveSolution; Publisher = $leavePublisher; Stage = 1; Tables = @(); Relationships = @()
    AlternateKeys = 'Not created: Stage 2'; SecurityRoles = 'Unchanged: manual owner configuration required'
    EnvironmentAuditing = 'Not changed; last read was disabled'; RecordWrites = 'None'
}
foreach ($leaveTableFile in $leaveTablePayloads) {
    $leavePayload = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot $leaveTableFile) | ConvertFrom-Json
    $leaveLogical = $leavePayload.SchemaName.ToLowerInvariant()
    $leaveAttributes = Invoke-LeaveMetadata "/api/data/v9.2/EntityDefinitions(LogicalName='$leaveLogical')/Attributes?`$filter=IsCustomAttribute eq true"
    $leaveColumns = @()
    foreach ($leaveExpected in $leavePayload.Attributes) {
        $leaveColumn = @($leaveAttributes.value | Where-Object { $_.LogicalName -ceq $leaveExpected.SchemaName.ToLowerInvariant() })
        if ($leaveColumn.Count -ne 1) { throw "Missing or duplicate column: $leaveLogical.$($leaveExpected.SchemaName)" }
        $leaveActual = $leaveColumn[0]
        Assert-LeaveEqual $leaveActual.'@odata.type' ('#' + $leaveExpected.'@odata.type') "$leaveLogical.$($leaveActual.LogicalName) type"
        Assert-LeaveEqual $leaveActual.RequiredLevel.Value $leaveExpected.RequiredLevel.Value "$leaveLogical.$($leaveActual.LogicalName) required level"
        Assert-LeaveEqual $leaveActual.IsAuditEnabled.Value $true "$leaveLogical.$($leaveActual.LogicalName) column auditing"
        foreach ($leaveProperty in @('MaxLength', 'Precision', 'PrecisionSource', 'MinValue', 'MaxValue', 'Format', 'IsPrimaryName')) {
            if ($leaveExpected.PSObject.Properties.Name -contains $leaveProperty) {
                Assert-LeaveEqual $leaveActual.$leaveProperty $leaveExpected.$leaveProperty "$leaveLogical.$($leaveActual.LogicalName) $leaveProperty"
            }
        }
        if ($leaveExpected.DateTimeBehavior) { Assert-LeaveEqual $leaveActual.DateTimeBehavior.Value $leaveExpected.DateTimeBehavior.Value "$leaveLogical.$($leaveActual.LogicalName) date behavior" }
        if ($leaveActual.AttributeType -eq 'Picklist') {
            $leaveTyped = Invoke-LeaveMetadata "/api/data/v9.2/EntityDefinitions(LogicalName='$leaveLogical')/Attributes(LogicalName='$($leaveActual.LogicalName)')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$expand=OptionSet"
            $leaveExpectedLabels = @($leaveExpected.OptionSet.Options | ForEach-Object { $_.Label.LocalizedLabels[0].Label })
            $leaveActualLabels = @($leaveTyped.OptionSet.Options | ForEach-Object { @($_.Label.LocalizedLabels | Where-Object { $_.LanguageCode -eq 1033 })[0].Label })
            Assert-LeaveEqual ($leaveActualLabels -join '|') ($leaveExpectedLabels -join '|') "$leaveLogical.$($leaveActual.LogicalName) choices"
            foreach ($leaveOption in $leaveTyped.OptionSet.Options) {
                if ([Math]::Floor($leaveOption.Value / 10000) -ne $leavePublisher.customizationoptionvalueprefix) { throw 'Choice integer does not use the solution publisher allocation.' }
            }
            $leaveExpectedDefault = @($leaveDefaults | Where-Object { $_.Table -ceq $leaveLogical -and $_.Column -ceq $leaveActual.LogicalName })
            if ($leaveExpectedDefault.Count -eq 1) {
                $leaveDefaultOption = @($leaveTyped.OptionSet.Options | Where-Object { @($_.Label.LocalizedLabels | Where-Object { $_.LanguageCode -eq 1033 -and $_.Label -ceq $leaveExpectedDefault[0].Label }).Count -eq 1 })
                Assert-LeaveEqual $leaveTyped.DefaultFormValue $leaveDefaultOption[0].Value "$leaveLogical.$($leaveActual.LogicalName) published default"
            }
            $leaveActual | Add-Member -NotePropertyName VerifiedOptionSet -NotePropertyValue $leaveTyped.OptionSet -Force
            $leaveActual | Add-Member -NotePropertyName VerifiedDefaultFormValue -NotePropertyValue $leaveTyped.DefaultFormValue -Force
        }
        $leaveColumns += $leaveActual
    }
    $leaveRelationships = @(Get-LeaveRelationships $leaveLogical)
    foreach ($leaveRelationshipFile in $leaveRelationshipFiles) {
        $leaveExpected = Get-Content -Raw -LiteralPath $leaveRelationshipFile.FullName | ConvertFrom-Json
        if ($leaveExpected.ReferencingEntity -cne $leaveLogical) { continue }
        $leaveActual = @($leaveRelationships | Where-Object { $_.SchemaName -ceq $leaveExpected.SchemaName })
        if ($leaveActual.Count -ne 1) { throw "Missing relationship: $($leaveExpected.SchemaName)" }
        Assert-LeaveEqual $leaveActual[0].ReferencedEntity $leaveExpected.ReferencedEntity "$($leaveExpected.SchemaName) target"
        Assert-LeaveEqual $leaveActual[0].ReferencedAttribute $leaveParentTables[$leaveExpected.ReferencedEntity].PrimaryIdAttribute "$($leaveExpected.SchemaName) primary key"
        foreach ($leaveCascade in @('Assign', 'Delete', 'Merge', 'Reparent', 'Share', 'Unshare')) {
            Assert-LeaveEqual $leaveActual[0].CascadeConfiguration.$leaveCascade $leaveExpected.CascadeConfiguration.$leaveCascade "$($leaveExpected.SchemaName) $leaveCascade behavior"
        }
        $leaveLookup = @($leaveAttributes.value | Where-Object { $_.LogicalName -ceq $leaveExpected.Lookup.SchemaName.ToLowerInvariant() })
        if ($leaveLookup.Count -ne 1) { throw 'Missing lookup column.' }
        Assert-LeaveEqual $leaveLookup[0].RequiredLevel.Value $leaveExpected.Lookup.RequiredLevel.Value "$($leaveExpected.Lookup.SchemaName) required level"
        Assert-LeaveEqual $leaveLookup[0].IsAuditEnabled.Value $true "$($leaveExpected.Lookup.SchemaName) auditing"
        Assert-LeaveEqual ($leaveLookup[0].Targets -join '|') $leaveExpected.ReferencedEntity "$($leaveExpected.Lookup.SchemaName) lookup target"
        $leaveColumns += $leaveLookup[0]
        $leaveReport.Relationships += $leaveActual[0]
    }
    $leaveTable = Get-LeaveTable $leaveLogical
    $leaveMembership = Invoke-LeaveMetadata "/api/data/v9.2/solutioncomponents?`$select=objectid,componenttype&`$filter=_solutionid_value eq $($leaveSolutionRow.solutionid) and componenttype eq 1 and objectid eq $($leaveTable.MetadataId)"
    if (@($leaveMembership.value).Count -lt 1) { throw "Table is not in the intended solution: $leaveLogical" }
    $leaveCount = Invoke-LeaveMetadata "/api/data/v9.2/$($leaveTable.EntitySetName)?`$select=$($leaveTable.PrimaryIdAttribute)&`$count=true&`$top=1"
    $leaveReport.Tables += [ordered]@{ Metadata = $leaveTable; Columns = $leaveColumns; RecordCount = $leaveCount.'@odata.count'; InSolution = $true }
    Write-Host "PASS: $leaveLogical; $($leaveColumns.Count) specified columns; $($leaveCount.'@odata.count') records; solution membership verified"
}
if ($leaveReport.Relationships.Count -ne 9) { throw 'Expected nine verified business relationships.' }
Save-LeaveJson (Join-Path $leaveRoot 'docs/leave-schema-verification.json') $leaveReport
Write-Host 'Stage 1 verified. Evidence: docs/leave-schema-verification.json. Stage 2 keys remain pending.'
