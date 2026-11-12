# Read-only export and local source pull. Does not import, publish or change Dataverse.
$ErrorActionPreference = 'Stop'
$leaveProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leavePac = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/pac.cmd'
$leaveExportFolder = Join-Path $PSScriptRoot '.work'
$leaveExportZip = Join-Path $leaveExportFolder 'A365_DailyOperations-leave-stage1-unmanaged.zip'
$leaveUnpackFolder = Join-Path $leaveExportFolder 'unpacked'
$leaveSourceRoot = Join-Path $leaveProject 'solution/A365_DailyOperations/src'
$leaveEvidencePath = Join-Path $leaveProject 'docs/leave-schema-verification.json'
if (-not (Test-Path -LiteralPath $leaveEvidencePath)) { throw 'Complete Stage 1 verification before exporting.' }
$leaveEvidence = Get-Content -Raw -LiteralPath $leaveEvidencePath | ConvertFrom-Json
if ($leaveEvidence.Environment -cne 'https://org9a7651f0.crm5.dynamics.com' -or $leaveEvidence.Solution -cne 'A365_DailyOperations') { throw 'Unexpected verification target.' }
New-Item -ItemType Directory -Force -Path $leaveExportFolder | Out-Null

if (-not (Test-Path -LiteralPath $leaveExportZip)) {
    & $leavePac solution export --environment https://org9a7651f0.crm5.dynamics.com --name A365_DailyOperations --path $leaveExportZip --managed false
    if ($LASTEXITCODE -ne 0) { throw 'Solution export failed.' }
}
# Separate CLI calls avoid a Windows ZIP file-lock race.
if (-not (Test-Path -LiteralPath $leaveUnpackFolder)) {
    & $leavePac solution unpack --zipfile $leaveExportZip --folder $leaveUnpackFolder --packagetype Unmanaged
    if ($LASTEXITCODE -ne 0) { throw 'Solution unpack failed.' }
}

$leaveLogicalNames = @($leaveEvidence.Tables | ForEach-Object { $_.Metadata.LogicalName })
if ($leaveLogicalNames.Count -ne 3) { throw 'Expected exactly three verified tables.' }
foreach ($leaveTable in $leaveEvidence.Tables) {
    $leaveSchema = $leaveTable.Metadata.SchemaName
    $leaveExportedEntity = [IO.Path]::GetFullPath((Join-Path $leaveUnpackFolder "Entities/$leaveSchema"))
    $leaveTargetEntity = [IO.Path]::GetFullPath((Join-Path $leaveSourceRoot "Entities/$leaveSchema"))
    if (-not $leaveTargetEntity.StartsWith([IO.Path]::GetFullPath($leaveSourceRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Entity destination is outside solution source.' }
    if (-not (Test-Path -LiteralPath $leaveExportedEntity)) { throw "New table is absent from the exported solution: $leaveSchema" }
    if (Test-Path -LiteralPath $leaveTargetEntity) { throw "Entity source already exists; review before replacing: $leaveTargetEntity" }
    Copy-Item -LiteralPath $leaveExportedEntity -Destination $leaveTargetEntity -Recurse
    Write-Host "Pulled generated entity source: $leaveSchema"
}

function Read-LeaveSourceXml {
    param([string]$Path)
    $leaveXml = New-Object Xml.XmlDocument
    $leaveXml.Load($Path)
    return ,$leaveXml
}

function Save-LeaveSourceXml {
    param([Xml.XmlDocument]$Document, [string]$Path)
    $leaveSettings = New-Object Xml.XmlWriterSettings
    $leaveSettings.Indent = $true
    $leaveSettings.IndentChars = '  '
    $leaveSettings.NewLineChars = "`r`n"
    $leaveSettings.Encoding = New-Object Text.UTF8Encoding($false)
    $leaveWriter = [Xml.XmlWriter]::Create($Path, $leaveSettings)
    try { $Document.Save($leaveWriter) } finally { $leaveWriter.Dispose() }
}

# Copy actual exported relationship nodes involving the new tables. Preserve
# existing relationship definitions for Payroll and all unrelated components.
$leaveImportedRelationshipNames = @()
foreach ($leaveRelationshipFile in Get-ChildItem -LiteralPath (Join-Path $leaveUnpackFolder 'Other/Relationships') -Filter '*.xml') {
    $leaveExportedRelationships = Read-LeaveSourceXml $leaveRelationshipFile.FullName
    $leaveSelected = @($leaveExportedRelationships.EntityRelationships.EntityRelationship | Where-Object {
        $leaveLogicalNames -contains ([string]$_.ReferencingEntityName).ToLowerInvariant() -or
        $leaveLogicalNames -contains ([string]$_.ReferencedEntityName).ToLowerInvariant()
    })
    if (-not $leaveSelected.Count) { continue }
    $leaveDestination = Join-Path $leaveSourceRoot "Other/Relationships/$($leaveRelationshipFile.Name)"
    if (Test-Path -LiteralPath $leaveDestination) {
        $leaveTargetRelationships = Read-LeaveSourceXml $leaveDestination
    } else {
        $leaveTargetRelationships = New-Object Xml.XmlDocument
        $leaveTargetRelationships.AppendChild($leaveTargetRelationships.ImportNode($leaveExportedRelationships.DocumentElement.CloneNode($false), $true)) | Out-Null
    }
    foreach ($leaveRelationship in $leaveSelected) {
        $leaveName = [string]$leaveRelationship.Name
        if ($leaveTargetRelationships.SelectSingleNode("/EntityRelationships/EntityRelationship[@Name='$leaveName']")) { throw "Relationship source already exists; inspect before replacing: $leaveName" }
        $leaveTargetRelationships.DocumentElement.AppendChild($leaveTargetRelationships.ImportNode($leaveRelationship, $true)) | Out-Null
        $leaveImportedRelationshipNames += $leaveName
    }
    Save-LeaveSourceXml $leaveTargetRelationships $leaveDestination
}

# Add corresponding exported index/manifest nodes; do not invent solution XML.
$leaveExportedIndex = Read-LeaveSourceXml (Join-Path $leaveUnpackFolder 'Other/Relationships.xml')
$leaveIndexPath = Join-Path $leaveSourceRoot 'Other/Relationships.xml'
$leaveTargetIndex = Read-LeaveSourceXml $leaveIndexPath
foreach ($leaveRelationshipName in $leaveImportedRelationshipNames) {
    if ($leaveTargetIndex.SelectSingleNode("/EntityRelationships/EntityRelationship[@Name='$leaveRelationshipName']")) { throw 'Relationship index already contains a newly pulled entry.' }
    $leaveNode = $leaveExportedIndex.SelectSingleNode("/EntityRelationships/EntityRelationship[@Name='$leaveRelationshipName']")
    if (-not $leaveNode) { throw "Exported index is missing $leaveRelationshipName" }
    $leaveTargetIndex.DocumentElement.AppendChild($leaveTargetIndex.ImportNode($leaveNode, $true)) | Out-Null
}
Save-LeaveSourceXml $leaveTargetIndex $leaveIndexPath

$leaveExportedManifest = Read-LeaveSourceXml (Join-Path $leaveUnpackFolder 'Other/Solution.xml')
$leaveManifestPath = Join-Path $leaveSourceRoot 'Other/Solution.xml'
$leaveTargetManifest = Read-LeaveSourceXml $leaveManifestPath
$leaveManifestRoot = $leaveTargetManifest.SelectSingleNode('/ImportExportXml/SolutionManifest/RootComponents')
foreach ($leaveLogical in $leaveLogicalNames) {
    $leaveNode = $leaveExportedManifest.SelectSingleNode("/ImportExportXml/SolutionManifest/RootComponents/RootComponent[@type='1' and @schemaName='$leaveLogical']")
    if (-not $leaveNode) { throw "Exported solution manifest is missing $leaveLogical" }
    if ($leaveTargetManifest.SelectSingleNode("/ImportExportXml/SolutionManifest/RootComponents/RootComponent[@type='1' and @schemaName='$leaveLogical']")) { throw 'New table already exists in local manifest; review before replacing.' }
    $leaveManifestRoot.AppendChild($leaveTargetManifest.ImportNode($leaveNode, $true)) | Out-Null
}
Save-LeaveSourceXml $leaveTargetManifest $leaveManifestPath

Write-Host "Pulled three entities and $($leaveImportedRelationshipNames.Count) business/platform relationships from the real Dataverse export."
Write-Host "Unmanaged export retained at: $leaveExportZip"
Write-Host 'No commits, pushes, imports or deployments were performed.'
