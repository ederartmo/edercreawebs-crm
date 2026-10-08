[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')
$canonicalRoot = 'C:\Users\EderArtMo\Documents\edercreawebs-crm'
if ($projectRoot -ne $canonicalRoot -or (Get-Location).Provider.Name -ne 'FileSystem' -or
    [IO.Path]::GetFullPath((Get-Location).Path).TrimEnd('\', '/') -ne $canonicalRoot) {
    throw 'FAIL: Ejecuta start desde C:\Users\EderArtMo\Documents\edercreawebs-crm. Codex no iniciado.'
}
$gitOutput = & git -c "safe.directory=$projectRoot" rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath([string]$gitOutput).TrimEnd('\', '/') -ne $projectRoot) {
    throw 'FAIL: Ejecuta start dentro de la raiz Git de este proyecto. ABORTAR ESCRITURAS.'
}
$remote = & git -c "safe.directory=$projectRoot" remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0 -or $remote -notmatch '^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)ederartmo/edercreawebs-crm(?:\.git)?$') {
    throw 'FAIL: Remote incorrecto. ABORTAR ESCRITURAS.'
}
if (-not $HOME) { throw 'FAIL: HOME no disponible.' }
$secretsFile = Join-Path $HOME '.secrets/edercreawebs-crm.env'
if (-not (Test-Path -LiteralPath $secretsFile -PathType Leaf)) {
    throw 'FAIL: Falta $HOME/.secrets/edercreawebs-crm.env. Configura el entorno propio antes de continuar.'
}

# Parse fully before applying. Do not evaluate shell code or expand variable references.
$pending = @{}
$lineNumber = 0
foreach ($line in [IO.File]::ReadAllLines($secretsFile)) {
    $lineNumber++
    if ($line -match '^\s*(#|$)') { continue }
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
        throw "FAIL: Formato de entorno no soportado en linea $lineNumber (contenido omitido)."
    }
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if ($value.StartsWith('"') -or $value.StartsWith("'")) {
        $quote = $value.Substring(0, 1)
        if ($value.Length -lt 2 -or -not $value.EndsWith($quote)) {
            throw "FAIL: Comillas no soportadas en linea $lineNumber (contenido omitido)."
        }
        $value = $value.Substring(1, $value.Length - 2)
    } else {
        $value = ($value -replace '\s+#.*$', '').Trim()
    }
    if (-not $value.Trim()) { continue }
    if ($name -in @('HOME', 'USERPROFILE', 'CODEX_HOME', 'PATH', 'PSMODULEPATH')) {
        throw "FAIL: Variable de sistema no permitida en archivo de proyecto: $name."
    }
    if ($pending.ContainsKey($name)) { throw "FAIL: Variable duplicada: $name." }
    $pending[$name] = $value
}
if (-not $pending.ContainsKey('NEXT_PUBLIC_SUPABASE_URL')) {
    throw 'FAIL: Falta identidad Supabase en archivo externo. ABORTAR ESCRITURAS.'
}
if ($pending['NEXT_PUBLIC_SUPABASE_URL'].TrimEnd('/') -ne 'https://ycdosrsanutbhbgejwwg.supabase.co') {
    throw 'FAIL: Supabase mismatch en archivo externo. ABORTAR ESCRITURAS.'
}
foreach ($name in $pending.Keys) {
    if ($name -match 'SUPABASE' -and $pending[$name] -match 'rkqfloazqjsprbqhgnix') {
        throw 'FAIL: Detectada identidad prohibida de Miriam. ABORTAR ESCRITURAS.'
    }
}
foreach ($name in $pending.Keys) {
    [Environment]::SetEnvironmentVariable($name, $pending[$name], 'Process')
}
Set-Location -LiteralPath $projectRoot
$branch = & git -c "safe.directory=$projectRoot" branch --show-current
Write-Host 'Proyecto: EderCreaWebs CRM / WhatsApp Agent'
Write-Host 'Repo: ederartmo/edercreawebs-crm'
Write-Host "Rama: $branch"
Write-Host ('Variables cargadas: ' + (($pending.Keys | Sort-Object) -join ', '))
& (Join-Path $PSScriptRoot 'doctor.ps1')
if ($LASTEXITCODE -ne 0) { throw 'FAIL: Doctor rechazo el entorno. Codex no iniciado. ABORTAR ESCRITURAS.' }

$binRoot = Join-Path $HOME 'AppData/Local/OpenAI/Codex/bin'
if (-not (Test-Path -LiteralPath $binRoot -PathType Container)) {
    throw 'FAIL: No se encontro Codex instalado bajo $HOME\AppData\Local\OpenAI\Codex\bin.'
}
# Newest executable timestamp first; full path breaks ties deterministically.
# Ignore reparse points so discovery stays inside the installed bin directory.
$candidates = @(
    Get-ChildItem -LiteralPath $binRoot -Directory |
        Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } |
        ForEach-Object { Get-Item -LiteralPath (Join-Path $_.FullName 'codex.exe') -ErrorAction SilentlyContinue } |
        Where-Object { -not $_.PSIsContainer -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } |
        Sort-Object @{ Expression = 'LastWriteTimeUtc'; Descending = $true }, @{ Expression = 'FullName'; Descending = $false }
)
$codexPath = $null
foreach ($candidate in $candidates) {
    try {
        $versionOutput = & $candidate.FullName --version 2>$null
        if ($LASTEXITCODE -eq 0 -and ($versionOutput -join ' ') -match '^codex(?:-cli)? \d+\.\d+\.\d+') {
            $codexPath = $candidate.FullName
            break
        }
    } catch { continue }
}
if (-not $codexPath) { throw 'FAIL: No se encontro una instalacion valida de codex.exe bajo $HOME\AppData\Local\OpenAI\Codex\bin.' }

$codexArguments = @(
    '--no-daemon', '--cd', $projectRoot,
    '-c', 'mcp_servers.supabase-miriam.enabled=false',
    '-c', 'mcp_servers.supabase-edercreawebs.enabled=true',
    '-c', 'mcp_servers.supabase-edercreawebs.url="https://mcp.supabase.com/mcp?project_ref=ycdosrsanutbhbgejwwg&read_only=true"'
)
# Windows PowerShell 5.1 removes embedded quotes in native arguments. Escape only
# at that native boundary; PowerShell 7.3+ Standard/Windows mode preserves them.
$nativeArguments = @($codexArguments)
if ($PSVersionTable.PSVersion -lt [version]'7.3' -or $PSNativeCommandArgumentPassing -eq 'Legacy') {
    $nativeArguments = @($codexArguments | ForEach-Object { $_.Replace('"', '\"') })
}
if ($DryRun) {
    Write-Host 'DRY RUN: entorno cargado y doctor aprobado; no se inicia una sesion Codex.'
    Write-Host ('Codex: ' + ($versionOutput -join ' '))
    Write-Host ('& ''' + $codexPath + ''' ' + (($nativeArguments | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ' '))
    return
}
& $codexPath @nativeArguments
if ($LASTEXITCODE -ne 0) { throw 'FAIL: Codex termino con un codigo distinto de cero.' }
