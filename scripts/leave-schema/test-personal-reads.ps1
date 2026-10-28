$ErrorActionPreference = 'Stop'
$portalRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$portalSdk = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
$portalAssembly = Join-Path $portalRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
[Reflection.Assembly]::LoadFrom($portalSdk) | Out-Null
[Reflection.Assembly]::LoadFrom($portalAssembly) | Out-Null
Add-Type -Path (Join-Path $portalRoot 'plugins/A365.Leave.Plugins/PersonalLeaveReads.Tests.cs') -ReferencedAssemblies @($portalSdk, $portalAssembly, 'System.Runtime.Serialization', 'System.Web.Extensions')
$portalChecks = [PersonalLeaveReadsTests]::Run()
Write-Host "Passed $portalChecks personal read security checks. No live records or Dataverse calls."
