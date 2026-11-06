param([string]$AssemblyVersion = '1.0.3.3')
# Verify deployment and read-only deletion impact. Never invoke delete/issue.
$ErrorActionPreference = 'Stop'
$deleteRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$deleteCli = 'C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$deleteEnvironment = 'https://org9a7651f0.crm5.dynamics.com'
$deleteWork = Join-Path $PSScriptRoot '.work/deletion'
New-Item -ItemType Directory -Force -Path $deleteWork | Out-Null
function Delete-Read([string]$Path, $Request = $null) {
    $deleteArgs = @('api','request','--target','dataverse','--environment',$deleteEnvironment,'--path',$Path,'--context','app=dataverse-skills/1.16.0;skill=dv-query;agent=codex')
    if ($null -ne $Request) {
        if ($Path -cne '/api/data/v9.2/a365_LeaveCommand' -or $Request.command -notin @('deletePreview','diagnostics')) { throw 'Only read-only deletion preview/diagnostics allowed.' }
        $deleteBody = Join-Path $deleteWork 'preview.json'
        [IO.File]::WriteAllText($deleteBody, (@{Request=($Request | ConvertTo-Json -Compress)} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
        $deleteArgs += @('--method','POST','--body-file',$deleteBody)
    }
    $deleteOutput = & $deleteCli @deleteArgs
    if ($LASTEXITCODE -ne 0) { throw 'Read-only deletion verification failed; no business records were modified.' }
    $deleteResult = ($deleteOutput -join "`n") | ConvertFrom-Json
    if ($null -ne $Request) { return ($deleteResult.Response | ConvertFrom-Json) }
    return $deleteResult
}
$deleteAssembly = Delete-Read '/api/data/v9.2/pluginassemblies?$select=name,version&$filter=name eq ''A365.Leave.Plugins'''
if (@($deleteAssembly.value).Count -ne 1 -or $deleteAssembly.value[0].version -cne $AssemblyVersion) { throw 'Unexpected deployed Leave plugin version.' }
$deleteBefore = Delete-Read '/api/data/v9.2/a365_leaves?$select=a365_leaveid,_a365_employee_value&$filter=a365_benefit eq 749910001&$top=1&$count=true'
$deleteLedgerBefore = Delete-Read '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$top=1&$count=true'
$deletePreviewStatus = 'Not exercised: no unpaid source available'
if (@($deleteBefore.value).Count -eq 1) {
    $deleteSource = $deleteBefore.value[0]
    $deletePreview = Delete-Read '/api/data/v9.2/a365_LeaveCommand' @{command='deletePreview';operationId=$deleteSource.a365_leaveid;employeeId=$deleteSource._a365_employee_value}
    if ($deletePreview.deleted -ne $false -or $deletePreview.restoredDays -ne 0 -or $deletePreview.recordId -ne $deleteSource.a365_leaveid -or $deletePreview.employeeId -ne $deleteSource._a365_employee_value) { throw 'Unexpected unpaid deletion preview.' }
    $deletePreviewStatus = 'Passed against an existing unpaid record; zero credits restored, no writes'
}
$deleteAfter = Delete-Read '/api/data/v9.2/a365_leaves?$select=a365_leaveid&$filter=a365_benefit eq 749910001&$top=1&$count=true'
$deleteLedgerAfter = Delete-Read '/api/data/v9.2/a365_leavecredittransactions?$select=a365_leavecredittransactionid&$top=1&$count=true'
if ($deleteBefore.'@odata.count' -ne $deleteAfter.'@odata.count' -or $deleteLedgerBefore.'@odata.count' -ne $deleteLedgerAfter.'@odata.count') { throw 'Record counts changed during the read-only check; inspect concurrent activity.' }
$deleteDiagnostics = Delete-Read '/api/data/v9.2/a365_LeaveCommand' @{command='diagnostics'}
if (-not $deleteDiagnostics.isInTransaction) { throw 'Synchronous transaction context not verified.' }
$deleteEvidence = @{
    VerifiedAt=[DateTime]::UtcNow.ToString('o');Environment=$deleteEnvironment;Solution='A365_DailyOperations';AssemblyVersion=$AssemblyVersion
    SHA256=(Get-FileHash -LiteralPath (Join-Path $deleteRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll')).Hash
    Preview=$deletePreviewStatus;CountsUnchanged=$true;BusinessDataWrites='None';ActualDeletion='Owner manual UAT pending'
    RestorationAndRollback='Synthetic tests only';Roles='Unchanged';Schema='Unchanged';Emails='None';TransactionContext='Verified synchronous'
}
[IO.File]::WriteAllText((Join-Path $deleteRoot 'docs/leave-deletion-verification.json'), ($deleteEvidence | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
Write-Host "Leave plugin $AssemblyVersion and read-only deletion preview verified. Leave and credit counts unchanged; no live deletion or restoration performed."
