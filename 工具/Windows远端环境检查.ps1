param([string]$GameCache = '')
$ErrorActionPreference = 'Stop'
$commands = @()
foreach ($name in @('git', 'node', 'npm', 'python', 'py', 'deepseek', 'codex', 'Warframe-Exporter-CLI')) {
    $found = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    $commands += [pscustomobject]@{ name = $name; available = [bool]$found; path = if ($found) { $found.Source } else { $null } }
}
$cache = $null
if ($GameCache) {
    $cache = [ordered]@{ path = $GameCache; exists = (Test-Path -LiteralPath $GameCache -PathType Container) }
    if ($cache.exists) {
        $files = @(Get-ChildItem -LiteralPath $GameCache -File)
        $toc = @($files | Where-Object { $_.Extension -eq '.toc' })
        $cacheFiles = @($files | Where-Object { $_.Extension -eq '.cache' })
        $cache.tocFiles = $toc.Count
        $cache.cacheFiles = $cacheFiles.Count
        $cache.pairedFiles = @($toc | Where-Object { Test-Path -LiteralPath (Join-Path $GameCache ($_.BaseName + '.cache')) -PathType Leaf }).Count
    }
}
[ordered]@{
    schemaVersion = 1
    checkedAt = [DateTime]::UtcNow.ToString('o')
    powershell = $PSVersionTable.PSVersion.ToString()
    sessionId = (Get-Process -Id $PID).SessionId
    commands = $commands
    gameCache = $cache
} | ConvertTo-Json -Depth 5
