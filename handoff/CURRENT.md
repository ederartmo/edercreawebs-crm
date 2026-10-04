# Estado actual

## Último objetivo

Instalar identidad, contexto y seguridad multi-proyecto sobre la copia sincronizada, sin cambiar lógica funcional ni producción. Fecha: 2026-10-04. Revisión aprobada; cierre mediante commit local `chore: standardize project environment and agent setup`, sin push.

## Ya funciona

Implementado en el checkpoint de código: Agent V2, texto/audio, transcripción, contexto CRM, captura de activos, enriquecimiento público, handoff y alerta administrativa. No se volvió a validar contra servicios reales durante esta tarea.

## Trabajo en progreso

Normativa local y migración externa de entorno completadas. Aislamiento MCP/Codex y OpenCode pendiente; no se crearon configuraciones locales.

Validación de normativa: carga externa y doctor sin FAIL; prueba de identidad prohibida rechazada. `git diff --check` sin errores. Lint detectó un error preexistente `react-hooks/set-state-in-effect` en `src/app/reset-password/page.tsx:24`; no se corrigió por estar fuera de alcance. Build no ejecutado porque se condicionó a lint correcto.

## Siguiente paso exacto

1. Revisar el checkpoint local y autorizar push en una tarea posterior si corresponde; este batch no hace push.
2. Agregar manualmente `OPENAI_API_KEY` al archivo externo para usar OpenAI localmente; cargar con `. ./scripts/start.ps1`.
3. Confirmar aislamiento MCP, deploy y migraciones con identidad correcta antes de operaciones remotas.
4. Tras resolver prerrequisitos, iniciar una tarea específica para Proposal Engine.

Proposal Engine planeado: usar contexto + enrichment; generar brief comercial; definir solución y vistas; preparar inputs/prompts; posteriormente generar aproximadamente cuatro vistas móviles; montar cotización HTML; ofrecer opciones comerciales; revisión/envío. Nada de ese motor se implementó en esta tarea.

## Archivos clave

- `PROJECT.md`, `PROJECT_SETUP.md`, `AGENTS.md`.
- `scripts/start.ps1`, `scripts/doctor.ps1`, `.env.example`.
- `src/app/api/whatsapp/webhook/route.ts`.
- `src/lib/whatsapp/sales-agent.ts`, `audio.ts`, `asset-enrichment.ts`, `admin-alert.ts`.
- `supabase/migrations/20260927000100_whatsapp_handoff_task.sql` y `20260927000200_whatsapp_agent_v2_handoff_task.sql`.

## Riesgos / pendientes

- MCP global `supabase-miriam` apunta a otro proyecto: prohibido usarlo aquí.
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
- Checkpoint de normativa: commit que incorpora este handoff, mensaje `chore: standardize project environment and agent setup`; consultar su SHA con Git. Conservar `Nuevo Documento de texto.txt` sin seguimiento.

## No olvidar

Supabase único: `ycdosrsanutbhbgejwwg`. Secretos externos en `$HOME/.secrets/edercreawebs-crm.env`. Ejecutar doctor antes de operaciones importantes; FAIL exige abortar escrituras. No modificar producción, lógica, migraciones remotas, secretos originales ni archivo personal sin autorización. Documentos históricos quedan intactos.
