$ErrorActionPreference='Stop'
$leaveRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$leaveExport=Join-Path $PSScriptRoot '.work/posting-solution'
$leaveSource=Join-Path $leaveRoot 'solution/A365_DailyOperations/src'
if(-not(Test-Path (Join-Path $leaveExport 'customapis/a365_LeaveCommand/customapi.xml'))){throw 'Fresh native Leave API export is required.'}
function Save-LeaveXml([xml]$Document,[string]$Path){
    $leaveSettings=New-Object Xml.XmlWriterSettings
    $leaveSettings.Indent=$true
    $leaveSettings.Encoding=New-Object Text.UTF8Encoding($false)
    $leaveWriter=[Xml.XmlWriter]::Create($Path,$leaveSettings)
    try{$Document.Save($leaveWriter)}finally{$leaveWriter.Dispose()}
}
foreach($leaveEntity in @('a365_LeavePolicy','a365_LeaveCoordination')){
    $leaveFrom=Join-Path $leaveExport "Entities/$leaveEntity"
    $leaveTo=Join-Path $leaveSource "Entities/$leaveEntity"
    if(Test-Path $leaveTo){throw "New entity source already exists: $leaveEntity. Inspect rather than overwrite."}
    Copy-Item -LiteralPath $leaveFrom -Destination $leaveTo -Recurse
}
foreach($leavePair in @(@('a365_Leave',@('a365_EmailAttempt','a365_EmailOutcome','a365_EmailStartedOn','a365_RequestedBenefit')),@('a365_LeaveCreditTransaction',@('a365_CreditPeriod')))){
    $leaveName=$leavePair[0]
    [xml]$leaveExisting=Get-Content -Raw (Join-Path $leaveSource "Entities/$leaveName/Entity.xml")
    [xml]$leaveNative=Get-Content -Raw (Join-Path $leaveExport "Entities/$leaveName/Entity.xml")
    $leaveAttributes=$leaveExisting.SelectSingleNode('//EntityInfo/entity/attributes')
    foreach($leaveAttribute in $leavePair[1]){
        $leaveNode=$leaveNative.SelectSingleNode("//EntityInfo/entity/attributes/attribute[@PhysicalName='$leaveAttribute']")
        if(-not $leaveNode){throw "Native attribute missing: $leaveAttribute"}
        if(-not $leaveAttributes.SelectSingleNode("attribute[@PhysicalName='$leaveAttribute']")){$leaveAttributes.AppendChild($leaveExisting.ImportNode($leaveNode,$true))|Out-Null}
    }
    Save-LeaveXml $leaveExisting (Join-Path $leaveSource "Entities/$leaveName/Entity.xml")
}
foreach($leaveFolder in @('customapis','PluginAssemblies','SdkMessageProcessingSteps')){
    $leaveTo=Join-Path $leaveSource $leaveFolder
    New-Item -ItemType Directory -Force $leaveTo|Out-Null
    foreach($leaveItem in Get-ChildItem -LiteralPath (Join-Path $leaveExport $leaveFolder)){
        if(Test-Path (Join-Path $leaveTo $leaveItem.Name)){throw "Existing component source needs review: $($leaveItem.Name)"}
        Copy-Item -LiteralPath $leaveItem.FullName -Destination $leaveTo -Recurse
    }
}
[xml]$leaveManifest=Get-Content -Raw (Join-Path $leaveSource 'Other/Solution.xml')
[xml]$leaveNativeManifest=Get-Content -Raw (Join-Path $leaveExport 'Other/Solution.xml')
$leaveComponents=$leaveManifest.SelectSingleNode('//RootComponents')
foreach($leaveNode in $leaveNativeManifest.SelectNodes('//RootComponents/RootComponent')){
    if($leaveNode.type -in @('91','92') -or $leaveNode.schemaName -in @('a365_leavepolicy','a365_leavecoordination')){
        $leaveExists=@($leaveComponents.ChildNodes|Where-Object{$_.OuterXml -ceq $leaveNode.OuterXml}).Count
        if(-not $leaveExists){$leaveComponents.AppendChild($leaveManifest.ImportNode($leaveNode,$true))|Out-Null}
    }
}
Save-LeaveXml $leaveManifest (Join-Path $leaveSource 'Other/Solution.xml')
[xml]$leaveCustom=Get-Content -Raw (Join-Path $leaveSource 'Other/Customizations.xml')
[xml]$leaveNativeCustom=Get-Content -Raw (Join-Path $leaveExport 'Other/Customizations.xml')
foreach($leaveContainer in @('SolutionPluginAssemblies','SdkMessageProcessingSteps')){
    if(-not $leaveCustom.SelectSingleNode("/ImportExportXml/$leaveContainer")){
        $leaveCustom.DocumentElement.InsertBefore($leaveCustom.ImportNode($leaveNativeCustom.SelectSingleNode("/ImportExportXml/$leaveContainer"),$true),$leaveCustom.SelectSingleNode('/ImportExportXml/EntityDataProviders'))|Out-Null
    }
}
Save-LeaveXml $leaveCustom (Join-Path $leaveSource 'Other/Customizations.xml')
[xml]$leaveRelationshipIndex=Get-Content -Raw (Join-Path $leaveSource 'Other/Relationships.xml')
foreach($leaveFile in Get-ChildItem (Join-Path $leaveExport 'Other/Relationships') -Filter '*.xml'){
    [xml]$leaveNativeRelationships=Get-Content -Raw $leaveFile.FullName
    $leaveNew=@($leaveNativeRelationships.SelectNodes('//EntityRelationship')|Where-Object{$_.Name -match 'a365_leave(policy|coordination)'})
    if(-not $leaveNew.Count){continue}
    $leaveTarget=Join-Path $leaveSource "Other/Relationships/$($leaveFile.Name)"
    if(Test-Path $leaveTarget){[xml]$leaveRelationships=Get-Content -Raw $leaveTarget}else{
        [xml]$leaveRelationships=$leaveNativeRelationships.CloneNode($true)
        foreach($leaveNode in @($leaveRelationships.DocumentElement.ChildNodes)){if($leaveNode.Name -ne '#text'){$leaveRelationships.DocumentElement.RemoveChild($leaveNode)|Out-Null}}
    }
    foreach($leaveNode in $leaveNew){
        $leaveName=$leaveNode.GetAttribute('Name')
        if(-not $leaveRelationships.SelectSingleNode("//EntityRelationship[@Name='$leaveName']")){$leaveRelationships.DocumentElement.AppendChild($leaveRelationships.ImportNode($leaveNode,$true))|Out-Null}
        if(-not $leaveRelationshipIndex.SelectSingleNode("//EntityRelationship[@Name='$leaveName']")){
            $leaveIndexNode=$leaveRelationshipIndex.CreateElement('EntityRelationship');$leaveIndexNode.SetAttribute('Name',$leaveName)
            $leaveRelationshipIndex.DocumentElement.AppendChild($leaveIndexNode)|Out-Null
        }
    }
    Save-LeaveXml $leaveRelationships $leaveTarget
}
Save-LeaveXml $leaveRelationshipIndex (Join-Path $leaveSource 'Other/Relationships.xml')
Write-Host 'Pulled native Leave-only metadata/API/assembly/guard components. Payroll entities, role files and hosted app files preserved.'
