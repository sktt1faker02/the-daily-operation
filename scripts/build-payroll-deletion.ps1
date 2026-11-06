$ErrorActionPreference = 'Stop'
# Local compile only. This script does not connect to or change Dataverse.
$payrollProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../plugins/A365.Payroll.Deletion'))
$payrollOutput = Join-Path $payrollProject 'bin'
New-Item -ItemType Directory -Force -Path $payrollOutput | Out-Null
$payrollKey = Join-Path $payrollProject 'A365.Payroll.Deletion.snk'
if (-not (Test-Path -LiteralPath $payrollKey)) {
    $payrollParameters = New-Object Security.Cryptography.CspParameters
    $payrollParameters.KeyNumber = 2
    $payrollRsa = New-Object Security.Cryptography.RSACryptoServiceProvider(2048, $payrollParameters)
    $payrollRsa.PersistKeyInCsp = $false
    try { [IO.File]::WriteAllBytes($payrollKey, $payrollRsa.ExportCspBlob($true)) } finally { $payrollRsa.Dispose() }
}
$payrollSdk = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
if (-not (Test-Path -LiteralPath $payrollSdk)) { throw 'Installed Dataverse SDK assembly not found.' }
& 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe' /nologo /target:library /optimize+ /warnaserror+ "/keyfile:$payrollKey" "/out:$payrollOutput/A365.Payroll.Deletion.dll" "/reference:$payrollSdk" /reference:System.Web.Extensions.dll /reference:System.Runtime.Serialization.dll (Join-Path $payrollProject 'DeletePayrollPeriod.cs') (Join-Path $payrollProject 'ProtectDeletionWrites.cs')
if ($LASTEXITCODE -ne 0) { throw 'Payroll deletion server compilation failed.' }
Write-Host 'Compiled signed payroll deletion assembly. No registration or environment changes performed.'
