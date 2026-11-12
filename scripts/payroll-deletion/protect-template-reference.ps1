param([switch]$Apply)
$ErrorActionPreference='Stop'
$templateCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$templateEnvironment='https://org9a7651f0.crm5.dynamics.com'
$templateWork=Join-Path $PSScriptRoot '.work'
$templateMeta=Get-Content -Raw (Join-Path $templateWork 'preflight.json')|ConvertFrom-Json
$templateLink=@($templateMeta.a365_employee.OneToManyRelationships|Where-Object{$_.SchemaName -ceq 'a365_employee_a365_payrolltemplateline' -and $_.ReferencingAttribute -ceq 'a365_employee'})
if($templateLink.Count -ne 1){throw 'Verified template relationship metadata required.'}
$templatePath="/api/data/v9.2/RelationshipDefinitions($($templateLink[0].MetadataId))/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
$templateRead=& $templateCli api request --target dataverse --environment $templateEnvironment --path $templatePath --method GET --context 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex'
if($LASTEXITCODE -ne 0){throw 'Unable to read template relationship.'}
$templateDefinition=($templateRead -join "`n")|ConvertFrom-Json
if($templateDefinition.SchemaName -cne 'a365_employee_a365_payrolltemplateline' -or $templateDefinition.ReferencedEntity -cne 'a365_employee' -or $templateDefinition.ReferencingEntity -cne 'a365_payrolltemplateline'){throw 'Unexpected relationship.'}
if($templateDefinition.CascadeConfiguration.Delete -ceq 'Restrict'){Write-Host 'Template employee reference already restricts deletion.';return}
if($templateDefinition.CascadeConfiguration.Delete -cne 'RemoveLink'){throw 'Unexpected existing deletion behavior.'}
if(-not $Apply){Write-Host 'Read-only review: template employee reference currently removes its link on employee deletion; proposed change is Restrict only.';return}
$templateDefinition.PSObject.Properties.Remove('@odata.context')
if(-not $templateDefinition.PSObject.Properties['@odata.type']){$templateDefinition|Add-Member -NotePropertyName '@odata.type' -NotePropertyValue '#Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'}
$templateDefinition.CascadeConfiguration.Delete='Restrict'
$templateBodyFile=Join-Path $templateWork 'template-reference.json'
[IO.File]::WriteAllText($templateBodyFile,($templateDefinition|ConvertTo-Json -Depth 60 -Compress),(New-Object Text.UTF8Encoding($false)))
$templateWritePath="/api/data/v9.2/RelationshipDefinitions($($templateLink[0].MetadataId))"
$templateWrite=& $templateCli api request --target dataverse --environment $templateEnvironment --path $templateWritePath --method PUT --body-file $templateBodyFile --header 'MSCRM.SolutionUniqueName:A365_DailyOperations' --header 'MSCRM.MergeLabels:true' --context 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex'
if($LASTEXITCODE -ne 0){throw "Template relationship protection failed: $($templateWrite -join ' ')"}
$templatePublish=Join-Path $templateWork 'publish-template-reference.json'
[IO.File]::WriteAllText($templatePublish,(@{ParameterXml='<importexportxml><entities><entity>a365_employee</entity><entity>a365_payrolltemplateline</entity></entities></importexportxml>'}|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
& $templateCli api request --target dataverse --environment $templateEnvironment --path '/api/data/v9.2/PublishXml' --method POST --body-file $templatePublish --header 'MSCRM.SolutionUniqueName:A365_DailyOperations' --context 'app=dataverse-skills/1.16.0;skill=dv-metadata;agent=codex' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Template relationship publication failed.'}
Write-Host 'Existing employee/template Delete behavior changed from RemoveLink to Restrict. Business records and other relationship settings unchanged.'
