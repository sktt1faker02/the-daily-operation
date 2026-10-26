param([string]$ExportFolder='.work/solution-final')
$ErrorActionPreference='Stop'
$deleteRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$deleteExport=Join-Path $PSScriptRoot $ExportFolder
$deleteSource=Join-Path $deleteRoot 'solution/A365_DailyOperations/src'
function Save-DeletionXml([xml]$Document,[string]$Path){
    $deleteSettings=New-Object Xml.XmlWriterSettings
    $deleteSettings.Indent=$true
    $deleteSettings.Encoding=New-Object Text.UTF8Encoding($false)
    $deleteWriter=[Xml.XmlWriter]::Create($Path,$deleteSettings)
    try{$Document.Save($deleteWriter)}finally{$deleteWriter.Dispose()}
}
$deleteFolders=@('Entities/a365_PayrollDeletionReceipt','Entities/a365_payrolltemplate','Entities/a365_payrolltemplateline','customapis/a365_DeletePayrollPeriod','customapis/a365_DeletePayrollEntry','customapis/a365_DeleteEmployee')
$deleteAssembly=@(Get-ChildItem -LiteralPath (Join-Path $deleteExport 'PluginAssemblies') -Directory | Where-Object Name -like 'A365PayrollDeletion-*')
if($deleteAssembly.Count -ne 1){throw 'Expected one fresh native deletion assembly.'}
$deleteFolders+="PluginAssemblies/$($deleteAssembly[0].Name)"
foreach($deleteFolder in $deleteFolders){
    $deleteFrom=Join-Path $deleteExport $deleteFolder
    $deleteTo=Join-Path $deleteSource $deleteFolder
    if(-not(Test-Path -LiteralPath $deleteFrom)){throw "Missing native component $deleteFolder"}
    if(Test-Path -LiteralPath $deleteTo){
        foreach($deleteChild in Get-ChildItem -LiteralPath $deleteFrom){Copy-Item -LiteralPath $deleteChild.FullName -Destination $deleteTo -Recurse -Force}
    }else{Copy-Item -LiteralPath $deleteFrom -Destination $deleteTo -Recurse}
}
$deleteNativeBinary=Join-Path $deleteAssembly[0].FullName 'A365PayrollDeletion.dll'
$deleteLocalBinary=Join-Path $deleteRoot 'plugins/A365.Payroll.Deletion/bin/A365.Payroll.Deletion.dll'
if((Get-FileHash -LiteralPath $deleteNativeBinary).Hash -cne (Get-FileHash -LiteralPath $deleteLocalBinary).Hash){throw 'Exported server binary differs from tested local binary.'}
$deleteStepIds=@()
foreach($deleteFile in Get-ChildItem -LiteralPath (Join-Path $deleteExport 'SdkMessageProcessingSteps') -Filter '*.xml'){
    [xml]$deleteStep=Get-Content -Raw $deleteFile.FullName
    if($deleteStep.OuterXml -notmatch 'A365 Deletion Guard '){continue}
    $deleteStepIds+=$deleteFile.BaseName.ToLowerInvariant()
    Copy-Item -LiteralPath $deleteFile.FullName -Destination (Join-Path $deleteSource "SdkMessageProcessingSteps/$($deleteFile.Name)") -Force
}
[xml]$deleteManifest=Get-Content -Raw (Join-Path $deleteSource 'Other/Solution.xml')
[xml]$deleteNativeManifest=Get-Content -Raw (Join-Path $deleteExport 'Other/Solution.xml')
$deleteRoots=$deleteManifest.SelectSingleNode('//RootComponents')
foreach($deleteNode in $deleteNativeManifest.SelectNodes('//RootComponents/RootComponent')){
    if($deleteNode.schemaName -in @('a365_payrolldeletionreceipt','a365_payrolltemplate','a365_payrolltemplateline') -or $deleteNode.schemaName -like 'A365.Payroll.Deletion,*' -or ($deleteNode.id -and $deleteStepIds -contains $deleteNode.id.ToLowerInvariant())){
        # Replace only the same existing assembly/root identity with its freshly
        # exported definition (assembly version changes on guard deployment).
        if($deleteNode.id){foreach($deleteOld in @($deleteRoots.ChildNodes|Where-Object{$_.id -and $_.id -ieq $deleteNode.id})){$deleteRoots.RemoveChild($deleteOld)|Out-Null}}
        if(-not @($deleteRoots.ChildNodes|Where-Object{$_.OuterXml -ceq $deleteNode.OuterXml}).Count){$deleteRoots.AppendChild($deleteManifest.ImportNode($deleteNode,$true))|Out-Null}
    }
}
Save-DeletionXml $deleteManifest (Join-Path $deleteSource 'Other/Solution.xml')
[xml]$deleteIndex=Get-Content -Raw (Join-Path $deleteSource 'Other/Relationships.xml')
foreach($deleteFile in Get-ChildItem (Join-Path $deleteExport 'Other/Relationships') -Filter '*.xml'){
    [xml]$deleteNative=Get-Content -Raw $deleteFile.FullName
    $deleteNodes=@($deleteNative.SelectNodes('//EntityRelationship')|Where-Object{$_.GetAttribute('Name') -match 'payrolldeletionreceipt|payrolltemplate'})
    if(-not $deleteNodes.Count){continue}
    $deleteDestination=Join-Path $deleteSource "Other/Relationships/$($deleteFile.Name)"
    if(Test-Path -LiteralPath $deleteDestination){[xml]$deleteExisting=Get-Content -Raw $deleteDestination}
    else{
        [xml]$deleteExisting=$deleteNative.CloneNode($true)
        foreach($deleteOldNode in @($deleteExisting.DocumentElement.ChildNodes)){$deleteExisting.DocumentElement.RemoveChild($deleteOldNode)|Out-Null}
    }
    foreach($deleteNode in $deleteNodes){
        $deleteName=$deleteNode.GetAttribute('Name')
        $deleteOldRelationship=$deleteExisting.SelectSingleNode("//EntityRelationship[@Name='$deleteName']")
        if($deleteOldRelationship){$deleteExisting.DocumentElement.ReplaceChild($deleteExisting.ImportNode($deleteNode,$true),$deleteOldRelationship)|Out-Null}
        else{$deleteExisting.DocumentElement.AppendChild($deleteExisting.ImportNode($deleteNode,$true))|Out-Null}
        if(-not $deleteIndex.SelectSingleNode("//EntityRelationship[@Name='$deleteName']")){
            $deleteIndexNode=$deleteIndex.CreateElement('EntityRelationship');$deleteIndexNode.SetAttribute('Name',$deleteName)
            $deleteIndex.DocumentElement.AppendChild($deleteIndexNode)|Out-Null
        }
    }
    Save-DeletionXml $deleteExisting $deleteDestination
}
Save-DeletionXml $deleteIndex (Join-Path $deleteSource 'Other/Relationships.xml')
Write-Host 'Pulled native deletion components and existing template metadata needed by the protected employee reference. Roles, hosted app and Leave components preserved.'
