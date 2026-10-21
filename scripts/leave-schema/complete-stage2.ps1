param([switch]$InspectOnly, [switch]$VerifyOnly, [switch]$KeyStatusOnly)

# First-party CLI orchestration for PLANS.md Stage 2. The only allowed writes
# are the two reviewed ledger key definitions. No record/role/settings writes.
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leaveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$leaveEnvironmentId = 'b58b083e-d27d-eabd-a143-2a49dcb9d89a'
$leaveSolution = 'A365_DailyOperations'
$leaveCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveKeyPath = "/api/data/v9.2/EntityDefinitions(LogicalName='a365_leavecredittransaction')/Keys"
$leaveContext = 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex'
$leaveEvidencePath = Join-Path $leaveRoot 'docs/leave-schema-stage2-verification.json'

function Assert-LeaveEqual {
    param($Actual, $Expected, [string]$Description)
    if ($Actual -cne $Expected) { throw "Verification failed: $Description. Expected '$Expected'; received '$Actual'." }
}
function Invoke-LeaveMetadata {
    param([string]$Path, [string]$Method = 'GET', [string]$BodyFile)
    if ($Method -notin @('GET', 'POST')) { throw 'Stage 2 only supports GET and key creation.' }
    if ($Method -eq 'GET') {
        if ($Path -notmatch '^/api/data/v9\.2/(EntityDefinitions|solutions\?|publishers\(|solutioncomponents\?|a365_(leave|leavecashconversion|leavecredittransaction)s\?)') { throw 'Read outside the Stage 2 allowlist.' }
    } else {
        if ($InspectOnly -or $VerifyOnly -or $KeyStatusOnly) { throw 'Read-only mode prohibits metadata writes.' }
        if ($Path -cne $leaveKeyPath -or -not $BodyFile) { throw 'Only reviewed ledger keys may be created.' }
        $leavePayload = Get-Content -Raw -LiteralPath $BodyFile | ConvertFrom-Json
        $leaveExpectedColumn = switch ($leavePayload.SchemaName) {
            'a365_EmployeePeriodKey' { 'a365_periodkey' }
            'a365_EmployeeTransactionKey' { 'a365_transactionkey' }
            default { throw 'Unapproved key name.' }
        }
        Assert-LeaveEqual (@($leavePayload.KeyAttributes | Sort-Object) -join ',') (@('a365_employee', $leaveExpectedColumn) -join ',') 'Key payload columns'
        Assert-LeaveEqual $leavePayload.'@odata.type' 'Microsoft.Dynamics.CRM.EntityKeyMetadata' 'Metadata payload type'
    }
    $leaveArguments = @('api', 'request', '--target', 'dataverse', '--environment', $leaveEnvironment,
        '--path', $Path, '--method', $Method, '--context', $leaveContext)
    if ($Method -eq 'POST') { $leaveArguments += @('--header', "MSCRM.SolutionUniqueName:$leaveSolution", '--body-file', $BodyFile) }
    $leaveOutput = & $leaveCli @leaveArguments
    if ($LASTEXITCODE -ne 0) { throw "Dataverse CLI failed ($Method $Path). Check existing metadata before retrying." }
    if ($leaveOutput) { return (($leaveOutput -join "`n") | ConvertFrom-Json) }
}
function Get-LeaveKeys {
    $leaveResult = Invoke-LeaveMetadata ($leaveKeyPath + '?$select=MetadataId,SchemaName,LogicalName,KeyAttributes,EntityKeyIndexStatus,AsyncJob,IsManaged')
    return @($leaveResult.value)
}
function Get-LeaveMatchingKey {
    param($Keys, [string[]]$Columns)
    return @($Keys | Where-Object { (@($_.KeyAttributes | Sort-Object) -join ',') -ceq (@($Columns | Sort-Object) -join ',') })
}
function Save-LeaveEvidence {
    [IO.File]::WriteAllText($leaveEvidencePath, ($leaveReport | ConvertTo-Json -Depth 35), (New-Object Text.UTF8Encoding($false)))
}

Set-Location -LiteralPath $leaveRoot
if (-not (Test-Path -LiteralPath $leaveCli)) { throw 'Installed Microsoft Dataverse CLI not found.' }
$leaveStage1 = Get-Content -Raw -LiteralPath 'docs/leave-schema-verification.json' | ConvertFrom-Json
Assert-LeaveEqual $leaveStage1.Environment $leaveEnvironment 'Stage 1 evidence target'
Assert-LeaveEqual $leaveStage1.Solution $leaveSolution 'Stage 1 solution'
$leaveApp = Get-Content -Raw -LiteralPath 'power.config.json' | ConvertFrom-Json
Assert-LeaveEqual $leaveApp.environmentId $leaveEnvironmentId 'Code App environment'
$leaveOrgOutput = & $leaveCli org who --environment $leaveEnvironment --json
if ($LASTEXITCODE -ne 0) { throw 'Unable to verify the active environment.' }
$leaveOrg = ($leaveOrgOutput -join "`n") | ConvertFrom-Json
Assert-LeaveEqual $leaveOrg.EnvironmentId $leaveEnvironmentId 'Dataverse environment'
$leaveSolutions = Invoke-LeaveMetadata "/api/data/v9.2/solutions?`$select=solutionid,uniquename,ismanaged,_publisherid_value&`$filter=uniquename eq '$leaveSolution'"
if (@($leaveSolutions.value).Count -ne 1) { throw 'Expected exactly one existing solution.' }
$leaveSolutionRow = $leaveSolutions.value[0]
Assert-LeaveEqual $leaveSolutionRow.ismanaged $false 'Unmanaged solution'
$leavePublisher = Invoke-LeaveMetadata "/api/data/v9.2/publishers($($leaveSolutionRow._publisherid_value))?`$select=uniquename,customizationprefix,customizationoptionvalueprefix"
Assert-LeaveEqual $leavePublisher.customizationprefix 'a365' 'Publisher prefix'
Write-Host "Verified target: $($leaveOrg.FriendlyName); solution: $leaveSolution; prefix: a365"
if ($KeyStatusOnly) {
    @(Get-LeaveKeys) | Select-Object MetadataId, SchemaName, KeyAttributes, EntityKeyIndexStatus, AsyncJob | ConvertTo-Json -Depth 5
    return
}

$leaveTables = @{}
foreach ($leaveLogical in @('a365_employee', 'systemuser', 'a365_leave', 'a365_leavecashconversion', 'a365_leavecredittransaction')) {
    $leaveTable = Invoke-LeaveMetadata "/api/data/v9.2/EntityDefinitions(LogicalName='$leaveLogical')?`$select=MetadataId,LogicalName,SchemaName,PrimaryIdAttribute,EntitySetName"
    $leavePrimary = Invoke-LeaveMetadata "/api/data/v9.2/EntityDefinitions(LogicalName='$leaveLogical')/Attributes(LogicalName='$($leaveTable.PrimaryIdAttribute)')?`$select=AttributeType,IsPrimaryId"
    Assert-LeaveEqual $leavePrimary.AttributeType 'Uniqueidentifier' "$leaveLogical primary key type"
    Assert-LeaveEqual $leavePrimary.IsPrimaryId $true "$leaveLogical primary-ID flag"
    $leaveTables[$leaveLogical] = $leaveTable
}
Assert-LeaveEqual $leaveTables['a365_employee'].PrimaryIdAttribute 'a365_employeeid' 'Employee primary key'
Assert-LeaveEqual $leaveTables['systemuser'].PrimaryIdAttribute 'systemuserid' 'System User primary key'
$leaveCounts = @{}
foreach ($leaveLogical in @('a365_leave', 'a365_leavecashconversion', 'a365_leavecredittransaction')) {
    $leaveTable = $leaveTables[$leaveLogical]
    # Only count is retained; no business values are logged or saved.
    $leaveRows = Invoke-LeaveMetadata "/api/data/v9.2/$($leaveTable.EntitySetName)?`$select=$($leaveTable.PrimaryIdAttribute)&`$count=true&`$top=1"
    $leaveCounts[$leaveLogical] = $leaveRows.'@odata.count'
    if ($null -eq $leaveCounts[$leaveLogical]) { throw 'Dataverse did not return the record count.' }
}
if ($leaveCounts['a365_leavecredittransaction'] -ne 0 -and -not $VerifyOnly) {
    throw 'Ledger is no longer empty. Inspect duplicate counts separately before creating keys; do not change records.'
}

$leaveColumns = @()
foreach ($leaveColumnName in @('a365_employee', 'a365_periodkey', 'a365_transactionkey')) {
    $leaveColumn = Invoke-LeaveMetadata "/api/data/v9.2/EntityDefinitions(LogicalName='a365_leavecredittransaction')/Attributes(LogicalName='$leaveColumnName')"
    Assert-LeaveEqual $leaveColumn.IsSecured $false "$leaveColumnName column security"
    if ($leaveColumnName -eq 'a365_employee') {
        Assert-LeaveEqual $leaveColumn.AttributeType 'Lookup' 'Ledger Employee type'
        Assert-LeaveEqual (@($leaveColumn.Targets) -join ',') 'a365_employee' 'Ledger Employee target'
        Assert-LeaveEqual $leaveColumn.RequiredLevel.Value 'ApplicationRequired' 'Ledger Employee required level'
    } else {
        Assert-LeaveEqual $leaveColumn.AttributeType 'String' "$leaveColumnName type"
        if ($leaveColumnName -eq 'a365_periodkey') {
            Assert-LeaveEqual $leaveColumn.MaxLength 100 'Period Key maximum length'
            Assert-LeaveEqual $leaveColumn.RequiredLevel.Value 'None' 'Period Key optional level'
        } else {
            Assert-LeaveEqual $leaveColumn.MaxLength 150 'Transaction Key maximum length'
            Assert-LeaveEqual $leaveColumn.RequiredLevel.Value 'ApplicationRequired' 'Transaction Key required level'
        }
    }
    $leaveColumns += $leaveColumn
}

$leaveRelationships = @()
foreach ($leaveChild in @('a365_leave', 'a365_leavecashconversion', 'a365_leavecredittransaction')) {
    $leaveRelationshipsResult = Invoke-LeaveMetadata "/api/data/v9.2/EntityDefinitions(LogicalName='$leaveChild')/ManyToOneRelationships?`$select=SchemaName,ReferencedEntity,ReferencedAttribute,ReferencingEntity,ReferencingAttribute,ReferencingEntityNavigationPropertyName,CascadeConfiguration"
    foreach ($leaveBaseline in @($leaveStage1.Relationships | Where-Object ReferencingEntity -eq $leaveChild)) {
        $leaveMatch = @($leaveRelationshipsResult.value | Where-Object SchemaName -eq $leaveBaseline.SchemaName)
        if ($leaveMatch.Count -ne 1) { throw "Missing or duplicate relationship: $($leaveBaseline.SchemaName)" }
        $leaveRelationship = $leaveMatch[0]
        foreach ($leaveProperty in @('ReferencedEntity', 'ReferencedAttribute', 'ReferencingEntity', 'ReferencingAttribute', 'ReferencingEntityNavigationPropertyName')) {
            Assert-LeaveEqual $leaveRelationship.$leaveProperty $leaveBaseline.$leaveProperty "$($leaveBaseline.SchemaName) $leaveProperty"
        }
        Assert-LeaveEqual $leaveRelationship.ReferencedAttribute $leaveTables[$leaveRelationship.ReferencedEntity].PrimaryIdAttribute 'Referenced primary key'
        Assert-LeaveEqual $leaveRelationship.CascadeConfiguration.Delete 'Restrict' "$($leaveBaseline.SchemaName) Delete behavior"
        $leaveLookup = Invoke-LeaveMetadata "/api/data/v9.2/EntityDefinitions(LogicalName='$leaveChild')/Attributes(LogicalName='$($leaveRelationship.ReferencingAttribute)')"
        Assert-LeaveEqual $leaveLookup.AttributeType 'Lookup' "$($leaveRelationship.SchemaName) lookup type"
        Assert-LeaveEqual (@($leaveLookup.Targets) -join ',') $leaveRelationship.ReferencedEntity "$($leaveRelationship.SchemaName) lookup Targets"
        $leaveRelationships += $leaveRelationship
    }
}
Assert-LeaveEqual $leaveRelationships.Count 9 'Business relationship count'
Write-Host 'Verified all nine lookup targets, parent primary keys and Restrict Delete settings.'

$leaveKeysBefore = @(Get-LeaveKeys)
$leavePayloadFiles = @('04-employee-period-key.json', '05-employee-transaction-key.json')
foreach ($leavePayloadFile in $leavePayloadFiles) {
    $leavePayload = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot $leavePayloadFile) | ConvertFrom-Json
    $leaveMatches = @(Get-LeaveMatchingKey $leaveKeysBefore $leavePayload.KeyAttributes)
    if ($leaveMatches.Count -gt 1) { throw 'Multiple equivalent keys exist; review before continuing.' }
    $leaveSameName = @($leaveKeysBefore | Where-Object SchemaName -eq $leavePayload.SchemaName)
    if ($leaveSameName.Count -and -not $leaveMatches.Count) { throw "Key name conflicts with different columns: $($leavePayload.SchemaName)" }
    if (-not $leaveMatches.Count -and $leaveKeysBefore.Count -ge 10) { throw 'Alternate-key limit reached.' }
}
if ($InspectOnly) {
    Write-Host "Preflight passed. Ledger records: $($leaveCounts['a365_leavecredittransaction']); existing keys: $($leaveKeysBefore.Count). No Dataverse writes."
    $leaveKeysBefore | Select-Object SchemaName, KeyAttributes, EntityKeyIndexStatus | Format-Table
    return
}

$leaveReport = [ordered]@{
    VerifiedAt = [DateTime]::UtcNow.ToString('o'); Environment = $leaveEnvironment; EnvironmentId = $leaveEnvironmentId
    Solution = $leaveSolution; Publisher = $leavePublisher; Stage = 2; Completed = $false
    RecordCounts = $leaveCounts; KeyColumns = $leaveColumns; AlternateKeys = @(); Relationships = $leaveRelationships
    NullablePeriodKey = 'Optional; uniqueness is not enforced when a participating value is null. Required Employee and Transaction Key must be validated by later business operations.'
    SecurityRoles = 'Unchanged. Manual role configuration and effective-access verification remain pending.'
    RecordWrites = 'None'; EnvironmentSettings = 'Unchanged'
}
Save-LeaveEvidence
foreach ($leavePayloadFile in $leavePayloadFiles) {
    $leavePayloadPath = Join-Path $PSScriptRoot $leavePayloadFile
    $leavePayload = Get-Content -Raw -LiteralPath $leavePayloadPath | ConvertFrom-Json
    $leaveMatches = @(Get-LeaveMatchingKey @(Get-LeaveKeys) $leavePayload.KeyAttributes)
    if (-not $leaveMatches.Count) {
        if ($VerifyOnly) { throw "Missing key: $($leavePayload.SchemaName)" }
        Write-Host "Creating composite key: $($leavePayload.SchemaName)"
        Invoke-LeaveMetadata $leaveKeyPath 'POST' $leavePayloadPath | Out-Null
    }
    $leaveDeadline = [DateTime]::UtcNow.AddMinutes(3)
    do {
        $leaveCurrentKeys = @(Get-LeaveKeys)
        $leaveMatches = @(Get-LeaveMatchingKey $leaveCurrentKeys $leavePayload.KeyAttributes)
        $leaveReport.AlternateKeys = $leaveCurrentKeys
        $leaveReport.VerifiedAt = [DateTime]::UtcNow.ToString('o')
        Save-LeaveEvidence
        if ($leaveMatches.Count -gt 1) { throw 'Key is ambiguous. Inspect metadata before retrying.' }
        if ($leaveMatches.Count -eq 0) {
            if ([DateTime]::UtcNow -ge $leaveDeadline) { throw 'Key is not visible after creation. Inspect metadata before retrying.' }
            Write-Host "Waiting for created key metadata to become visible: $($leavePayload.SchemaName)"
            Start-Sleep -Seconds 5
            continue
        }
        $leaveKey = $leaveMatches[0]
        if ($leaveKey.EntityKeyIndexStatus -eq 'Active') { break }
        if ($leaveKey.EntityKeyIndexStatus -eq 'Failed') { throw "Key index failed: $($leaveKey.SchemaName). No records were changed; inspect its system job." }
        if ([DateTime]::UtcNow -ge $leaveDeadline) { throw "Key remains $($leaveKey.EntityKeyIndexStatus): $($leaveKey.SchemaName). Resume read-only verification later." }
        Write-Host "Waiting for $($leaveKey.SchemaName): $($leaveKey.EntityKeyIndexStatus)"
        Start-Sleep -Seconds 5
    } while ($true)
    Write-Host "Verified Active: $($leaveKey.SchemaName) [$($leaveKey.KeyAttributes -join ', ')]"
}
$leaveFinalDeadline = [DateTime]::UtcNow.AddMinutes(3)
do {
    $leaveReport.AlternateKeys = @(Get-LeaveKeys)
    $leaveAllActive = $true
    foreach ($leavePayloadFile in $leavePayloadFiles) {
        $leavePayload = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot $leavePayloadFile) | ConvertFrom-Json
        $leaveMatches = @(Get-LeaveMatchingKey $leaveReport.AlternateKeys $leavePayload.KeyAttributes)
        if ($leaveMatches.Count -ne 1 -or $leaveMatches[0].EntityKeyIndexStatus -ne 'Active') { $leaveAllActive = $false }
    }
    $leaveReport.VerifiedAt = [DateTime]::UtcNow.ToString('o')
    Save-LeaveEvidence
    if ($leaveAllActive) { break }
    if ([DateTime]::UtcNow -ge $leaveFinalDeadline) { throw 'Both keys are not Active in the final snapshot; inspect metadata before proceeding.' }
    Start-Sleep -Seconds 5
} while ($true)
$leaveReport.Completed = $true
$leaveReport.VerifiedAt = [DateTime]::UtcNow.ToString('o')
Save-LeaveEvidence
Write-Host 'Stage 2 verified. Business records, security roles and environment settings unchanged.'
