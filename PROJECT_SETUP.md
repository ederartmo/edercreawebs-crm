# Mapa técnico seguro

## Identidad

- Proyecto: EderCreaWebs CRM / WhatsApp Agent.
- Ruta canónica local: `C:\Users\EderArtMo\Documents\edercreawebs-crm`.
- Repo/remoto: `ederartmo/edercreawebs-crm`, `https://github.com/ederartmo/edercreawebs-crm.git`.
- Rama de trabajo: `feat/whatsapp-cloud-mvp`; principal: `main`.
- Supabase autorizado: `ycdosrsanutbhbgejwwg`, URL pública `https://ycdosrsanutbhbgejwwg.supabase.co`.
- Prohibido para este CRM: MCP `supabase-miriam` / ref `rkqfloazqjsprbqhgnix`.
- Codex MCP local: `.codex/config.toml`; permite `supabase-edercreawebs` con ref `ycdosrsanutbhbgejwwg`, modo inicial read-only, y deshabilita explícitamente `supabase-miriam` dentro del CRM. La configuración global queda intacta. OpenCode sigue pendiente.

## Aislamiento Codex/MCP

El método validado con Codex 0.159.2 es `start.ps1` + CLI overrides. El launcher carga el entorno propio, exige doctor sin FAIL e inicia Codex con `--no-daemon`, `--cd` canónico y estos overrides:

```text
mcp_servers.supabase-miriam.enabled=false
mcp_servers.supabase-edercreawebs.enabled=true
mcp_servers.supabase-edercreawebs.url="https://mcp.supabase.com/mcp?project_ref=ycdosrsanutbhbgejwwg&read_only=true"
```

Se conserva `.codex/config.toml` como configuración declarativa y protección de la intención del proyecto; los overrides evitan depender de su aplicación por Codex 0.159.2. OAuth del cliente permanece fuera del repo, independiente del entorno de aplicación. El launcher no modifica configuración global ni autentica MCP.

La capa local solo se aplica cuando Codex considera confiable este proyecto. Abrir un chat asociado a otra carpeta, o ejecutar comandos dentro del CRM desde ese chat, no lo convierte automáticamente en una sesión del CRM. Abre/inicia Codex con este repo como workspace/directorio del proyecto.

La lectura MCP real ya funcionó: EderCreaWebs disponible, Miriam ausente, ref configurado `ycdosrsanutbhbgejwwg` y `read_only=true`. Cada sesión nueva debe comprobar su catálogo activo antes de usar Supabase. Acepta confianza/OAuth solo si el cliente lo solicita; no cambies confianza ni autenticación global automáticamente.

Doctor comprueba estáticamente la configuración local conservadora (solo las dos tablas MCP aprobadas, valores simples y sin credenciales). No sustituye la comprobación del catálogo, la autenticación ni la recarga de una app ya abierta. La validación TOML completa se ejecutó por separado al instalar esta configuración.

## Runtime y comandos

Next.js 16.x, React 19.x, TypeScript 6.x, Supabase JS 2.x y Tailwind 4.x. Node.js >=20.9 según documentación existente; CI usa Node 20. Versiones resueltas: consultar `package-lock.json`. Las dependencias se declaran como `latest`; no actualizar el lock sin una tarea específica.

Desde la raíz, en PowerShell:

Entrada humana recomendada en Windows: doble clic en `ABRIR_CODEX.cmd` desde el Explorador. Entrada manual alternativa: `./scripts/start.ps1`. El `.cmd` usa su propia carpeta como cwd y delega toda la lógica a `start.ps1` mediante Windows PowerShell. Para probar sin abrir Codex: `./ABRIR_CODEX.cmd -DryRun`.

```powershell
./scripts/start.ps1           # launcher canónico
./scripts/start.ps1 -DryRun   # valida sin abrir sesión Codex
./scripts/doctor.ps1
npm run dev
npm run lint
npm run build
npm run start
```

`start.ps1` exige cwd canónico y valida raíz Git/remoto. Importa variables no vacías del archivo externo sin mostrar valores y siempre ejecuta doctor. Se elimina `-SkipDoctor`: un FAIL bloquea el descubrimiento e inicio de Codex. `-DryRun` ejecuta los mismos controles y muestra el comando, omitiendo la sesión interactiva. Dot-source con `-DryRun` conserva el entorno para comandos Next.js; un proceso hijo no puede cargar variables en su padre.

Descubre `codex.exe` en las instalaciones hijas de `$HOME\AppData\Local\OpenAI\Codex\bin`, excluyendo reparse points. Elige el primer ejecutable válido (`--version` exitoso), ordenado por `LastWriteTimeUtc` descendente y ruta completa ascendente en empates. No fija hashes de instalación. Si no hay instalación válida, termina con error. Ajusta las comillas TOML al paso de argumentos nativos en Windows PowerShell 5.1 y PowerShell moderno.

`doctor.ps1` es de solo lectura: OK/WARN/FAIL, devuelve exit code 1 con FAIL y recomienda abortar escrituras. No consulta servicios remotos. WARN requiere evaluación antes de operar. La rama diferente y cambios locales son WARN; identidad equivocada o secretos versionados son FAIL.

## Entorno y secretos

Archivo propio: `$HOME\.secrets\edercreawebs-crm.env`, fuera de Git. `.env.example` contiene solo nombres, asignaciones vacías y comentarios seguros.

Variables:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- CRM: `CRM_OWNER_ID`, `CRM_BASE_URL`.
- WhatsApp: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_ADMIN_PHONE`.
- Meta: `META_APP_SECRET`.
- OpenAI: `OPENAI_API_KEY`, `WHATSAPP_AGENT_MODEL`, `WHATSAPP_ENRICHMENT_MODEL`, `OPENAI_TRANSCRIPTION_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_DOCUMENT_MODEL`.
- Legado: `WHATSAPP_CLASSIFIER_MODEL` (clasificador no usado por el flujo conversacional V2).

Defaults de código: agente/enrichment `gpt-5.6-sol`; transcripción `gpt-4o-mini-transcribe`; clasificador legado `gpt-4o-mini`. Los overrides de modelos son opcionales. Admin phone/base URL son opcionales para avisos completos.

La migración externa no modifica `.env.local`. Corrige únicamente en el destino `WHATSAPP_GRAPH_API_VERSIO` a `WHATSAPP_GRAPH_API_VERSION`. `OPENAI_API_KEY` debe agregarse manualmente al archivo externo: no había valor local disponible. No pegues secretos en documentación ni mensajes.

Next.js todavía lee `.env.local`: conservarlo es una medida transitoria. Iniciar mediante `start.ps1` carga variables del proceso antes de arrancar Next.js. El cargador no borra ni sobrescribe variables con entradas vacías; doctor detecta faltantes y discrepancias de identidad, pero no prueba que cada token pertenezca a su cuenta.

## Servicios, rutas y despliegue

Servicios: Supabase, Meta WhatsApp Cloud API, OpenAI Responses/transcripción, Hostinger.
Hosting conocido: Hostinger; URL conocida `https://dimgrey-hummingbird-463136.hostingersite.com`.
Webhook `GET/POST /api/whatsapp/webhook`; callback conocido derivado de esa URL.

**POR CONFIRMAR:** despliegue real Hostinger, variables productivas, callback Meta vigente y migraciones aplicadas remotamente. No ejecutar migraciones ni publicar durante la instalación de la normativa.

Tablas referenciadas: `contacts`, `businesses`, `leads`, `conversations`, `messages`, `assets`, `tasks`, `payments`, `meetings`, `quotes`, `automation_runs`, `lead_status_history`; vista `crm_inbox`. Migraciones en `supabase/migrations`; parches históricos en raíz. Su existencia local no confirma su aplicación remota.

Rutas CRM: `/hoy`, `/pipeline`, `/conversaciones`, `/leads`, `/tareas`, `/importar-whatsapp`. APIs: `/api/analyze-lead`, `/api/analyze-image`, `/api/analyze-pdf`, `/api/transcribe` y webhook.

CI ejecuta lint/build para main y PR hacia main. Desarrollo y build usan webpack. Para estado actual usa `handoff/CURRENT.md`; documentación histórica puede describir fases previas.
