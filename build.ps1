# data/*.json 을 병합해 data.js 생성
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$dataDir = Join-Path $root 'data'

$categoryOrder = @('warehouse','robots','robotics-basics','simulation','nvidia','learning','frontier','optimization','logistics-opt','pathfinding','multiagent')

$categories = @()
$terms = @()

foreach ($catId in $categoryOrder) {
    $file = Join-Path $dataDir "$catId.json"
    if (-not (Test-Path $file)) { Write-Warning "missing: $file"; continue }
    $json = Get-Content $file -Raw -Encoding UTF8 | ConvertFrom-Json
    $categories += [ordered]@{ id = $json.category; ko = $json.categoryKo }
    foreach ($t in $json.terms) {
        $entry = [ordered]@{
            id         = $t.id
            category   = $json.category
            term       = $t.term
            ko         = $t.ko
            definition = $t.definition
            details    = $t.details
            sources    = @($t.sources | ForEach-Object { [ordered]@{ name = $_.name; url = $_.url } })
            related    = @($t.related)
        }
        $terms += $entry
    }
}

$payload = [ordered]@{ categories = $categories; terms = $terms }
$jsonOut = $payload | ConvertTo-Json -Depth 6 -Compress

$out = "window.GLOSSARY_DATA = $jsonOut;"
[System.IO.File]::WriteAllText((Join-Path $root 'data.js'), $out, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "data.js generated: $($terms.Count) terms, $($categories.Count) categories"
