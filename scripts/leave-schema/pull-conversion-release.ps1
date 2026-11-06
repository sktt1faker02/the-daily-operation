param([string]$ExpectedVersion = '1.0.2.0')
$ErrorActionPreference = 'Stop'
$conversionRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$conversionNative = Join-Path $PSScriptRoot '.work/conversion/release-unpacked'
$conversionSource = Join-Path $conversionRoot 'solution/A365_DailyOperations/src'
$assemblyPath = 'PluginAssemblies/A365LeavePlugins-1D8034C7-E2CD-F111-A05A-000D3A8014E4'
$nativeAssembly = Join-Path $conversionNative $assemblyPath
$assemblyXml = Get-ChildItem -LiteralPath $nativeAssembly -Filter '*.xml'
if (@($assemblyXml).Count -ne 1 -or (Get-Content -Raw -LiteralPath $assemblyXml.FullName) -notmatch ('Version=' + [regex]::Escape($ExpectedVersion) + ',')) { throw "Expected native export of Leave $ExpectedVersion." }
$nativeDll = Join-Path $nativeAssembly 'A365LeavePlugins.dll'
$testedDll = Join-Path $conversionRoot 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll'
if ((Get-FileHash $nativeDll).Hash -cne (Get-FileHash $testedDll).Hash) { throw 'Native DLL does not match tested DLL.' }
$steps = @(Get-ChildItem -LiteralPath (Join-Path $conversionNative 'SdkMessageProcessingSteps') -Filter '*.xml' | Where-Object { (Get-Content -Raw -LiteralPath $_.FullName) -match 'A365 Conversion Guard ' })
if ($steps.Count -ne 14) { throw 'Expected 14 native conversion guard steps.' }
[xml]$nativeManifest = Get-Content -Raw -LiteralPath (Join-Path $conversionNative 'Other/Solution.xml')
[xml]$manifest = Get-Content -Raw -LiteralPath (Join-Path $conversionSource 'Other/Solution.xml')
foreach ($step in $steps) {
    [xml]$stepXml = Get-Content -Raw -LiteralPath $step.FullName
    $id = $stepXml.DocumentElement.GetAttribute('SdkMessageProcessingStepId')
    $nativeRoot = $nativeManifest.SelectSingleNode("//RootComponent[@type='92' and @id='$id']")
    if (-not $nativeRoot) { throw "No native solution root for guard $id" }
    if (-not $manifest.SelectSingleNode("//RootComponent[@type='92' and @id='$id']")) {
        $manifest.SelectSingleNode('//RootComponents').AppendChild($manifest.ImportNode($nativeRoot, $true)) | Out-Null
    }
    Copy-Item -LiteralPath $step.FullName -Destination (Join-Path $conversionSource "SdkMessageProcessingSteps/$($step.Name)")
}
foreach ($file in Get-ChildItem -LiteralPath $nativeAssembly -File) {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $conversionSource "$assemblyPath/$($file.Name)")
}
foreach ($step in Get-ChildItem -LiteralPath (Join-Path $conversionNative 'SdkMessageProcessingSteps') -Filter '*.xml') {
    $stepText = Get-Content -Raw -LiteralPath $step.FullName
    if ($stepText -match 'A365\.Leave\.Plugins\.' -and $stepText -notmatch 'A365 Conversion Guard ') {
        # Existing Leave steps now reference the same upgraded assembly version.
        Copy-Item -LiteralPath $step.FullName -Destination (Join-Path $conversionSource "SdkMessageProcessingSteps/$($step.Name)")
    }
}
$settings = New-Object Xml.XmlWriterSettings
$settings.Indent = $true
$settings.Encoding = New-Object Text.UTF8Encoding($false)
$writer = [Xml.XmlWriter]::Create((Join-Path $conversionSource 'Other/Solution.xml'), $settings)
try { $manifest.Save($writer) } finally { $writer.Dispose() }
Write-Host 'Pulled native Leave DLL/metadata, 14 conversion guards/roots and existing Leave step version references.'
