$ErrorActionPreference='Stop'
$conversionRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$conversionNative=Join-Path $PSScriptRoot '.work/conversion/unpacked'
$conversionSource=Join-Path $conversionRoot 'solution/A365_DailyOperations/src'
if(-not(Test-Path (Join-Path $conversionNative 'Entities/a365_LeaveConversionYear/Entity.xml'))){throw 'Native conversion schema export required.'}
function Save-ConversionXml([xml]$Document,[string]$Path){
    $settings=New-Object Xml.XmlWriterSettings; $settings.Indent=$true; $settings.Encoding=New-Object Text.UTF8Encoding($false)
    $writer=[Xml.XmlWriter]::Create($Path,$settings);try{$Document.Save($writer)}finally{$writer.Dispose()}
}
$parent=Join-Path $conversionSource 'Entities/a365_LeaveConversionYear'
if(Test-Path $parent){throw 'Parent source already exists; inspect before overwriting.'}
Copy-Item -LiteralPath (Join-Path $conversionNative 'Entities/a365_LeaveConversionYear') -Destination $parent -Recurse
Copy-Item -LiteralPath (Join-Path $conversionNative 'Entities/a365_LeaveCashConversion/Entity.xml') -Destination (Join-Path $conversionSource 'Entities/a365_LeaveCashConversion/Entity.xml')
[xml]$manifest=Get-Content -Raw (Join-Path $conversionSource 'Other/Solution.xml')
[xml]$nativeManifest=Get-Content -Raw (Join-Path $conversionNative 'Other/Solution.xml')
foreach($node in $nativeManifest.SelectNodes('//RootComponents/RootComponent')){
    if($node.schemaName -ceq 'a365_leaveconversionyear' -and -not $manifest.SelectSingleNode('//RootComponents/RootComponent[@schemaName="a365_leaveconversionyear"]')){$manifest.SelectSingleNode('//RootComponents').AppendChild($manifest.ImportNode($node,$true))|Out-Null}
}
Save-ConversionXml $manifest (Join-Path $conversionSource 'Other/Solution.xml')
[xml]$role=Get-Content -Raw (Join-Path $conversionSource 'Roles/A365 - Payroll Admin.xml')
[xml]$nativeRole=Get-Content -Raw (Join-Path $conversionNative 'Roles/A365 - Payroll Admin.xml')
$nodes=@($nativeRole.Role.RolePrivileges.RolePrivilege|Where-Object name -match 'a365_leaveconversionyear$')
if($nodes.Count -ne 4 -or @($nodes|Where-Object level -cne 'Global').Count){throw 'Expected exactly four approved parent privileges.'}
foreach($node in $nodes){if(-not @($role.Role.RolePrivileges.RolePrivilege|Where-Object name -ceq $node.name).Count){$role.Role.RolePrivileges.AppendChild($role.ImportNode($node,$true))|Out-Null}}
Save-ConversionXml $role (Join-Path $conversionSource 'Roles/A365 - Payroll Admin.xml')
[xml]$index=Get-Content -Raw (Join-Path $conversionSource 'Other/Relationships.xml')
foreach($file in Get-ChildItem (Join-Path $conversionNative 'Other/Relationships') -Filter '*.xml'){
    [xml]$native=Get-Content -Raw $file.FullName
    $relationships=@($native.SelectNodes('//EntityRelationship')|Where-Object {$_.GetAttribute('Name') -match 'leaveconversionyear'})
    if(-not $relationships.Count){continue}
    $target=Join-Path $conversionSource "Other/Relationships/$($file.Name)"
    if(Test-Path $target){[xml]$current=Get-Content -Raw $target}else{[xml]$current=$native.CloneNode($true);foreach($child in @($current.DocumentElement.ChildNodes)){if($child.Name -ne '#text'){$current.DocumentElement.RemoveChild($child)|Out-Null}}}
    foreach($node in $relationships){
        $name=$node.GetAttribute('Name')
        if(-not $current.SelectSingleNode("//EntityRelationship[@Name='$name']")){$current.DocumentElement.AppendChild($current.ImportNode($node,$true))|Out-Null}
        if(-not $index.SelectSingleNode("//EntityRelationship[@Name='$name']")){
            [xml]$nativeIndex=Get-Content -Raw (Join-Path $conversionNative 'Other/Relationships.xml')
            $indexNode=$nativeIndex.SelectSingleNode("//EntityRelationship[@Name='$name']")
            if(-not $indexNode){throw 'Native relationship index missing.'}
            $index.DocumentElement.AppendChild($index.ImportNode($indexNode,$true))|Out-Null
        }
    }
    Save-ConversionXml $current $target
}
Save-ConversionXml $index (Join-Path $conversionSource 'Other/Relationships.xml')
Write-Host 'Pulled only native conversion entities, relationships, parent root and four role privileges. Assemblies and hosted app untouched.'
