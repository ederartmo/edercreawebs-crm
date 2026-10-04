# Mapa técnico seguro

## Identidad

- Proyecto: EderCreaWebs CRM / WhatsApp Agent.
- Ruta canónica local: `C:\Users\EderArtMo\Documents\edercreawebs-crm`.
- Repo/remoto: `ederartmo/edercreawebs-crm`, `https://github.com/ederartmo/edercreawebs-crm.git`.
- Rama de trabajo: `feat/whatsapp-cloud-mvp`; principal: `main`.
- Supabase autorizado: `ycdosrsanutbhbgejwwg`, URL pública `https://ycdosrsanutbhbgejwwg.supabase.co`.
- Prohibido para este CRM: MCP `supabase-miriam` / ref `rkqfloazqjsprbqhgnix`.
- No hay aislamiento MCP local instalado. No crear `.codex/config.toml` ni `opencode.jsonc` hasta verificar cómo aislar herramientas sin alterar la configuración global.

## Runtime y comandos

Next.js 16.x, React 19.x, TypeScript 6.x, Supabase JS 2.x y Tailwind 4.x. Node.js >=20.9 según documentación existente; CI usa Node 20. Versiones resueltas: consultar `package-lock.json`. Las dependencias se declaran como `latest`; no actualizar el lock sin una tarea específica.

Desde la raíz, en PowerShell:

```powershell
. ./scripts/start.ps1
./scripts/doctor.ps1
npm run dev
npm run lint
npm run build
npm run start
```

`start.ps1` importa al proceso actual variables no vacías del archivo externo, sin mostrar valores, y ejecuta doctor. Puede ejecutarse también con `-SkipDoctor`, debiendo revisar doctor antes de operaciones importantes. Dot-source mantiene la sesión en la raíz del proyecto. Un proceso PowerShell hijo no puede cargar variables en su proceso padre.

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
