$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
$previousEnvironment = $env:JEKYLL_ENV
try {
    $env:JEKYLL_ENV = 'development'
    bundle exec jekyll serve --livereload --drafts --future --config _config.yaml,_config_dev.yaml
    if ($LASTEXITCODE -ne 0) { throw 'The development server failed.' }
} finally {
    $env:JEKYLL_ENV = $previousEnvironment
    Pop-Location
}
