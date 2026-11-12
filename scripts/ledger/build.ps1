$ErrorActionPreference = 'Stop'
$ledgerProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../plugins/A365.Ledger.Plugins'))
$ledgerOutput = Join-Path $ledgerProject 'bin'
New-Item -ItemType Directory -Force -Path $ledgerOutput | Out-Null
$ledgerKey = Join-Path $ledgerProject 'A365.Ledger.Plugins.snk'
if (-not (Test-Path -LiteralPath $ledgerKey)) {
    $ledgerParameters = New-Object Security.Cryptography.CspParameters
    $ledgerParameters.KeyNumber = 2
    $ledgerRsa = New-Object Security.Cryptography.RSACryptoServiceProvider(2048, $ledgerParameters)
    $ledgerRsa.PersistKeyInCsp = $false
    try { [IO.File]::WriteAllBytes($ledgerKey, $ledgerRsa.ExportCspBlob($true)) } finally { $ledgerRsa.Dispose() }
}
$ledgerSdk = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
if (-not (Test-Path -LiteralPath $ledgerSdk)) { throw 'Installed Dataverse SDK assembly not found.' }
& 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe' /nologo /target:library /optimize+ /warnaserror+ "/keyfile:$ledgerKey" "/out:$ledgerOutput/A365.Ledger.Plugins.dll" "/reference:$ledgerSdk" /reference:System.Web.Extensions.dll /reference:System.Runtime.Serialization.dll /reference:System.Xml.dll (Join-Path $ledgerProject 'LedgerCommand.cs')
if ($LASTEXITCODE -ne 0) { throw 'Ledger server compilation failed.' }
Write-Host 'Compiled signed Ledger assembly. No server registration or deployment.'
