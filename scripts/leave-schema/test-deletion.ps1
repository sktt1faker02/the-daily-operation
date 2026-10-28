$ErrorActionPreference = 'Stop'
$deleteRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$deleteSdk = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
$deleteAssembly = Join-Path $deleteRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
[Reflection.Assembly]::LoadFrom($deleteSdk) | Out-Null
[Reflection.Assembly]::LoadFrom($deleteAssembly) | Out-Null
Add-Type -Path (Join-Path $deleteRoot 'plugins/A365.Leave.Plugins/PartialPaidLeave.Tests.cs') -ReferencedAssemblies @($deleteSdk, $deleteAssembly, 'System.Runtime.Serialization', 'System.Web.Extensions')
$deleteChecks = [PartialPaidLeaveTests]::RunDeletion()
Write-Host "Passed $deleteChecks synthetic Leave deletion checks. No live records, Dataverse writes or email."
