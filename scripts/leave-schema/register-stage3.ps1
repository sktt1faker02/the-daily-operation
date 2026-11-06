param([switch]$InspectOnly)

# Local Code App generation using Microsoft's installed CLI. Does not deploy,
# modify Dataverse schema, write business records or change security roles.
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $leaveRoot
$leaveEnvironmentId = 'b58b083e-d27d-eabd-a143-2a49dcb9d89a'
$leaveEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$leaveTables = @('a365_leave', 'a365_leavecashconversion', 'a365_leavecredittransaction')
$leaveConfiguration = Get-Content -Raw -LiteralPath 'power.config.json' | ConvertFrom-Json
if ($leaveConfiguration.environmentId -cne $leaveEnvironmentId) { throw 'Unexpected Code App environment.' }
$leaveBranch = & git branch --show-current
if ($LASTEXITCODE -ne 0 -or $leaveBranch -cne 'feature/leave-module') { throw 'Use feature/leave-module for Stage 3 generation.' }
if (-not (Test-Path -LiteralPath 'node_modules/.bin/pa.cmd')) { throw 'The local grouped Power Apps CLI is required.' }
$leaveStage2 = Get-Content -Raw -LiteralPath 'docs/leave-schema-stage2-verification.json' | ConvertFrom-Json
if (-not $leaveStage2.Completed -or $leaveStage2.Environment -cne $leaveEnvironment -or @($leaveStage2.AlternateKeys | Where-Object EntityKeyIndexStatus -eq 'Active').Count -ne 2) { throw 'Stage 2 Active-key evidence is required.' }
foreach ($leaveTable in $leaveTables) {
    Write-Host "Reviewed command: npx --no-install pa app add data-source --connector dataverse --table $leaveTable --org-url $leaveEnvironment --non-interactive"
}
if ($InspectOnly) { Write-Host 'Stage 3 local preflight passed; no data sources generated.'; return }

$leavePermissions = Get-Content -Raw -LiteralPath 'docs/leave-permissions-verification.json' | ConvertFrom-Json
if ($leavePermissions.Environment -cne $leaveEnvironment -or -not $leavePermissions.ConfigurationMatchesPlan) { throw 'Successful permission verification is required before registration.' }

$leaveSnapshot = Join-Path $PSScriptRoot '.work/stage3-before'
if (-not (Test-Path -LiteralPath $leaveSnapshot)) {
    New-Item -ItemType Directory -Path $leaveSnapshot | Out-Null
    Copy-Item -LiteralPath 'power.config.json' -Destination $leaveSnapshot
    Copy-Item -LiteralPath 'src/generated' -Destination (Join-Path $leaveSnapshot 'generated') -Recurse
    Copy-Item -LiteralPath '.power/schemas' -Destination (Join-Path $leaveSnapshot 'schemas') -Recurse
}
foreach ($leaveTable in $leaveTables) {
    # Inspect current registration before retrying an interrupted operation.
    $leaveConfiguration = Get-Content -Raw -LiteralPath 'power.config.json' | ConvertFrom-Json
    $leaveMatches = @($leaveConfiguration.databaseReferences.'default.cds'.dataSources.PSObject.Properties | Where-Object { $_.Value.logicalName -ceq $leaveTable })
    if ($leaveMatches.Count -gt 1) { throw "Duplicate data sources for $leaveTable; inspect before continuing." }
    if ($leaveMatches.Count -eq 1) {
        Write-Host "Already registered; verify generated artifacts: $leaveTable"
        continue
    }
    & npx.cmd --no-install pa app add data-source --connector dataverse --table $leaveTable --org-url $leaveEnvironment --non-interactive
    if ($LASTEXITCODE -ne 0) { throw "Supported CLI generation failed for $leaveTable. Inspect registration before retrying." }
    $leaveConfiguration = Get-Content -Raw -LiteralPath 'power.config.json' | ConvertFrom-Json
    $leaveMatches = @($leaveConfiguration.databaseReferences.'default.cds'.dataSources.PSObject.Properties | Where-Object { $_.Value.logicalName -ceq $leaveTable })
    if ($leaveMatches.Count -ne 1) { throw "CLI did not register exactly one source for $leaveTable." }
}
Write-Host 'Three Leave sources are registered locally. Verify schemas/models/services and run lint/build before handoff.'
