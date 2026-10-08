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
    param([string[]]$Arguments)
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

function CheckLocalMcp {
    $configPath = Join-Path $projectRoot '.codex/config.toml'
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        Report FAIL 'Falta .codex/config.toml; aislamiento MCP obligatorio.'
        return
    }
    Report OK 'Configuracion MCP local existe.'
    # Deliberately accept only the small audited schema; do not evaluate TOML as code.
    # Full TOML syntax validation is separate. Unknown keys/tables fail closed.
    $tables = @{}
    $section = ''
    foreach ($line in [IO.File]::ReadAllLines($configPath)) {
        if ($line -match '^\s*(#|$)') { continue }
        if ($line -match '^\s*\[mcp_servers\.(supabase-miriam|supabase-edercreawebs)\]\s*$') {
            $section = $Matches[1]
            if ($tables.ContainsKey($section)) { Report FAIL 'Tabla MCP duplicada; contenido omitido.'; return }
            $tables[$section] = @{}
            continue
        }
        if (-not $section -or $line -notmatch '^\s*(enabled|url)\s*=\s*(.+?)\s*$') {
            Report FAIL 'Configuracion MCP fuera del esquema seguro aprobado; contenido omitido.'
            return
        }
        $key = $Matches[1]; $literal = $Matches[2]
        if ($tables[$section].ContainsKey($key)) { Report FAIL 'Clave MCP duplicada; contenido omitido.'; return }
        if ($key -eq 'enabled' -and $literal -match '^(true|false)$') {
            $tables[$section][$key] = $literal -eq 'true'
        } elseif ($key -eq 'url' -and $literal -match '^"([^"\\]*)"$') {
            $tables[$section][$key] = $Matches[1]
        } else { Report FAIL 'Valor MCP no admitido; contenido omitido.'; return }
    }
    if (-not $tables.ContainsKey('supabase-miriam') -or -not $tables['supabase-miriam'].ContainsKey('enabled') -or $tables['supabase-miriam']['enabled'] -ne $false) {
        Report FAIL 'Miriam no esta explicitamente disabled localmente.'
    } elseif ($tables['supabase-miriam'].Count -ne 1) {
        Report FAIL 'La tabla de Miriam solo debe deshabilitar el servidor heredado.'
    } else { Report OK 'Miriam disabled en configuracion local.' }
    if (-not $tables.ContainsKey('supabase-edercreawebs')) {
        Report FAIL 'Falta MCP supabase-edercreawebs.'
        return
    }
    $crm = $tables['supabase-edercreawebs']
    if (-not $crm.ContainsKey('enabled') -or $crm['enabled'] -ne $true) { Report FAIL 'MCP EderCreaWebs no esta enabled.' }
    else { Report OK 'MCP EderCreaWebs enabled.' }
    if (-not $crm.ContainsKey('url')) { Report FAIL 'Falta URL MCP del CRM.' }
    elseif ($crm['url'] -ne "https://mcp.supabase.com/mcp?project_ref=$expectedRef&read_only=true") {
        if ($crm['url'] -match $forbiddenRef) { Report FAIL 'MCP local apunta al proyecto prohibido de Miriam.' }
        Report FAIL 'URL MCP distinta de la autorizada: requiere endpoint propio, project_ref correcto y read_only=true; valor omitido.'
    } else {
        Report OK "MCP project_ref correcto: $expectedRef."
        Report OK 'MCP read_only=true; sin credenciales locales.'
    }

    $trusted = $false
    if ($HOME) {
        $globalPath = Join-Path $HOME '.codex/config.toml'
        if (Test-Path -LiteralPath $globalPath -PathType Leaf) {
            $projectSection = $false
            foreach ($line in [IO.File]::ReadAllLines($globalPath)) {
                if ($line -match '^\s*\[') {
                    $projectSection = $false
                    if ($line -match '^\s*\[projects\.["'']([^"'']+)["'']\]\s*$') {
                        $declaredRoot = $Matches[1].Replace('\\', '\').TrimEnd('\', '/')
                        $projectSection = $declaredRoot -eq $projectRoot
                    }
                } elseif ($projectSection -and $line -match '^\s*trust_level\s*=\s*"trusted"\s*$') { $trusted = $true }
            }
        }
    }
    if ($trusted) { Report OK 'Entrada explicita trusted encontrada para este repo en configuracion del usuario.' }
    else { Report WARN 'Sin entrada explicita trusted verificable para el repo; el cliente debe confirmar confianza para aplicar la capa local.' }
    Report WARN 'OAuth MCP no comprobado; autenticar desde el cliente solo si lo solicita.'
    Report WARN 'Recarga de la app y catalogo efectivo de sesiones abiertas no comprobados; validar en una sesion nueva del repo.'
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
    CheckLocalMcp
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
    Report WARN 'MCP global supabase-miriam prohibido; confirmar exclusion efectiva en el catalogo del cliente antes de usar Supabase.'
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
