# Reglas operativas

Lee primero `PROJECT.md`, `PROJECT_SETUP.md` y `handoff/CURRENT.md`.
Ejecuta o revisa `scripts/doctor.ps1` antes de operaciones importantes; un FAIL exige abortar escrituras.
Confirma root Git, remoto `ederartmo/edercreawebs-crm`, rama e infraestructura antes de escribir.
Este CRM usa únicamente Supabase `ycdosrsanutbhbgejwwg`. No uses el MCP global `supabase-miriam` ni `rkqfloazqjsprbqhgnix`; no uses configuraciones de otros proyectos.
Antes de usar herramientas Supabase, verifica que el catálogo efectivo contiene `supabase-edercreawebs` y no `supabase-miriam`; si no puedes confirmarlo, no uses esas herramientas.

El agente conversa y razona; el código protege acciones de negocio.

- Nunca imprimas secretos ni los copies a archivos versionados. Lee sus valores solo cuando sea necesario para ejecución local o comprobación segura de identidad.
- Carga el entorno propio desde `$HOME/.secrets/edercreawebs-crm.env`; nunca inventes IDs, refs, endpoints ni configuración.
- Respeta Next.js/TypeScript y las herramientas controladas del agente. Mantén cambios pequeños y trazables, sin refactors fuera del objetivo.
- Antes de modificar producción, verifica la identidad y cuenta con autorización explícita para la operación.
- Actualiza `handoff/CURRENT.md` antes de dejar trabajo importante incompleto.
- La migración inicial conserva `.env.local` y `Nuevo Documento de texto.txt`; no los alteres sin autorización posterior.
