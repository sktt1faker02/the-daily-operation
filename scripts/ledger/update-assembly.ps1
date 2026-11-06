$ErrorActionPreference='Stop'
$ledgerCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$ledgerEnvironment='https://org9a7651f0.crm5.dynamics.com'
$ledgerWork=Join-Path $PSScriptRoot '.work/registration'
$ledgerAssembly=Join-Path $PSScriptRoot '../../plugins/A365.Ledger.Plugins/bin/A365.Ledger.Plugins.dll'
$ledgerRaw=& $ledgerCli api request --target dataverse --environment $ledgerEnvironment --path '/api/data/v9.2/pluginassemblies?$select=pluginassemblyid,name,version,publickeytoken&$filter=name eq ''A365.Ledger.Plugins''' --context 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex'
if($LASTEXITCODE -ne 0){throw 'Cannot inspect existing Ledger assembly.'}
$ledgerRows=(($ledgerRaw -join "`n")|ConvertFrom-Json).value
if(@($ledgerRows).Count -ne 1){throw 'Expected one registered Ledger assembly.'}
$ledgerName=[Reflection.AssemblyName]::GetAssemblyName([IO.Path]::GetFullPath($ledgerAssembly))
$ledgerToken=($ledgerName.GetPublicKeyToken()|ForEach-Object {$_.ToString('x2')}) -join ''
if($ledgerRows[0].publickeytoken -cne $ledgerToken -or $ledgerRows[0].name -cne $ledgerName.Name){throw 'Ledger assembly signing identity mismatch.'}
$ledgerOld=[version]$ledgerRows[0].version
if($ledgerOld.Major -ne $ledgerName.Version.Major -or $ledgerOld.Minor -ne $ledgerName.Version.Minor -or $ledgerName.Version -lt $ledgerOld){throw 'Only a non-downgrade same-major/minor update is permitted.'}
$ledgerBody=Join-Path $ledgerWork 'assembly-update.json'
[IO.File]::WriteAllText($ledgerBody,(@{content=[Convert]::ToBase64String([IO.File]::ReadAllBytes($ledgerAssembly))}|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
& $ledgerCli api request --target dataverse --environment $ledgerEnvironment --path "/api/data/v9.2/pluginassemblies($($ledgerRows[0].pluginassemblyid))" --method PATCH --body-file $ledgerBody --header 'MSCRM.SolutionUniqueName:A365_DailyOperations' --context 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex'|Out-Null
if($LASTEXITCODE -ne 0){throw 'Ledger assembly update failed. Inspect before retrying.'}
Write-Host "Updated only the registered signed Ledger assembly to $($ledgerName.Version)."
