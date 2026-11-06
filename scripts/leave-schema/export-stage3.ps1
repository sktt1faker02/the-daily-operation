param([switch]$UnpackOnly)

# Read-only export of the existing solution after the authorized role grants.
# Local unpack is separate to avoid a Windows ZIP file-lock race.
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leavePac = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/pac.cmd'
$leaveWork = Join-Path $PSScriptRoot '.work'
$leaveZip = Join-Path $leaveWork 'A365_DailyOperations-leave-stage3-unmanaged.zip'
$leaveUnpack = Join-Path $leaveWork 'unpacked-stage3'
$leaveGrant = Get-Content -Raw -LiteralPath (Join-Path $leaveRoot 'docs/leave-permission-grant.json') | ConvertFrom-Json
if (-not $leaveGrant.Verified -or $leaveGrant.Environment -cne 'https://org9a7651f0.crm5.dynamics.com') { throw 'Verified permission-grant evidence required.' }
if ($UnpackOnly) {
    if (-not (Test-Path -LiteralPath $leaveZip) -or (Test-Path -LiteralPath $leaveUnpack)) { throw 'Export first; do not overwrite an existing unpack.' }
    & $leavePac solution unpack --zipfile $leaveZip --folder $leaveUnpack --packagetype Unmanaged
    if ($LASTEXITCODE -ne 0) { throw 'Stage 3 unpack failed.' }
} else {
    if (Test-Path -LiteralPath $leaveZip) { throw 'Existing export found; inspect before replacing.' }
    & $leavePac solution export --environment https://org9a7651f0.crm5.dynamics.com --name A365_DailyOperations --path $leaveZip --managed false
    if ($LASTEXITCODE -ne 0) { throw 'Stage 3 export failed.' }
}
