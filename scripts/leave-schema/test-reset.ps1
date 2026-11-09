$ErrorActionPreference = 'Stop'
$resetRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$resetSdk = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
$resetAssembly = Join-Path $resetRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
[Reflection.Assembly]::LoadFrom($resetSdk) | Out-Null
[Reflection.Assembly]::LoadFrom($resetAssembly) | Out-Null
Add-Type -Path (Join-Path $resetRoot 'plugins/A365.Leave.Plugins/PartialPaidLeave.Tests.cs') -ReferencedAssemblies @($resetSdk, $resetAssembly, 'System.Runtime.Serialization', 'System.Web.Extensions')
$resetChecks = [PartialPaidLeaveTests]::RunReset()
Write-Host "Passed $resetChecks synthetic leave refresh checks, including write guards, paging, rollback and retries. No live writes."

$resetConversionChecks = [PartialPaidLeaveTests]::RunResetConversion()
Write-Host "Passed $resetConversionChecks refresh/conversion preservation checks. No live writes."
