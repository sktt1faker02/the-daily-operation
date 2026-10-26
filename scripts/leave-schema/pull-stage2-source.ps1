# Local-only pull of the actual exported ledger Entity.xml. No Dataverse writes.
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leaveSource = Join-Path $PSScriptRoot '.work/unpacked-stage2/Entities/a365_LeaveCreditTransaction/Entity.xml'
$leaveDestination = Join-Path $leaveRoot 'solution/A365_DailyOperations/src/Entities/a365_LeaveCreditTransaction/Entity.xml'
$leaveEvidence = Get-Content -Raw -LiteralPath (Join-Path $leaveRoot 'docs/leave-schema-stage2-verification.json') | ConvertFrom-Json
if (-not $leaveEvidence.Completed -or $leaveEvidence.Environment -cne 'https://org9a7651f0.crm5.dynamics.com') { throw 'Verified Stage 2 evidence required.' }
$leaveExportXml = New-Object Xml.XmlDocument
$leaveExportXml.Load($leaveSource)
$leaveExistingXml = New-Object Xml.XmlDocument
$leaveExistingXml.Load($leaveDestination)
$leaveKeyNodes = @($leaveExportXml.SelectNodes('//EntityKeys/EntityKey'))
if ($leaveKeyNodes.Count -ne 2) { throw 'Expected exactly two exported ledger keys.' }
foreach ($leaveKey in $leaveEvidence.AlternateKeys) {
    if ($leaveKey.EntityKeyIndexStatus -ne 'Active') { throw 'A key is not Active in the saved evidence.' }
    $leaveNode = @($leaveKeyNodes | Where-Object { $_.Name -ceq $leaveKey.SchemaName })
    if ($leaveNode.Count -ne 1) { throw 'Exported key name does not match verified metadata.' }
    $leaveAttributes = @($leaveNode[0].EntityKeyAttributes.AttributeName | Sort-Object) -join ','
    if ($leaveAttributes -cne (@($leaveKey.KeyAttributes | Sort-Object) -join ',')) { throw 'Exported key columns differ from verified metadata.' }
}
# Compare everything except key definitions before replacing a generated file.
# Stop if this would overwrite any unrelated table customization.
$leaveExportComparison = $leaveExportXml.CloneNode($true)
$leaveExistingComparison = $leaveExistingXml.CloneNode($true)
foreach ($leaveDocument in @($leaveExportComparison, $leaveExistingComparison)) {
    foreach ($leaveKeysNode in @($leaveDocument.SelectNodes('//EntityKeys'))) { $leaveKeysNode.ParentNode.RemoveChild($leaveKeysNode) | Out-Null }
}
if ($leaveExportComparison.OuterXml -cne $leaveExistingComparison.OuterXml) { throw 'Non-key table differences found. Review before pulling source.' }
if ((Get-FileHash -LiteralPath $leaveSource).Hash -eq (Get-FileHash -LiteralPath $leaveDestination).Hash) {
    Write-Host 'Ledger source already matches the verified Stage 2 export.'
    return
}
Copy-Item -LiteralPath $leaveSource -Destination $leaveDestination -Force
Write-Host 'Pulled actual exported ledger Entity.xml: only the two key definitions differ.'
