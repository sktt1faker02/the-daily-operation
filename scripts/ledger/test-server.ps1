$ErrorActionPreference = 'Stop'
$ledgerRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$ledgerBin = Join-Path $ledgerRoot 'plugins/A365.Ledger.Plugins/bin'
$ledgerSdk = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
& 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe' /nologo /target:exe /warnaserror+ "/out:$ledgerBin/LedgerServerTests.exe" "/reference:$ledgerSdk" "/reference:$ledgerBin/A365.Ledger.Plugins.dll" /reference:System.Web.Extensions.dll /reference:System.Runtime.Serialization.dll (Join-Path $ledgerRoot 'plugins/A365.Ledger.Plugins/tests/ServerTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Ledger server test compilation failed.' }
Copy-Item -LiteralPath $ledgerSdk -Destination (Join-Path $ledgerBin 'Microsoft.Xrm.Sdk.dll') -Force
& (Join-Path $ledgerBin 'LedgerServerTests.exe')
if ($LASTEXITCODE -ne 0) { throw 'Ledger server contract tests failed.' }
