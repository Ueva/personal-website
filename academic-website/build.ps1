$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
$previousEnvironment = $env:JEKYLL_ENV
try {
    $env:JEKYLL_ENV = 'production'
    bundle exec ruby scripts/check.rb --build
    if ($LASTEXITCODE -ne 0) { throw 'The production build failed.' }
} finally {
    $env:JEKYLL_ENV = $previousEnvironment
    Pop-Location
}
