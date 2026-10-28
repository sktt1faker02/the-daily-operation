$ErrorActionPreference='Stop'
$leaveCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$leaveEnvironment='https://org9a7651f0.crm5.dynamics.com'
$leaveWork=Join-Path $PSScriptRoot '.work/posting'
$leaveAssembly=Join-Path $PSScriptRoot '../../plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
$leaveRead=& $leaveCli api request --target dataverse --environment $leaveEnvironment --path '/api/data/v9.2/pluginassemblies?$select=pluginassemblyid,name,version,publickeytoken&$filter=name eq ''A365.Leave.Plugins''' --context 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex'
if($LASTEXITCODE -ne 0){throw 'Unable to inspect Leave assembly.'}
$leaveRows=(($leaveRead -join "`n")|ConvertFrom-Json).value
if(@($leaveRows).Count -ne 1){throw 'Expected one Leave assembly.'}
$leaveName=[Reflection.AssemblyName]::GetAssemblyName([IO.Path]::GetFullPath($leaveAssembly))
$leaveToken=($leaveName.GetPublicKeyToken()|ForEach-Object{$_.ToString('x2')}) -join ''
if($leaveRows[0].publickeytoken -cne $leaveToken -or $leaveRows[0].name -cne $leaveName.Name){throw 'Leave assembly identity mismatch.'}
$leaveOldVersion=[version]$leaveRows[0].version
if($leaveOldVersion.Major -ne $leaveName.Version.Major -or $leaveOldVersion.Minor -ne $leaveName.Version.Minor -or $leaveName.Version -lt $leaveOldVersion){throw 'Only a same-major/minor, non-downgrade in-place assembly update is allowed.'}
$leaveBody=Join-Path $leaveWork 'assembly-update.json'
[IO.File]::WriteAllText($leaveBody,(@{content=[Convert]::ToBase64String([IO.File]::ReadAllBytes($leaveAssembly))}|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
& $leaveCli api request --target dataverse --environment $leaveEnvironment --path "/api/data/v9.2/pluginassemblies($($leaveRows[0].pluginassemblyid))" --method PATCH --body-file $leaveBody --header 'MSCRM.SolutionUniqueName:A365_DailyOperations' --context 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Leave assembly update failed.'}
Write-Host 'Updated the existing signed Leave assembly only. Payroll assembly, schema, guards and role grants unchanged.'
