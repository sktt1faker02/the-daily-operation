param([string]$AssemblyPath,[switch]$LegacyEvidence)
$ErrorActionPreference = 'Stop'
$leaveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leaveSdk = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
$leaveAssembly = Join-Path $leaveRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
if ($AssemblyPath) { $leaveAssembly = [IO.Path]::GetFullPath($AssemblyPath) }
[Reflection.Assembly]::LoadFrom($leaveSdk) | Out-Null
[Reflection.Assembly]::LoadFrom($leaveAssembly) | Out-Null
Add-Type -Path (Join-Path $leaveRoot 'plugins/A365.Leave.Plugins/ProtectLeaveWrites.Tests.cs') -ReferencedAssemblies @($leaveSdk, $leaveAssembly, 'System.Runtime.Serialization')
if ($LegacyEvidence) {
    [ProtectLeaveWritesTests]::VerifyLegacyMarkerDependency()
    Write-Host 'Confirmed downloaded pre-fix DLL rejects transactional API ancestry without a parent marker and accepts the identical context when the old marker is present. No Dataverse writes.'
    exit
}
$leaveChecks = [ProtectLeaveWritesTests]::Run()
Write-Host "Passed $leaveChecks write-guard regression checks. No Dataverse writes."
