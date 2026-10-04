[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$script:failureCount = 0
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')
$expectedRef = 'ycdosrsanutbhbgejwwg'
$forbiddenRef = 'rkqfloazqjsprbqhgnix'
function Report([string]$Level, [string]$Message) {
    Write-Host "$Level $Message"
    if ($Level -eq 'FAIL') { $script:failureCount++ }
}
function ProjectGit {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & git -c "safe.directory=$projectRoot" -C $projectRoot @Arguments 2>$null
}
function ReadEnvironment([string]$Path) {
    $values = @{}
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $values }
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        if ($line -match '^\s*(#|$)') { continue }
        if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
            Report WARN 'Linea de entorno no soportada (contenido omitido).'
            continue
        }
        $name = $Matches[1]; $value = $Matches[2].Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        } else { $value = ($value -replace '\s+#.*$', '').Trim() }
        if ($value.Trim()) { $values[$name] = $value }
    }
    return $values
}
function CheckSupabase([hashtable]$Values, [string]$Source) {
    foreach ($name in $Values.Keys) {
        if ($name -match 'SUPABASE' -and $Values[$name] -match $forbiddenRef) {
            Report FAIL "Identidad prohibida de Miriam en $Source ($name)."
        }
        if ($name -match 'SUPABASE' -and $name -match 'URL|REF|PROJECT' -and $Values[$name] -match 'https://([a-z0-9]+)\.supabase\.co') {
            if ($Matches[1] -ne $expectedRef) { Report FAIL "Supabase mismatch en $Source ($name). Esperado: $expectedRef; detectado: $($Matches[1])." }
        }
        if ($name -match 'SUPABASE.*(?:REF|PROJECT_ID)$' -and $Values[$name] -ne $expectedRef) {
            Report FAIL "Supabase ref distinto al autorizado en $Source ($name), valor omitido."
        }
    }
    if ($Values.ContainsKey('NEXT_PUBLIC_SUPABASE_URL')) {
        if ($Values['NEXT_PUBLIC_SUPABASE_URL'].TrimEnd('/') -eq "https://$expectedRef.supabase.co") {
            Report OK "Supabase correcto en $Source."
        } else { Report FAIL "URL Supabase no autorizada en $Source (valor omitido)." }
    }
}

try {
    $currentRoot = & git -c "safe.directory=$projectRoot" rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath([string]$currentRoot).TrimEnd('\', '/') -ne $projectRoot) {
        Report FAIL 'Repo incorrecto: ejecutar doctor dentro de este proyecto.'
        throw 'identity-stop'
    }
    Report OK 'Raiz Git correcta.'
    $remote = ProjectGit @('remote', 'get-url', 'origin')
    if ($LASTEXITCODE -ne 0 -or $remote -notmatch '^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)ederartmo/edercreawebs-crm(?:\.git)?$') {
        Report FAIL 'Remote incorrecto (valor omitido).'
    } else { Report OK 'Repo/remoto correcto: ederartmo/edercreawebs-crm.' }
    $branch = ProjectGit @('branch', '--show-current')
    if ($branch -eq 'feat/whatsapp-cloud-mvp') { Report OK "Rama: $branch." }
    else { Report WARN 'Rama distinta de feat/whatsapp-cloud-mvp o HEAD detached.' }
    $status = @(ProjectGit @('status', '--porcelain'))
    if ($status.Count) { Report WARN "Working tree con $($status.Count) entradas; revisar git status." }
    else { Report OK 'Working tree limpio.' }

    $local = ReadEnvironment (Join-Path $projectRoot '.env.local')
    $external = @{}
    if ($HOME) {
        $externalPath = Join-Path $HOME '.secrets/edercreawebs-crm.env'
        if (Test-Path -LiteralPath $externalPath -PathType Leaf) {
            $external = ReadEnvironment $externalPath
            Report OK 'Archivo externo de entorno existe fuera del repo.'
        } else { Report WARN 'Archivo externo de entorno ausente.' }
    } else { Report WARN 'HOME no disponible.' }
    $processValues = @{}
    foreach ($entry in [Environment]::GetEnvironmentVariables('Process').GetEnumerator()) {
        if ($entry.Key -match 'SUPABASE|^OPENAI_|^WHATSAPP_|^META_|^CRM_') { $processValues[$entry.Key] = [string]$entry.Value }
    }
    CheckSupabase $local '.env.local'
    foreach ($envFile in Get-ChildItem -LiteralPath $projectRoot -Force -File -Filter '.env*') {
        if ($envFile.Name -notin @('.env.local', '.env.example')) {
            CheckSupabase (ReadEnvironment $envFile.FullName) $envFile.Name
            Report WARN "Otro archivo de entorno presente: $($envFile.Name); revisar precedencia antes de ejecutar."
        }
    }
    CheckSupabase $external 'archivo externo'
    CheckSupabase $processValues 'proceso'
    $effective = @{}
    foreach ($name in $local.Keys) { $effective[$name] = $local[$name] }
    foreach ($name in $processValues.Keys) { if ($processValues[$name].Trim()) { $effective[$name] = $processValues[$name] } }
    if (-not $effective.ContainsKey('NEXT_PUBLIC_SUPABASE_URL')) { Report FAIL 'No se puede confirmar identidad Supabase activa.' }
    foreach ($name in @('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRM_OWNER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_GRAPH_API_VERSION', 'META_APP_SECRET', 'OPENAI_API_KEY')) {
        if ($effective.ContainsKey($name) -and $effective[$name].Trim()) { Report OK "$name disponible (valor omitido)." }
        else { Report WARN "$name ausente en entorno activo; revisar start.ps1 y archivo externo." }
    }
    if ($local.ContainsKey('WHATSAPP_GRAPH_API_VERSIO')) { Report WARN 'Typo historico WHATSAPP_GRAPH_API_VERSIO en .env.local; original conservado.' }
    foreach ($name in @('WHATSAPP_ADMIN_PHONE','CRM_BASE_URL','WHATSAPP_AGENT_MODEL','WHATSAPP_ENRICHMENT_MODEL','OPENAI_TRANSCRIPTION_MODEL','OPENAI_VISION_MODEL','OPENAI_DOCUMENT_MODEL','WHATSAPP_CLASSIFIER_MODEL')) {
        if (-not $effective.ContainsKey($name)) { Report WARN "Variable opcional $name ausente; consultar defaults y usos en PROJECT_SETUP.md." }
    }

    $tracked = @(ProjectGit @('ls-files'))
    if ($LASTEXITCODE -ne 0) { throw 'git-files-unavailable' }
    $failuresBeforeSecrets = $script:failureCount
    foreach ($file in $tracked) {
        if ($file -match '(^|/)(\.env(?:\..*)?|\.secrets(?:/|$))' -and $file -ne '.env.example') { Report FAIL "Archivo sensible trackeado: $file." }
        if ($file -match '\.(pem|key)$') { Report FAIL "Material de clave trackeado: $file." }
    }
    $linkedRefFile = Join-Path $projectRoot 'supabase/.temp/project-ref'
    if (Test-Path -LiteralPath $linkedRefFile -PathType Leaf) {
        if ([IO.File]::ReadAllText($linkedRefFile).Trim() -ne $expectedRef) { Report FAIL 'Supabase CLI enlazado a otro proyecto (valor omitido).' }
        else { Report OK 'Enlace CLI Supabase correcto.' }
    } else { Report WARN 'Supabase CLI sin enlace local verificable.' }
    $tokenPattern = 'sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|EAA[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
    foreach ($file in $tracked) {
        $path = Join-Path $projectRoot $file
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
        $text = [IO.File]::ReadAllText($path)
        if ($text -match $tokenPattern) { Report FAIL "Posible token/clave hardcodeado: $file (valor omitido; requiere revision)." }
        if ($file -match '(^|/)(\.codex/config\.toml|opencode\.jsonc?|\.mcp\.json|supabase/\.temp/project-ref)$' -and $text -match $forbiddenRef) {
            Report FAIL "Configuracion local apunta a Miriam: $file."
        }
    }
    if ($script:failureCount -eq $failuresBeforeSecrets) { Report OK 'Sin archivos sensibles trackeados ni patrones claros de tokens en archivos versionados.' }
    foreach ($probe in @('.env', '.env.local', '.env.production', '.env.audit-probe', '.secrets/audit-probe', 'audit-probe.pem', 'audit-probe.key')) {
        ProjectGit @('check-ignore', '--quiet', '--no-index', '--', $probe) | Out-Null
        if ($LASTEXITCODE -eq 0) { Report OK "Ignorado: $probe." }
        else { Report FAIL "Archivo sensible no cubierto por ignores: $probe." }
    }
    ProjectGit @('check-ignore', '--quiet', '--no-index', '--', '.env.example') | Out-Null
    if ($LASTEXITCODE -eq 1) { Report OK '.env.example permanece versionable.' }
    else { Report FAIL '.env.example esta ignorado o no se pudo verificar.' }
    Report WARN 'El escaneo de tokens usa patrones; no garantiza ausencia de secretos ni revisa historial.'
    Report WARN 'MCP global supabase-miriam prohibido; aislamiento local aun pendiente. No usarlo para este CRM.'
    Report WARN 'Hosting/callback Meta/variables productivas y migraciones remotas POR CONFIRMAR; sin llamadas remotas.'
} catch {
    if ($_.Exception.Message -ne 'identity-stop') { Report FAIL 'No se pudo completar una verificacion; detalle omitido para proteger valores.' }
}
if ($script:failureCount -gt 0) {
    Write-Host "FAIL $script:failureCount verificaciones fallidas. ABORTAR ESCRITURAS."
    exit 1
}
Write-Host 'OK Doctor completado sin FAIL. Revisar WARN antes de operar.'
exit 0
