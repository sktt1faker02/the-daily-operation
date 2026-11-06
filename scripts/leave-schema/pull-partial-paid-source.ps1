param(
    [string]$NativeFolder = '.work/partial-paid/native',
    [string]$EvidenceFile = 'docs/partial-paid-leave-verification.json',
    [string]$AssemblyVersion = '1.0.3.2'
)
# Copy only native Leave metadata and verified assembly references into source.
$ErrorActionPreference = 'Stop'
$splitRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$splitNative = Join-Path $PSScriptRoot $NativeFolder
$splitSource = Join-Path $splitRoot 'solution/A365_DailyOperations/src'
$splitEvidence = Get-Content -Raw -LiteralPath (Join-Path $splitRoot $EvidenceFile) | ConvertFrom-Json
if ($splitEvidence.Environment -cne 'https://org9a7651f0.crm5.dynamics.com' -or $splitEvidence.AssemblyVersion -cne $AssemblyVersion) { throw 'Verified Dev release required.' }
function Split-SaveXml([xml]$Document, [string]$Path) {
    $splitSettings = New-Object Xml.XmlWriterSettings
    $splitSettings.Indent = $true
    $splitSettings.Encoding = New-Object Text.UTF8Encoding($false)
    $splitWriter = [Xml.XmlWriter]::Create($Path, $splitSettings)
    try { $Document.Save($splitWriter) } finally { $splitWriter.Dispose() }
}
$splitEntityPath = Join-Path $splitSource 'Entities/a365_Leave/Entity.xml'
[xml]$splitEntity = [IO.File]::ReadAllText($splitEntityPath)
[xml]$splitNativeEntity = [IO.File]::ReadAllText((Join-Path $splitNative 'Entities/a365_Leave/Entity.xml'))
$splitAttributes = $splitEntity.SelectSingleNode('//EntityInfo/entity/attributes')
foreach ($splitColumn in @('a365_Benefit','a365_PaidDays','a365_UnpaidDays','a365_AllocationJson')) {
    $splitNew = $splitNativeEntity.SelectSingleNode("//attributes/attribute[@PhysicalName='$splitColumn']")
    if (-not $splitNew) { throw "Native metadata missing: $splitColumn" }
    $splitOld = $splitAttributes.SelectSingleNode("attribute[@PhysicalName='$splitColumn']")
    $splitImported = $splitEntity.ImportNode($splitNew, $true)
    if ($splitOld) { $splitAttributes.ReplaceChild($splitImported, $splitOld) | Out-Null }
    else { $splitAttributes.AppendChild($splitImported) | Out-Null }
}
Split-SaveXml $splitEntity $splitEntityPath
$splitAssemblyPath = 'PluginAssemblies/A365LeavePlugins-1D8034C7-E2CD-F111-A05A-000D3A8014E4'
$splitNativeDll = Join-Path $splitNative "$splitAssemblyPath/A365LeavePlugins.dll"
if ((Get-FileHash -LiteralPath $splitNativeDll).Hash -cne $splitEvidence.SHA256) { throw 'Native assembly differs from the verified deployed assembly.' }
foreach ($splitFile in Get-ChildItem -LiteralPath (Join-Path $splitNative $splitAssemblyPath) -File) {
    Copy-Item -LiteralPath $splitFile.FullName -Destination (Join-Path $splitSource "$splitAssemblyPath/$($splitFile.Name)")
}
foreach ($splitFile in Get-ChildItem -LiteralPath (Join-Path $splitNative 'SdkMessageProcessingSteps') -Filter '*.xml') {
    if ((Get-Content -Raw -LiteralPath $splitFile.FullName) -notmatch 'A365\.Leave\.Plugins\.') { continue }
    $splitDestination = Join-Path $splitSource "SdkMessageProcessingSteps/$($splitFile.Name)"
    if (-not (Test-Path -LiteralPath $splitDestination)) { throw 'Unexpected new registration; review before source sync.' }
    Copy-Item -LiteralPath $splitFile.FullName -Destination $splitDestination
}
$splitManifestPath = Join-Path $splitSource 'Other/Solution.xml'
[xml]$splitManifest = [IO.File]::ReadAllText($splitManifestPath)
[xml]$splitNativeManifest = [IO.File]::ReadAllText((Join-Path $splitNative 'Other/Solution.xml'))
$splitNativeRoot = $splitNativeManifest.SelectSingleNode('//RootComponent[@type="91" and @id="{1d8034c7-e2cd-f111-a05a-000d3a8014e4}"]')
$splitOldRoot = $splitManifest.SelectSingleNode('//RootComponent[@type="91" and @id="{1d8034c7-e2cd-f111-a05a-000d3a8014e4}"]')
if (-not $splitNativeRoot -or -not $splitOldRoot) { throw 'Expected existing Leave assembly root component.' }
$splitOldRoot.ParentNode.ReplaceChild($splitManifest.ImportNode($splitNativeRoot, $true), $splitOldRoot) | Out-Null
Split-SaveXml $splitManifest $splitManifestPath
Write-Host 'Synced four native Leave attribute definitions and the verified Leave assembly/registration references. Unrelated source and roles preserved.'
