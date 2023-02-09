# use PowerShell 7 or later for correct zip file format
# run this in powershell to enable scripts
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

$global:Success = $true
$global:version = ""

Write-Output "Creating Browser Markets Release Packs..."

Function BuildAndPack($Build, $BuildName) {

 if(!$global:Success) {
    return;
 }
 Write-Output "Cleaning build folder"
 Remove-Item -path .\build\* -recurse

 Invoke-Expression ("npm run build-$Build " + ';$global:Success=$?')

 if($global:Success)
 {
    $manifest = Get-Content .\build\manifest.json | ConvertFrom-Json
    $global:version = $manifest.version
    $zipfile = "..\!Releases\SmartProxy-v$global:version-$BuildName.zip"
    $compress = @{
        Path = ".\build\*"
        DestinationPath = $zipfile
    }
    Compress-Archive @compress
    Write-Output "Created release in $zipfile"
 }
 else
 {
    Write-Output "Build has failed for $BuildName"
 }
}


BuildAndPack "ff" "Firefox"
BuildAndPack "ch"  "Chrome-ManifestV3"
BuildAndPack "ed"  "Edge"
BuildAndPack "th"  "Thunderbird"
BuildAndPack "op"  "Opera"
BuildAndPack "ff-unlisted" "firefox-unlisted"

Invoke-Expression ("git archive --format zip -o ..\!Releases\SmartProxy-$global:version-sources.zip HEAD")
Write-Output "Sources are saved in SmartProxy-$global:version-sources.zip"