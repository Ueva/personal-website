param([string]$PreviewUrl)

$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    $checkArguments = @('exec', 'ruby', 'scripts/check.rb')
    if ($PreviewUrl) { $checkArguments += @('--preview', $PreviewUrl) }
    bundle @checkArguments
    if ($LASTEXITCODE -ne 0) { throw 'Website checks failed.' }
} finally {
    Pop-Location
}
