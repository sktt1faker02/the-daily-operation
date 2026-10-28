$ErrorActionPreference = 'Stop'
$splitRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$splitSdk = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
$splitAssembly = Join-Path $splitRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
[Reflection.Assembly]::LoadFrom($splitSdk) | Out-Null
[Reflection.Assembly]::LoadFrom($splitAssembly) | Out-Null
Add-Type -Path (Join-Path $splitRoot 'plugins/A365.Leave.Plugins/PartialPaidLeave.Tests.cs') -ReferencedAssemblies @($splitSdk, $splitAssembly, 'System.Runtime.Serialization', 'System.Web.Extensions')
$splitChecks = [PartialPaidLeaveTests]::Run()
Write-Host "Passed $splitChecks partial-paid issuance checks using synthetic services. No live records, Dataverse calls or email."
