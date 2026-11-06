# Pull only the 14 approved, actually exported privilege nodes into the
# existing role definition. Preserve unrelated role-source differences.
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leaveGrant = Get-Content -Raw -LiteralPath (Join-Path $leaveRoot 'docs/leave-permission-grant.json') | ConvertFrom-Json
if (-not $leaveGrant.Verified -or $leaveGrant.RoleId -cne '6217c17c-3ea8-f111-aaad-000d3a853079') { throw 'Verified approved role grant required.' }
$leaveRolePath = Join-Path $leaveRoot 'solution/A365_DailyOperations/src/Roles/A365 - Payroll Admin.xml'
$leaveExportPath = Join-Path $PSScriptRoot '.work/unpacked-stage3/Roles/A365 - Payroll Admin.xml'
$leaveCurrent = New-Object Xml.XmlDocument
$leaveCurrent.Load($leaveRolePath)
$leaveExport = New-Object Xml.XmlDocument
$leaveExport.Load($leaveExportPath)
if ($leaveCurrent.Role.id -cne $leaveExport.Role.id -or $leaveCurrent.Role.name -cne 'A365 - Payroll Admin') { throw 'Unexpected role source identity.' }
$leaveBeforeNodes = @($leaveCurrent.Role.RolePrivileges.RolePrivilege | ForEach-Object { $_.OuterXml })
$leaveAdded = 0
foreach ($leavePrivilege in $leaveGrant.ApprovedPrivileges) {
    $leaveExportNode = @($leaveExport.Role.RolePrivileges.RolePrivilege | Where-Object name -ceq $leavePrivilege.PrivilegeName)
    if ($leaveExportNode.Count -ne 1 -or $leaveExportNode[0].level -cne 'Global') { throw 'Approved privilege absent from the live solution export.' }
    $leaveExisting = @($leaveCurrent.Role.RolePrivileges.RolePrivilege | Where-Object name -ceq $leavePrivilege.PrivilegeName)
    if ($leaveExisting.Count) {
        if ($leaveExisting.Count -ne 1 -or $leaveExisting[0].level -cne 'Global') { throw 'Existing role source contains a conflicting privilege; inspect before changing.' }
    } else {
        $leaveCurrent.Role.RolePrivileges.AppendChild($leaveCurrent.ImportNode($leaveExportNode[0], $true)) | Out-Null
        $leaveAdded++
    }
}
foreach ($leaveBeforeNode in $leaveBeforeNodes) {
    if (@($leaveCurrent.Role.RolePrivileges.RolePrivilege | Where-Object OuterXml -ceq $leaveBeforeNode).Count -ne 1) { throw 'An unrelated role-source privilege changed.' }
}
if ($leaveAdded) {
    $leaveSettings = New-Object Xml.XmlWriterSettings
    $leaveSettings.Indent = $true; $leaveSettings.IndentChars = '  '; $leaveSettings.NewLineChars = "`r`n"
    $leaveSettings.Encoding = New-Object Text.UTF8Encoding($false)
    $leaveWriter = [Xml.XmlWriter]::Create($leaveRolePath, $leaveSettings)
    try { $leaveCurrent.Save($leaveWriter) } finally { $leaveWriter.Dispose() }
}
Write-Host "Pulled $leaveAdded approved exported role nodes; unrelated source privileges preserved."
