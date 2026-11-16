<#
.SYNOPSIS
    Publishes the packages created by build-and-pack.ps1 (Firefox, Firefox-unlisted, Chrome MV3, Edge MV3).

.DESCRIPTION
    Reads  ..\!Releases\<version>\  next to the repository folder:
        SmartProxy-v<ver>-Firefox.zip, -firefox-unlisted.zip, -Chrome-ManifestV3.zip, -Edge-ManifestV3.zip
        SmartProxy-<ver>-sources.zip           (attached to the Firefox submissions)
        SmartProxy-<ver>-notes.txt             (release notes)
    Optional: review-notes.txt next to this script   (notes for the AMO reviewers, build instructions etc.)
    Credentials: secrets.ps1 next to this script (see secrets.example.ps1) or environment variables.

    Needs PowerShell 7+. Use -DryRun first, it checks everything and calls no store.

.PARAMETER Version
    The version to publish, it selects the folder ..\!Releases\<Version>.
    Default: the version in src\manifest-chrome.json.

.PARAMETER Stores
    Which stores to publish to: firefox, firefox-unlisted, chrome, edge (comma separated).
    Default: all four.

.PARAMETER NotesFile
    Release notes file to use instead of SmartProxy-<Version>-notes.txt in the release folder.
    Needed for firefox, firefox-unlisted and edge. Chrome has no release notes field in its API.

.PARAMETER DryRun
    Only checks: finds the packages, verifies that each zip's manifest version equals -Version,
    verifies notes, sources and credentials, prints what would be sent, then stops.
    Nothing is sent to any store and the credentials are not tested against the stores.

.PARAMETER UploadOnly
    Chrome and Edge only: upload the package as a draft but do not submit it for review.
    Firefox always submits, this switch does not apply to it.

.PARAMETER Yes
    Skip the "type publish" confirmation prompt.

.EXAMPLE
    .\deploy\publish.ps1 -DryRun
    .\deploy\publish.ps1 -Stores chrome,edge -UploadOnly
    .\deploy\publish.ps1 -Version 2.5
#>
[CmdletBinding()]
param(
    [string] $Version,
    [ValidateSet('firefox', 'firefox-unlisted', 'chrome', 'edge')]
    [string[]] $Stores = @('firefox', 'firefox-unlisted', 'chrome', 'edge'),
    [string] $NotesFile,
    [switch] $DryRun,
    # Chrome/Edge only: upload the package as a draft but do not submit it for review
    [switch] $UploadOnly,
    # skip the confirmation prompt
    [switch] $Yes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'PowerShell 7 or later is required.' }

$RepoRoot = Split-Path -Parent $PSScriptRoot   # this script is in <repo>/deploy
$ReleasesRoot = Join-Path (Split-Path -Parent $RepoRoot) '!Releases'

$AmoFirefoxGuid = 'smartproxy@salarcode.com'
$AmoUnlistedGuid = 'smartproxy-unlisted@salarcode.com'
$DefaultChromeItemId = 'jogcnplbkgkfdakgdenhlpcfhjioidoj'

$secretsFile = Join-Path $PSScriptRoot 'secrets.ps1'
if (Test-Path $secretsFile) { . $secretsFile }

# ---------------------------------------------------------------- helpers

function Get-Env([string]$Name, [string]$Default = '') {
    $v = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($v)) { return $Default }
    return $v
}

function Format-HttpError($ErrorRecord) {
    $details = ''
    if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) { $details = $ErrorRecord.ErrorDetails.Message }
    return "$($ErrorRecord.Exception.Message) $details".Trim()
}

function Get-ZipManifest([string]$ZipPath) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $entry = $zip.GetEntry('manifest.json')
        if (-not $entry) { throw "manifest.json not found in $ZipPath" }
        $reader = New-Object System.IO.StreamReader($entry.Open())
        try { return ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
    }
    finally { $zip.Dispose() }
}

function Wait-Until([scriptblock]$Poll, [scriptblock]$IsDone, [int]$TimeoutSec = 300, [int]$IntervalSec = 5) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ($true) {
        $r = & $Poll
        if (& $IsDone $r) { return $r }
        if ((Get-Date) -gt $deadline) { throw "Timed out after $TimeoutSec seconds." }
        Start-Sleep -Seconds $IntervalSec
    }
}

# ---------------------------------------------------------------- Firefox (AMO API v5)

function ConvertTo-Base64Url([byte[]]$Bytes) {
    [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-AmoJwt {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $header = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes('{"alg":"HS256","typ":"JWT"}'))
    $claims = @{ iss = (Get-Env 'AMO_JWT_ISSUER'); jti = [guid]::NewGuid().ToString(); iat = $now; exp = $now + 240 }
    $payload = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes(($claims | ConvertTo-Json -Compress)))
    $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes((Get-Env 'AMO_JWT_SECRET')))
    $sig = ConvertTo-Base64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$header.$payload")))
    return "$header.$payload.$sig"
}

function Invoke-Amo([string]$Method, [string]$Path, $Json = $null, $Form = $null, [string]$Url = '', [string]$OutFile = '') {
    $req = @{
        Method  = $Method
        Uri     = $(if ($Url) { $Url } else { "https://addons.mozilla.org/api/v5/addons/$Path" })
        Headers = @{ Authorization = "JWT $(New-AmoJwt)" }
    }
    if ($null -ne $Json) { $req.Body = ($Json | ConvertTo-Json -Depth 5); $req.ContentType = 'application/json; charset=utf-8' }
    if ($null -ne $Form) { $req.Form = $Form }
    if ($OutFile) { $req.OutFile = $OutFile }
    try { Invoke-RestMethod @req } catch { throw (Format-HttpError $_) }
}

function Publish-Amo($Pack, [string]$Guid, [string]$Channel, [string]$SignedOutFile) {
    Write-Host "  uploading $(Split-Path -Leaf $Pack.Zip) ($Channel)..."
    $upload = Invoke-Amo POST 'upload/' -Form @{ upload = (Get-Item $Pack.Zip); channel = $Channel }
    $upload = Wait-Until { Invoke-Amo GET "upload/$($upload.uuid)/" } { param($u) $u.processed } 300
    if (-not $upload.valid) { throw "AMO validation failed: $($upload.validation | ConvertTo-Json -Depth 6 -Compress)" }

    Write-Host '  creating version...'
    $g = [uri]::EscapeDataString($Guid)
    $body = @{ upload = $upload.uuid; release_notes = @{ 'en-US' = $Pack.ReleaseNotes } }
    # reviewer notes are only needed for the listed add-on
    if ($Channel -eq 'listed') { $body.approval_notes = $Pack.ApprovalNotes }
    $ver = Invoke-Amo POST "addon/$g/versions/" -Json $body

    Write-Host '  attaching sources...'
    Invoke-Amo PATCH "addon/$g/versions/$($ver.id)/" -Form @{ source = (Get-Item $Pack.Sources) } | Out-Null

    if ($Channel -eq 'unlisted') {
        Write-Host '  waiting for the signed file...'
        $ver = Wait-Until { Invoke-Amo GET "addon/$g/versions/$($ver.id)/" } {
            param($v) $v.file -and $v.file.status -in 'public', 'approved' } 600 10
        Invoke-Amo GET '' -Url $ver.file.url -OutFile $SignedOutFile | Out-Null
        Write-Host "  signed file saved to $SignedOutFile"
    }
    else {
        Write-Host "  version $($ver.version) submitted, it is in the review queue."
    }
}

# ---------------------------------------------------------------- Chrome Web Store (v1.1)

function Publish-Chrome($Pack) {
    $itemId = Get-Env 'CWS_ITEM_ID' $DefaultChromeItemId
    $token = Invoke-RestMethod -Method Post -Uri 'https://oauth2.googleapis.com/token' -Body @{
        client_id     = (Get-Env 'CWS_CLIENT_ID'); client_secret = (Get-Env 'CWS_CLIENT_SECRET')
        refresh_token = (Get-Env 'CWS_REFRESH_TOKEN'); grant_type = 'refresh_token'
    }
    $headers = @{ Authorization = "Bearer $($token.access_token)"; 'x-goog-api-version' = '2' }

    Write-Host "  uploading $(Split-Path -Leaf $Pack.Zip)..."
    try { $up = Invoke-RestMethod -Method Put -Uri "https://www.googleapis.com/upload/chromewebstore/v1.1/items/$itemId" -Headers $headers -InFile $Pack.Zip -ContentType 'application/zip' }
    catch { throw (Format-HttpError $_) }
    if ($up.uploadState -eq 'IN_PROGRESS') {
        $up = Wait-Until { Invoke-RestMethod -Uri "https://www.googleapis.com/chromewebstore/v1.1/items/${itemId}?projection=DRAFT" -Headers $headers } { param($i) $i.uploadState -ne 'IN_PROGRESS' } 300
    }
    if ($up.uploadState -ne 'SUCCESS') { throw "Chrome upload failed: $($up | ConvertTo-Json -Depth 5 -Compress)" }

    if ($UploadOnly) { Write-Host '  uploaded as draft (not submitted, -UploadOnly).'; return }
    Write-Host '  submitting for review...'
    try { $pub = Invoke-RestMethod -Method Post -Uri "https://www.googleapis.com/chromewebstore/v1.1/items/$itemId/publish" -Headers $headers }
    catch { throw (Format-HttpError $_) }
    if (-not ($pub.status | Where-Object { $_ -in 'OK', 'ITEM_PENDING_REVIEW' })) { throw "Chrome publish failed: $($pub | ConvertTo-Json -Depth 5 -Compress)" }
    Write-Host "  submitted: $($pub.status -join ', ')"
}

# ---------------------------------------------------------------- Edge Add-ons (v1)

function Publish-Edge($Pack) {
    $base = "https://api.addons.microsoftedge.microsoft.com/v1/products/$(Get-Env 'EDGE_PRODUCT_ID')"
    $headers = @{ Authorization = "ApiKey $(Get-Env 'EDGE_API_KEY')"; 'X-ClientID' = (Get-Env 'EDGE_CLIENT_ID') }

    Write-Host "  uploading $(Split-Path -Leaf $Pack.Zip)..."
    try { Invoke-RestMethod -Method Post -Uri "$base/submissions/draft/package" -Headers $headers -InFile $Pack.Zip -ContentType 'application/zip' -ResponseHeadersVariable rh | Out-Null }
    catch { throw (Format-HttpError $_) }
    $opId = @($rh['Location'])[0]
    $op = Wait-Until { Invoke-RestMethod -Uri "$base/submissions/draft/package/operations/$opId" -Headers $headers } { param($o) $o.status -ne 'InProgress' } 300
    if ($op.status -ne 'Succeeded') { throw "Edge upload failed: $($op | ConvertTo-Json -Depth 5 -Compress)" }

    if ($UploadOnly) { Write-Host '  uploaded as draft (not submitted, -UploadOnly).'; return }
    Write-Host '  submitting for review...'
    try { Invoke-RestMethod -Method Post -Uri "$base/submissions" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body (@{ notes = $Pack.ReleaseNotes } | ConvertTo-Json) -ResponseHeadersVariable rh | Out-Null }
    catch { throw (Format-HttpError $_) }
    $opId = @($rh['Location'])[0]
    $op = Wait-Until { Invoke-RestMethod -Uri "$base/submissions/operations/$opId" -Headers $headers } { param($o) $o.status -ne 'InProgress' } 300
    if ($op.status -ne 'Succeeded') { throw "Edge publish failed: $($op | ConvertTo-Json -Depth 5 -Compress)" }
    Write-Host '  submitted.'
}

# ---------------------------------------------------------------- collect and validate

if (-not $Version) { $Version = (Get-Content (Join-Path $RepoRoot 'src\manifest-chrome.json') -Raw | ConvertFrom-Json).version }
$ReleaseDir = Join-Path $ReleasesRoot $Version
if (-not (Test-Path $ReleaseDir)) { throw "Release folder not found: $ReleaseDir (run build-and-pack.ps1 first)" }

$storeInfo = @{
    'firefox'          = @{ Zip = "SmartProxy-v$Version-Firefox.zip"; Env = 'AMO_JWT_ISSUER', 'AMO_JWT_SECRET'; Sources = $true; Notes = $true }
    'firefox-unlisted' = @{ Zip = "SmartProxy-v$Version-firefox-unlisted.zip"; Env = 'AMO_JWT_ISSUER', 'AMO_JWT_SECRET'; Sources = $true; Notes = $true }
    'chrome'           = @{ Zip = "SmartProxy-v$Version-Chrome-ManifestV3.zip"; Env = 'CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN'; Sources = $false; Notes = $false }
    'edge'             = @{ Zip = "SmartProxy-v$Version-Edge-ManifestV3.zip"; Env = 'EDGE_CLIENT_ID', 'EDGE_API_KEY', 'EDGE_PRODUCT_ID'; Sources = $false; Notes = $true }
}

$needNotes = @($Stores | Where-Object { $storeInfo[$_].Notes }).Count -gt 0
$needSources = @($Stores | Where-Object { $storeInfo[$_].Sources }).Count -gt 0

if (-not $NotesFile) { $NotesFile = Join-Path $ReleaseDir "SmartProxy-$Version-notes.txt" }
$releaseNotes = ''
if ($needNotes) {
    if (-not (Test-Path $NotesFile)) { throw "Release notes not found: $NotesFile" }
    $releaseNotes = (Get-Content $NotesFile -Raw).Trim()
    if (-not $releaseNotes) { throw "Release notes are empty: $NotesFile" }
}

$sourcesZip = Join-Path $ReleaseDir "SmartProxy-$Version-sources.zip"
if ($needSources -and -not (Test-Path $sourcesZip)) { throw "Sources zip not found: $sourcesZip" }

$reviewNotesFile = Join-Path $PSScriptRoot 'review-notes.txt'
if (Test-Path $reviewNotesFile) { $approvalNotes = (Get-Content $reviewNotesFile -Raw).Trim() }
else { $approvalNotes = "Build instructions: Node.js 24+, run 'npm install' and then 'npm run build-ff'. The output is in the 'build' folder. The full source code is attached." }

$problems = @()
foreach ($s in $Stores) {
    $zip = Join-Path $ReleaseDir $storeInfo[$s].Zip
    if (-not (Test-Path $zip)) { $problems += "[$s] package not found: $zip"; continue }
    $storeInfo[$s].Path = $zip
    $m = Get-ZipManifest $zip
    if ($m.version -ne $Version) { $problems += "[$s] manifest version is $($m.version), expected $Version" }
    foreach ($e in $storeInfo[$s].Env) { if (-not (Get-Env $e)) { $problems += "[$s] missing credential: $e" } }
}
if ($problems) { $problems | ForEach-Object { Write-Warning $_ }; throw 'Fix the problems above first.' }

# ---------------------------------------------------------------- confirm

Write-Host "Version: $Version    Release folder: $ReleaseDir"
foreach ($s in $Stores) { Write-Host ("  {0,-17} {1}" -f $s, $storeInfo[$s].Zip) }
if ($needSources) { Write-Host "  sources           $(Split-Path -Leaf $sourcesZip)" }
if ($needNotes) {
    Write-Host "Release notes ($(Split-Path -Leaf $NotesFile)):"
    ($releaseNotes -split "`n" | Select-Object -First 8) | ForEach-Object { Write-Host "    $_" }
}
if ($UploadOnly) { Write-Host 'UploadOnly: Chrome/Edge will be uploaded but not submitted.' }

if ($DryRun) { Write-Host 'Dry run: everything checks out, nothing was sent.'; return }
if (-not $Yes) {
    if ((Read-Host "Type 'publish' to send these to the stores") -ne 'publish') { Write-Host 'Cancelled.'; return }
}

# ---------------------------------------------------------------- publish

$results = [ordered]@{}
foreach ($s in $Stores) {
    Write-Host "== $s"
    $pack = @{ Zip = $storeInfo[$s].Path; Sources = $sourcesZip; ReleaseNotes = $releaseNotes; ApprovalNotes = $approvalNotes }
    try {
        switch ($s) {
            'firefox' { Publish-Amo $pack $AmoFirefoxGuid 'listed' '' }
            'firefox-unlisted' { Publish-Amo $pack $AmoUnlistedGuid 'unlisted' (Join-Path $ReleaseDir "SmartProxy-v$Version-firefox-unlisted.xpi") }
            'chrome' { Publish-Chrome $pack }
            'edge' { Publish-Edge $pack }
        }
        $results[$s] = 'OK'
    }
    catch { $results[$s] = "FAILED: $($_.Exception.Message)"; Write-Warning $results[$s] }
}

Write-Host '== Summary'
$results.GetEnumerator() | ForEach-Object { Write-Host ("  {0,-17} {1}" -f $_.Key, $_.Value) }
if ($results.Values | Where-Object { $_ -ne 'OK' }) { exit 1 }
