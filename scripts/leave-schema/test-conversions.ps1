$ErrorActionPreference = 'Stop'
$conversionRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$conversionSdk = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
$conversionAssembly = Join-Path $conversionRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
[Reflection.Assembly]::LoadFrom($conversionSdk) | Out-Null
[Reflection.Assembly]::LoadFrom($conversionAssembly) | Out-Null
Add-Type -Path (Join-Path $conversionRoot 'plugins/A365.Leave.Plugins/ConversionCommands.Tests.cs') -ReferencedAssemblies @($conversionSdk, $conversionAssembly, 'System.Runtime.Serialization', 'System.Web.Extensions')
$conversionChecks = [ConversionCommandsTests]::Run()
Write-Host "Passed $conversionChecks synthetic conversion server checks. No Dataverse calls or financial records."
