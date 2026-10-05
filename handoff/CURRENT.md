# Estado actual

## Último objetivo

Implementar aislamiento Codex/MCP local del CRM sin alterar configuración global, Miriam, lógica funcional ni producción. Fecha: 2026-10-04. El commit base de normativa se publicó por solicitud del usuario; los nuevos cambios MCP quedan sin commit para revisión.

## Ya funciona

Implementado en el checkpoint de código: Agent V2, texto/audio, transcripción, contexto CRM, captura de activos, enriquecimiento público, handoff y alerta administrativa. No se volvió a validar contra servicios reales durante esta tarea.

## Trabajo en progreso

Normativa local y migración externa completadas. Lectura MCP real validada: supabase-edercreawebs listó schemas, ref configurado ycdosrsanutbhbgejwwg, read_only=true y supabase-miriam ausente del catálogo. Con Codex 0.159.2 el método validado es start.ps1 + CLI overrides. Se conserva .codex/config.toml declarativo. OpenCode sigue pendiente; configuración global intacta.

Launcher canónico implementado: cwd/raíz Git/remoto correctos, entorno externo sin imprimir valores, doctor obligatorio y descubrimiento automático de codex.exe (fecha UTC descendente, ruta ascendente para empates; omite candidatos inválidos y reparse points). Inicia con --no-daemon, --cd canónico y los tres overrides MCP. -DryRun pasó con codex-cli 0.159.2, entorno cargado y doctor exit 0; no abrió otra sesión.

Doctor corregido sin relajar controles: ValueFromRemainingArguments agrupaba los tokens Git en Windows PowerShell y causaba FAIL incluso con entorno cargado. El parámetro ahora recibe el array completo. La corrección en memoria pasó antes de editar. Pruebas en memoria confirman bloqueo por cwd incorrecto y FAIL de doctor; el argumento nativo conserva las comillas TOML.

Limitación adicional: codex mcp list con overrides en el entorno de herramientas de esta sesión reportó invalid transport para supabase-miriam; sin overrides ese proceso ve un catálogo distinto al config del usuario. No se cambió configuración global ni se añadió transporte ficticio. DryRun valida generación y controles; queda confirmar el launcher desde PowerShell normal sin abrir otra sesión desde esta automatización.

Validación MCP estática: TOML válido, doctor con entorno cargado sin FAIL y diez casos de comprobación aprobados (incluidos rechazo de Miriam habilitado, ref ajeno, falta de read-only y configuración ausente). Sin llamadas Supabase, login/logout ni cambios de confianza. Configuración global, entorno externo, .env.local, start.ps1 y archivo personal conservados por comparación de contenido.

Validación de normativa: carga externa y doctor sin FAIL; prueba de identidad prohibida rechazada. `git diff --check` sin errores. Lint detectó un error preexistente `react-hooks/set-state-in-effect` en `src/app/reset-password/page.tsx:24`; no se corrigió por estar fuera de alcance. Build no ejecutado porque se condicionó a lint correcto.

## Siguiente paso exacto

1. Revisar cambios sin commit. Desde PowerShell normal en la raíz ejecutar ./scripts/start.ps1 y comprobar el catálogo de la nueva sesión: EderCreaWebs disponible, Miriam ausente.
2. Agregar manualmente `OPENAI_API_KEY` al archivo externo para usar OpenAI localmente; cargar para comandos locales con `. ./scripts/start.ps1 -DryRun`.
3. Tras confirmar el launcher en consola normal, revisar/autorizar commit de este batch. Confirmar deploy y migraciones antes de operaciones remotas.
4. Tras resolver prerrequisitos, iniciar una tarea específica para Proposal Engine.

Proposal Engine planeado: usar contexto + enrichment; generar brief comercial; definir solución y vistas; preparar inputs/prompts; posteriormente generar aproximadamente cuatro vistas móviles; montar cotización HTML; ofrecer opciones comerciales; revisión/envío. Nada de ese motor se implementó en esta tarea.

## Archivos clave

- `PROJECT.md`, `PROJECT_SETUP.md`, `AGENTS.md`.
- `scripts/start.ps1`, `scripts/doctor.ps1`, `.env.example`.
- `.codex/config.toml` (sin credenciales; OAuth fuera del repo).
- `src/app/api/whatsapp/webhook/route.ts`.
- `src/lib/whatsapp/sales-agent.ts`, `audio.ts`, `asset-enrichment.ts`, `admin-alert.ts`.
- `supabase/migrations/20260927000100_whatsapp_handoff_task.sql` y `20260927000200_whatsapp_agent_v2_handoff_task.sql`.

## Riesgos / pendientes

- MCP global `supabase-miriam` sigue intacto: prohibido aquí y deshabilitado mediante overrides. Catálogo real validado en esta sesión; cada sesión nueva necesita comprobación. El proceso CLI de herramientas presenta la limitación de transporte descrita arriba.
- Entorno externo migrado durante la normativa; OpenAI requiere clave manual. `.env.local` original queda intacto.
- Typo histórico `WHATSAPP_GRAPH_API_VERSIO` en `.env.local`; corregido solo en archivo externo.
- Hostinger, variables productivas, callback Meta y migraciones remotas POR CONFIRMAR.
- Posible regresión de status durante handoff.
- Fiabilidad de Next.js `after()` depende del hosting.
- Firma del webhook opcional si falta `META_APP_SECRET`.
- Restricciones comerciales parcialmente basadas en instrucciones al modelo.

## Último checkpoint Git

- Rama: `feat/whatsapp-cloud-mvp`.
- Commit funcional sincronizado: `54c013bd23386b32724f0a74fcc441dfc60c92af`.
- Normativa base: `a6f66f8329c3cdd7a708058445f7b780c653a757`, publicada en origin/feat/whatsapp-cloud-mvp. Aislamiento MCP local todavía sin commit. Conservar `Nuevo Documento de texto.txt` sin seguimiento.

## No olvidar

Supabase único: `ycdosrsanutbhbgejwwg`. Secretos externos en `$HOME/.secrets/edercreawebs-crm.env`. Ejecutar doctor antes de operaciones importantes; FAIL exige abortar escrituras. No modificar producción, lógica, migraciones remotas, secretos originales ni archivo personal sin autorización. Documentos históricos quedan intactos.
