$ErrorActionPreference='Stop'
$deleteRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$deleteSdk='C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
$deleteAssembly=Join-Path $deleteRoot 'plugins/A365.Payroll.Deletion/bin/A365.Payroll.Deletion.dll'
[Reflection.Assembly]::LoadFrom($deleteSdk) | Out-Null
[Reflection.Assembly]::LoadFrom($deleteAssembly) | Out-Null
Add-Type -Path (Join-Path $deleteRoot 'plugins/A365.Payroll.Deletion/Deletion.Tests.cs') -ReferencedAssemblies @($deleteSdk,$deleteAssembly,'System.Runtime.Serialization','System.Web.Extensions','System.Core')
$deleteChecks=[DeletionTests]::Run()
Write-Host "Passed $deleteChecks deletion server checks with in-memory SDK boundaries. No live changes; database rollback semantics require separate environment verification."
