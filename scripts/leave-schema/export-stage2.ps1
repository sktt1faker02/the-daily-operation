param([switch]$UnpackOnly)

# Read-only Dataverse export and local unpack. Never imports or publishes.
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leavePac = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/pac.cmd'
$leaveWork = Join-Path $PSScriptRoot '.work'
$leaveZip = Join-Path $leaveWork 'A365_DailyOperations-leave-stage2-unmanaged.zip'
$leaveUnpacked = Join-Path $leaveWork 'unpacked-stage2'
$leaveEvidence = Get-Content -Raw -LiteralPath (Join-Path $leaveRoot 'docs/leave-schema-stage2-verification.json') | ConvertFrom-Json
if ($leaveEvidence.Environment -cne 'https://org9a7651f0.crm5.dynamics.com' -or $leaveEvidence.Solution -cne 'A365_DailyOperations' -or -not $leaveEvidence.Completed) { throw 'Successful Stage 2 verification is required.' }
if (@($leaveEvidence.AlternateKeys | Where-Object EntityKeyIndexStatus -eq 'Active').Count -ne 2) { throw 'Expected two Active alternate keys.' }
if ($UnpackOnly) {
    if (-not (Test-Path -LiteralPath $leaveZip)) { throw 'Export Stage 2 first.' }
    if (Test-Path -LiteralPath $leaveUnpacked) { throw 'Stage 2 unpack already exists; inspect before replacing.' }
    & $leavePac solution unpack --zipfile $leaveZip --folder $leaveUnpacked --packagetype Unmanaged
    if ($LASTEXITCODE -ne 0) { throw 'Stage 2 unpack failed.' }
} else {
    if (Test-Path -LiteralPath $leaveZip) { throw 'Stage 2 export already exists; inspect before replacing.' }
    & $leavePac solution export --environment https://org9a7651f0.crm5.dynamics.com --name A365_DailyOperations --path $leaveZip --managed false
    if ($LASTEXITCODE -ne 0) { throw 'Stage 2 export failed.' }
}
