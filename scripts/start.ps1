[CmdletBinding()]
param([switch]$SkipDoctor)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')
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
if (-not $SkipDoctor) {
    & (Join-Path $PSScriptRoot 'doctor.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'FAIL: Doctor rechazo el entorno. ABORTAR ESCRITURAS.' }
}
