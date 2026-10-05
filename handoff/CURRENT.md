# Estado actual

## Checkpoint vigente — Proposal Prep Engine V1 (2026-10-05)

Implementado localmente y sin commit en feat/whatsapp-cloud-mvp. Repo/root/remoto confirmados; doctor mediante start.ps1 -DryRun pasó sin FAIL. Supabase único ycdosrsanutbhbgejwwg; catálogo efectivo contiene supabase-edercreawebs y no supabase-miriam. Solo se consultaron metadatos remotos: columnas, project_type y restricciones UNIQUE(lead_id,version) / UNIQUE(proposal_id,position) confirmadas. Sin escrituras remotas, migraciones ni despliegue.

### Implementación y decisiones

- Nuevo src/lib/whatsapp/proposal-prep.ts: prepareVisualProposalDraft({leadId,sourceAssetId}), schema strict Responses, validación local compartida y helpers puros. Modelo WHATSAPP_PROPOSAL_MODEL o gpt-5.6-sol; variable vacía añadida a .env.example.
- Entrada: lead comercial, últimos 40 mensajes textuales inbound/outbound cronológicos y referencias business_reference. Nunca incluye enrichment_profile de pending/processing/failed. Exige origen complete con perfil, what_sells/how_sells e inbound; faltantes de entrada producen automation failed reintentable.
- Salida: ProposalBrief generator proposal_prep_v1; project_type enum válido; business_summary, diagnosis, solution, visual_direction mobile_first=true, exactamente cuatro sections elegidas por el modelo y posiciones 1–4; missing_information, assumptions_to_avoid, confidence 0–1 y ready_for_visual_generation. Sin imágenes, HTML, quotes, pricing ni envío al prospecto.
- Persistencia: draft en visual_proposals con JSON direction_notes; cuatro visual_proposal_sections pending con brief JSON autónomo. Reutiliza/actualiza último draft propio no aprobado/enviado; otra última versión genera max+1. Upsert por proposal_id,position; relectura ante conflicto UNIQUE; compare-and-set de notas/status y verificación de cuatro briefs consistentes. No modifica lead.status: queda activos_recibidos porque todavía no hay imágenes.
- Trigger separado después de enrichBusinessReferenceAsset, fuera del catch de enrichment; también reintenta Prep si el asset ya estaba complete. Un fallo de Prep conserva complete, devuelve proposalPrep failed/retryable y registra automation_runs, sin contaminar el resultado del enriquecimiento.
- automation_runs workflow whatsapp-proposal-prep-v1, started → completed/failed; IDs/version/count/readiness, sin conversación ni secretos. Error seguro por etapa. Si la propia BD no permite registrar el run, solo puede registrarse un mensaje genérico local.
- sales-agent.ts confirma recepción, explica que la referencia ayudará a aterrizar una propuesta cercana al negocio y solo pregunta una incógnita comercial decisiva; sin pregunta de relleno, investigación afirmada ni plazos. Además oculta perfiles no complete del contexto del agente.

### Validación

- node --test scripts/test-proposal-prep.mjs: 9/9 aprobadas, sin red ni framework nuevo. Incluye cantidad/posiciones, project_type, campos extra/importes/colores, perfiles no complete, orden de mensajes, reutilización/versions/upsert, conflicto de inserción, JSON parseable, fallo parcial reparable y fallo de Prep tras enrichment fresco o ya complete. Revisión dirigida: save_asset_reference seguido por otro turno conserva Instagram pending/processing en el contexto sin exponer su perfil; dos runs leen vacío e intentan version 1, el perdedor recibe 23505, relee/reutiliza y ambos completan sin version 2; complete se persiste antes de Prep; cada brief conserva sección, dirección global y guardrails sin conversación. No se requirieron cambios funcionales adicionales; la prueba conversacional comprueba el contexto/instrucciones enviados, no una respuesta real del modelo.
- npx tsc --noEmit --incremental false: aprobado.
- Lint de archivos del batch: aprobado. npm run lint general conserva únicamente error preexistente react-hooks/set-state-in-effect en src/app/reset-password/page.tsx:24, fuera de alcance. Build no ejecutado.
- git diff --check: aprobado al cierre del batch.
- .env.local y Nuevo Documento de texto.txt conservados; sin nuevas dependencias ni modificaciones al bug de handoff.

### Riesgos y siguiente paso exacto

1. Revisar el diff local. No hay commit de este batch ni deploy autorizado.
2. Para validar OpenAI real, configurar la clave en el entorno externo y autorizar una prueba controlada con persistencia en el Supabase correcto. OPENAI_API_KEY sigue ausente en el entorno externo; las pruebas actuales usan dobles. Disponibilidad del modelo por cuenta no comprobada.
3. La persistencia entre proposal/sections/run no es transaccional: reintentar reparará fallos parciales. CAS/verificaciones detectan cambios concurrentes, pero no garantizan aislamiento completo frente a aprobación o generación en otro proceso entre operaciones. Antes del Visual Generator, definir coordinación/atomicidad si se ejecutarán workers concurrentes.
4. Reintento disponible invocando prepareVisualProposalDraft o enrichBusinessReferenceAsset sobre el asset complete; no hay scheduler durable ni cola nueva. Next.js after() sigue dependiendo del hosting. Si el lead completa contexto después del enrichment, hace falta un nuevo reintento.
5. Veracidad de texto, logos/fotos/servicios y readiness dependen también del modelo y de la calidad del enrichment. Código verifica colores de perfiles complete y patrones monetarios comunes, no demuestra todos los hechos ni detecta toda expresión posible de precio en texto libre. Revisión interna antes de generar/publicar visuales.
6. Visual Generator y Quote Generator NO implementados. El siguiente batch debe usar estos briefs para producir las cuatro vistas y solo entonces considerar avanzar propuesta_visual.

## Checkpoint anterior — aislamiento MCP (histórico)

Lo siguiente conserva antecedentes. El checkpoint vigente y sus siguientes pasos están arriba; la planificación antigua de Proposal Engine queda reemplazada por Prep V1.

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
