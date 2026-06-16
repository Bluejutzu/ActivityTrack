# Bump the app version across all config files and create a git tag.
# Usage: .\scripts\bump-version.ps1 <version> [-DryRun]
# Example: .\scripts\bump-version.ps1 0.2.0
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Version,

    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Version must be in x.y.z format (e.g. 0.2.0)"
    exit 1
}

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

# Bail if there are uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Error "Working tree has uncommitted changes. Commit or stash them first."
    exit 1
}

Write-Host "Bumping version to $Version..."

# Check if tag already exists
$tagName = "v$Version"
$existingTag = git tag -l $tagName 2>$null
if ($existingTag) {
    Write-Error "Tag $tagName already exists. Use a different version or delete the tag first."
    exit 1
}

# Cargo.toml — replace only the first occurrence (package version, not a dep)
$cargoPath = "apps/desktop/src-tauri/Cargo.toml"
$cargoContent = Get-Content $cargoPath -Raw
$cargoContent = $cargoContent -replace '(?m)^version = "[^"]*"', "version = `"$Version`""
# Only replace the first match
$firstMatch = [regex]::Match($cargoContent, '(?m)^version = "[^"]*"')
if ($firstMatch.Success) {
    $cargoContent = $cargoContent.Substring(0, $firstMatch.Index) +
                    "version = `"$Version`"" +
                    $cargoContent.Substring($firstMatch.Index + $firstMatch.Length)
}
Set-Content $cargoPath $cargoContent -NoNewline

# tauri.conf.json
$tauriPath = "apps/desktop/src-tauri/tauri.conf.json"
$tauriJson = Get-Content $tauriPath -Raw | ConvertFrom-Json
$tauriJson.version = $Version
$tauriJson | ConvertTo-Json -Depth 10 | Set-Content $tauriPath -NoNewline

# apps/desktop/package.json
$pkgPath = "apps/desktop/package.json"
$pkgJson = Get-Content $pkgPath -Raw | ConvertFrom-Json
$pkgJson.version = $Version
$pkgJson | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -NoNewline

Write-Host "Updated:"
Write-Host "  $cargoPath"
Write-Host "  $tauriPath"
Write-Host "  $pkgPath"

$files = @($cargoPath, $tauriPath, $pkgPath)

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry run — skipping git commit, tag, and push."
    git diff $files
    exit 0
}

git add $files
git commit -m "chore: bump version to $Version"
git tag -a "v$Version" -m "v$Version"

Write-Host ""
Write-Host "Committed and tagged v$Version. Pushing..."
git push
git push origin "v$Version"
Write-Host ""
Write-Host "Done. CI will now build and publish the v$Version release."
