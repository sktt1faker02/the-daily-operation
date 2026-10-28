$ErrorActionPreference = 'Stop'
$leaveProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../plugins/A365.Leave.Plugins'))
$leaveOutput = Join-Path $leaveProject 'bin'
New-Item -ItemType Directory -Force -Path $leaveOutput | Out-Null
$leaveKey = Join-Path $leaveProject 'A365.Leave.Plugins.snk'
if (-not (Test-Path -LiteralPath $leaveKey)) {
    $leaveKeyParameters = New-Object Security.Cryptography.CspParameters
    $leaveKeyParameters.KeyNumber = 2
    $leaveRsa = New-Object Security.Cryptography.RSACryptoServiceProvider(2048, $leaveKeyParameters)
    $leaveRsa.PersistKeyInCsp = $false
    try { [IO.File]::WriteAllBytes($leaveKey, $leaveRsa.ExportCspBlob($true)) } finally { $leaveRsa.Dispose() }
}
$leaveSdk = 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll'
if (-not (Test-Path -LiteralPath $leaveSdk)) { throw 'Verified installed Dataverse SDK assembly not found.' }
& 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe' /nologo /target:library /optimize+ /warnaserror+ "/keyfile:$leaveKey" "/out:$leaveOutput/A365.Leave.Plugins.dll" "/reference:$leaveSdk" /reference:System.Web.Extensions.dll /reference:System.Runtime.Serialization.dll (Join-Path $leaveProject 'LeaveCommand.cs') (Join-Path $leaveProject 'ConversionCommands.cs') (Join-Path $leaveProject 'PersonalLeaveReads.cs') (Join-Path $leaveProject 'DeleteLeave.cs')
if ($LASTEXITCODE -ne 0) { throw 'Leave server compilation failed.' }
Write-Host 'Compiled signed Leave server assembly using the installed .NET Framework compiler and Dataverse SDK.'
