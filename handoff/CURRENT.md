# Estado actual

## Checkpoint vigente — Intake V1 local (2026-10-05)

### Corrección del bloqueo web-only — lista para revisión de commit

Web es el camino principal. Una sesión parcial no crea CRM; una sesión ready crea contacto, negocio cuando corresponde, lead y tarea «Revisar proyecto y preparar cotización», vincula la sesión y vacía staging en una transacción. human_required=true, bot pausado e intake.ready_for_quote registran la recepción lista; no cambia lead_status. Guardados finales repetidos y recargas son idempotentes. GET reconcilia una finalización interrumpida; un fallo de tarea revierte todos los inserts CRM y conserva respuestas para reintento.

La migración sigue siendo el MISMO archivo local no aplicado: ahora permite contacts.phone=NULL para email-only y separa teléfono web declarado de transporte verificado. No inventa teléfonos ni asocia contactos existentes por datos no verificados del navegador. Cambios de tipos nullable en hoy/leads/pipeline, sin nueva UI. Si al verificar ECW ya existe un contacto con ese teléfono, se conserva el mismo lead, se usan los datos confirmados y se conserva el contacto web original para reconciliación (intake.submitted_contact_id), sin borrar datos CRM.

ECW puede emitirse después de completar web. El webhook resuelve la sesión transaccionalmente ANTES de get-or-create y usa su lead exacto, aunque exista otro más reciente. La misma fila de sesión serializa materialización y continuidad. Firma, owner, vigencia y coincidencia de teléfono obligatorios; web completo email-only puede vincular el primer remitente firmado mediante su capacidad secreta. Una vez vinculado, solo ese remitente puede reintentar el código hasta expirar/rotar. Inválido/expirado no crea un lead alterno. Web listo llega a WhatsApp sin preguntas ni llamada al modelo. First-touch/source se conservan; last_channel/whatsapp_verified_at y último referral registran el paso posterior.

Validación de esta corrección: **64/64 pruebas, cero skipped** (las 45 anteriores + 19 nuevas en `scripts/test-intake-web-crm.mjs`), PostgreSQL local en memoria y proveedores simulados. Incluye los diez casos pedidos, email-only, propietario/remitente incorrectos, ECW vencido/repetido, rollback, recuperación GET y elección exacta del lead frente a otro reciente. TypeScript y ESLint del batch aprobados; git diff --check aprobado. No hubo cambios remotos, llamadas reales, nuevas dependencias del CRM, commit, push ni deploy. Proposal Prep sigue congelado y Visual Generator intacto.

Recomendación: aprobar para commit del batch local tras revisar diff/migración. La aplicación remota y publicación siguen requiriendo autorización posterior. Antes de publicar, probar concurrencia multiconexión e integración aislada real. Ya NO queda pendiente materializar web-only ni crear su tarea; los pendientes de UI, uploads, retención y antiabuso siguen vigentes.

El objetivo comercial cambia a atención + intake + calificación → READY FOR QUOTE → Eder revisa y prepara propuesta manualmente. Proposal Prep automático y Visual Generator quedan congelados. No ejecutar el helper Bruma mencionado en los checkpoints históricos de abajo.

Repo/root/remoto confirmados, rama `feat/whatsapp-cloud-mvp`, HEAD `adb3014a1c4192dc567d0f0d658096f95f94caee`. Doctor sin FAIL con entorno propio cargado; catálogo efectivo incluye supabase-edercreawebs y no supabase-miriam. Solo consultas remotas de metadatos a ycdosrsanutbhbgejwwg. Sin commit, push, deploy, escrituras remotas ni llamadas reales a Meta/OpenAI.

Cambios previos conservados: este handoff ya estaba modificado; `Nuevo Documento de texto.txt`, `handoff/visual-internal-screen-1.png`, `handoff/visual-internal-smoke.json` y `scripts/visual-internal-smoke.mjs` estaban sin seguimiento. No se modificaron ni agregaron a Git los cuatro archivos; `.env.local` intacto. El contenido histórico del handoff se conserva debajo.

### Implementado

- Dominio reutilizable `src/lib/intake`: normalización, fill-only merge, readiness de ocho requisitos, completion/missing/known, presupuesto como rango, atribución allowlist, tokens seguros y servicio canónico.
- Reutiliza contacts/businesses/leads/assets. Migración **solo local** `20261005200629_intake_v1.sql`: leads.intake (campos sin equivalente), intake_sessions (staging web anónimo) y RPCs service-only con RLS/permisos explícitos. No cambia enums ni pricing. Al vincular, copia a columnas semánticas existentes y vacía el staging.
- `/api/intake/session`: create/save/GET/continue, cookie HttpOnly aleatoria con hash persistido, TTL 30 días, validación de origen/payload/allowlist, límite durable de creación, deshabilitado por defecto. No acepta lead_id/owner_id del cliente. Web ready materializa automáticamente; después devuelve solo acuse y permite continuidad ECW de 96 bits/24h ligada a un remitente verificado. Navegador vinculado no puede leer/editar el lead.
- Agente recibe known_fields/missing_fields/ready_for_quote; guarda respuestas explícitas y responde FAQs. Código añade una sola pregunta faltante. Ready produce cierre fijo y RPC atómica: human_required, bot pausado, resumen y tarea única. No escribe status. El handoff anterior también deja de degradar a calificado.
- First-touch UTM/Meta inmutable; último referral adicional separado y no borrado por mensajes sin referral. Payload persistido reducido, código ECW retirado. Firma Meta ahora obligatoria para POST del webhook.
- Auto-trigger de Proposal Prep protegido por `WHATSAPP_PROPOSAL_PREP_ENABLED=false`; Visual Generator intacto y `WHATSAPP_VISUAL_GENERATION_ENABLED=false`. No se generaron propuestas ni imágenes.

### Validación

- 64/64 pruebas aprobadas: `test-intake.mjs`, `test-intake-sql.mjs`, `test-intake-web-crm.mjs`, `test-proposal-prep.mjs`, `test-visual-generator.mjs`. Sin proveedor real. SQL aplica baseline/handoff/Intake localmente y valida además web-only → CRM y continuidad al mismo lead.
- PGlite instalado temporalmente fuera del repositorio con autorización; no cambian package.json/lock. Para repetir SQL establecer ECW_PGLITE_MODULE al módulo temporal. Sin esa variable la prueba SQL es skipped; en esta validación sí se ejecutó.
- `npx tsc --noEmit --incremental false`: aprobado. ESLint solo del batch: aprobado. `git diff --check`: aprobado. Error general de reset-password histórico fuera de alcance; no se ejecutó lint global/build ni se corrigió.

### Siguiente paso

Revisar diff y [contrato detallado de Intake](INTAKE_V1.md). Antes de publicar hace falta autorizar/aplicar la migración, configurar origen y probar integración aislada con servicios reales. No activar flags visuales. Web Onboarding V1 pendiente: UI de preguntas, botón WhatsApp y uploads; políticas de retención y antiabuso del hosting. Meta Lead Ads: permisos/webhook, mapeo, identidad e idempotencia futuros usando el mismo contrato. No hay cotización, pricing, HTML/PDF, email, landing ni webchat nuevos.

Limitaciones: extracción/FAQ libre dependen del modelo y requieren evaluación conversacional real; readiness es determinístico sobre datos capturados. Idempotencia se garantiza por sesión; no se fusionan automáticamente sesiones distintas por email/nombre no verificados. El sistema previo de deduplicación/entrega no es una outbox durable; fallo de envío tras persistir/pausar requiere recuperación operativa. No se verificó producción ni se alteraron los experimentos históricos.

## Prueba interna de Screen 1 ejecutada — pendiente de revisión de Eder (2026-10-05)

Tras el «adelante» explícito se completó UNA llamada real: gpt-image-2.5-sunburst-2026-09-08, override local xhigh, PNG 864x1536, solo Screen 1. Los dos intentos previos se detuvieron antes del proveedor (red sandbox y clave ausente del proceso). La clave configurada estaba en .env.local; se leyó únicamente OPENAI_API_KEY al proceso temporal, sin modificar/copiar archivos de secretos. Doctor sin FAIL. Flag habilitado solo dentro del proceso ya terminado.

Resultado: section 1 review_pending, asset_id `86eb01d3-7d75-4845-95e8-3da6881cdee4`; propuesta visual_in_progress; sections 2–4 pending sin asset. automation_run `22538965-d540-4e51-adfb-d9e6688f108f` completed; request_id `req_27c897bd65774414afbd6af6848ba635`. Storage whatsapp-imports descargado y verificado: PNG 864x1536, 1080529 bytes, tamaño coincide con assets, spec_hash coincide con el VisualSpec persistido. Copia local para revisión: handoff/visual-internal-screen-1.png. Reporte: handoff/visual-internal-smoke.json (image_calls_this_process=1). No hubo aprobación automática, screens restantes, mensajes, deploy, migraciones ni commit.

Inspección visual: una sola vista móvil, nombre textual, selector de servicios y CTA legible; sin precios, fotos, testimonios ni mockup. El modelo añadió microcopy genérico («Estilo a tu medida», «Perfil y acabado») no literal del brief: revisar con Eder. El costo real no se obtuvo del proveedor; no afirmar importe. No volver a ejecutar generación sobre este fixture: revisión pendiente, cualquier nuevo gasto exige acción explícita.

Los párrafos siguientes conservan el contexto de preparación previo a esta ejecución; la autorización y la generación ya se completaron como se describe arriba.

Checkpoint Visual Generator V1 ya publicado en Git: `adb3014a1c4192dc567d0f0d658096f95f94caee`, rama feat/whatsapp-cloud-mvp. Las referencias a «sin commit» debajo son históricas. No hubo deploy.

El usuario pidió un caso ficticio aislado y prohibió generar hasta decir «adelante». Búsqueda remota solo lectura no encontró leads identificados como test/prueba/demo/sandbox/ficticios. Después de explicar las siete filas mínimas y obtener aprobación de ejecución fuera del sandbox, se creó el fixture interno en Supabase ycdosrsanutbhbgejwwg: un contacto sin teléfono enrutable, un lead con source/internal_notes `internal_test_visual_generator_v1_bruma`, bot_mode paused y human_required false, una propuesta draft y cuatro sections pending sin asset. Ningún cliente existente se modificó.

- Negocio ficticio: Bruma Barbería, corte de cabello y arreglo de barba; solicitudes por WhatsApp y confirmación manual; fricción de servicio/horario dispersos en mensajes.
- lead_id: `b8bd70ad-074d-4d02-9b47-fcd1bae16ec2`.
- proposal_id: `676c6e77-3334-4a08-be72-96831388af12`.
- Screen 1: service_selection; «Tu próximo corte, sin vueltas.»; selector Corte / Barba; CTA «Solicitar cita»; nombre en texto simple, sin logo ni fotografía inventada.
- Brief sintético autorado localmente y validado con parseProposalBrief/proposalSectionRows. NO es resultado de una ejecución real de Prep ni de enrichment web. Se prueba Visual Generator, no el flujo E2E anterior.
- Branding propuesto: #325A47, #F6F1E7, #AD4E28 y system sans. Cero assets de entrada. VisualSpec/prompt se validaron localmente; el freeze persistente sucederá dentro de generateVisualAnchor cuando se autorice.
- Modelo/quality/size: gpt-image-2.5-sunburst-2026-09-08 / xhigh / 864x1536 PNG; n=1. Override exclusivo del helper local del smoke test; proveedor de producción conserva high. Preparación: cero llamadas OpenAI, mensajes o assets; verificación remota también confirma cero tasks y automation_runs.

Helper nuevo sin commit: `scripts/visual-internal-smoke.mjs`; reporte no sensible: `handoff/visual-internal-smoke.json`. --prepare inserta solo filas faltantes del fixture y rechaza identidades/contenidos distintos; --inspect es lectura remota y actualiza reporte local. La red está limitada al Supabase autorizado y, solo en modo generación explícito, a /v1/images/generations con máximo una llamada por proceso. No hay imports de mensajería ni generación 2–4. Node --check y ESLint del helper pasaron. Archivos funcionales de V1 intactos.

Comando pendiente, NO ejecutado: cargar entorno con `. ./scripts/start.ps1 -DryRun` y luego `node scripts/visual-internal-smoke.mjs --generate-anchor --confirm-one-paid-call`. El helper habilita WHATSAPP_VISUAL_GENERATION_ENABLED=true exclusivamente en su proceso efímero, después de validar el fixture y la clave, y llama a generateVisualAnchor con el proposal_id anterior. No modifica el archivo de secretos ni .env.local. El modo de generación rechaza un fixture ya utilizado; no hay retry/regeneración implícita.

Bloqueos antes de ejecutar: autorización textual «adelante» y OPENAI_API_KEY en el entorno externo (doctor sigue reportándola ausente; no pedirla por chat). No se activó el flag durante preparación. No dar un costo total como garantizado: tarifa oficial consultada de Sunburst estándar, texto entrada 5 USD/millón y salida imagen 30 USD/millón; consumo de salida todavía desconocido. Tras la única llamada verificar section 1 review_pending/asset_id, metadata y bytes PNG en Storage, dimensions 864x1536, spec_hash, run, inspección visual y sections 2–4 todavía pending. Ante unknown no repetir; aplicar recuperación explícita. Sin cotización, mensajes, deploy, migraciones ni commit.

## Checkpoint vigente — Visual Generator V1 local (2026-10-05)

Implementada y probada la opción elegida: **V1 sin migraciones mediante coordinación persistente y updates condicionales**. Sin commit, push, deploy, migraciones, generaciones reales ni escrituras de producción. HEAD base sigue `5854e4c0200b6289ec0cbcb5a68c5e4a21b5b451` en `feat/whatsapp-cloud-mvp`. Doctor pasó sin FAIL; entorno externo y Supabase autorizado confirmados durante esta sesión. `.env.local` y `Nuevo Documento de texto.txt` intactos; el archivo personal sigue sin seguimiento.

### Implementación terminada

- `proposal-prep.ts`: reserva condicional `draft → preparing` antes de escribir notas/secciones; al completar vuelve a draft. Eliminado upsert destructivo: INSERT y, ante UNIQUE, UPDATE solo de brief/title/section_type con `status=pending AND asset_id IS NULL`. Conserva propuestas con secciones protegidas, reservas activas o envelope visual. La prueba de regresión ya demuestra que una transición concurrente no borra asset_id ni cambia approved a pending.
- `visual-direction.ts`: VisualSpec v1 determinístico desde ProposalBrief/enrichment complete/archivos verificados; formato mobile, 9:16, single_screen; paleta y evidencia, tipografía propuesta, sistema UI, estrategia de imágenes, composición, consistencia y supuestos. No relee conversaciones. Guardrails y filtro de contenido comercial antes de pagar. No impone Hero ni plantilla de cuatro tipos fijos.
- `visual-generator.ts`: funciones backend server-only para anchor, aprobación, restantes, regeneración explícita y recuperación. Reserva por CAS con UUID por intento dentro del brief de sección. CAS compara status, asset_id y brief/identificador del intento. Solo el ganador invoca al proveedor. La propuesta pasa de draft a visual_in_progress guardando un envelope inmutable `{generator,schema_version,proposal_brief,visual_spec}`; el brief original no se pierde.
- `visual-image-provider.ts`: fetch directo sin retries automáticos, modelo fijado `gpt-image-2.5-sunburst-2026-09-08`, high, n=1, PNG opaque, 864x1536. Endpoint generations sin inputs; edits con inputs oficiales. Se fija este snapshot por reproducibilidad y soporte documentado de dimensiones/referencias. Calidad/acceso por cuenta todavía no probados.
- Storage privado existente `whatsapp-imports`, ruta owner/lead/visual/proposal/position/attempt.png, upload sin upsert. Bytes primero, fila assets después, asociación y review_pending al final. Un asset por sección/intento; anteriores quedan históricos. Metadata marca composición generada, spec_hash, modelo, inputs y request_id seguro. Sin base64 en BD ni URLs firmadas persistidas.
- Anchor aprobado es inmutable en V1. Pantallas 2–4 usan exactamente el mismo spec y los bytes de ese anchor; una llamada separada por pantalla, secuencialmente. No hay UI nueva, automatización de gasto desde WhatsApp, desktop, pricing, HTML, PDF, pagos, envío ni cambio de lead.status.

### Máquina de estados y recuperación

| Estado/transición | Comportamiento |
| --- | --- |
| pending + asset NULL → generation_reserved | Reserva atómica previa a petición pagada. |
| generation_reserved → review_pending | Solo después de subir PNG e insertar asset; asociación por CAS. |
| review_pending + asset válido → approved | Acción explícita approveVisualAnchor; idempotente, sin generar otras pantallas. |
| generation_reserved → generation_failed | Rechazo conocido del proveedor o fallo antes de invocarlo. Sin retry automático. |
| generation_reserved → generation_unknown | Timeout, excepción ambigua o fallo posterior a invocación. Sin retry automático. |
| Reserva huérfana | Puede permanecer generation_reserved si el proceso muere/BD falla; bloquea nuevas llamadas igualmente. |
| review_pending / generation_failed / generation_unknown → generation_reserved | Solo acción explícita de regeneración con motivo; conserva asset anterior hasta éxito. No permite regenerar approved ni una reserva activa. |

`generateRemainingVisualScreens({proposalId})` omite completadas y se detiene ante una reserva/fallo/unknown. Para repetir fallos conocidos explícitamente: `{proposalId,retryFailedReason}`; omite pantallas completas y nunca reintenta unknown. Alternativa por posición: `regenerateVisualScreen({proposalId,position,reason})`.

Recuperación: investigar/detener el worker antes de autorizar otro gasto. `markVisualGenerationUnknown` exige expectedAttemptId y motivo, y cambia el identificador de recuperación para que un worker tardío no pueda asociar su resultado. No cancela la petición externa. `recoverStoredVisualScreen` recupera gratis una fila assets completa o los bytes ya subidos por ese intento. Si los bytes solo llegaron al proveedor y no se conservaron localmente/Storage, V1 no puede recuperarlos por x-request-id: el contrato directo consultado no expone esa operación. El operador debe decidir explícitamente si vuelve a pagar.

No hay TTL ni takeover automático de Prep: una interrupción dura en preparing requiere confirmar que el proceso cesó y reconciliar/liberar la reserva por operación autorizada posterior. Errores controlados de Prep liberan la reserva para reintento. Antes de un despliegue futuro deben terminar los workers con código antiguo que aún hacía upsert destructivo; el protocolo depende de que ambos motores ejecuten la versión nueva.

### Configuración, referencias y observabilidad

Solo nueva variable: `WHATSAPP_VISUAL_GENERATION_ENABLED` en .env.example, vacía/false por defecto; true habilita llamadas pagadas explícitas y reutiliza OPENAI_API_KEY externa. No se cargaron claves ni habilitó generación. Funciones productivas validan Supabase `ycdosrsanutbhbgejwwg` y limitan owner a CRM_OWNER_ID. No se expusieron rutas: un endpoint futuro deberá autenticar y autorizar a Eder.

Reutilizados: createAdminClient, parseProposalBrief, proposalSectionRows, patrón fetch/OpenAI, assets/Storage del importador, automation_runs y harness node:test. Skills revisadas: Imagegen (estructura de prompt), OpenAI Docs y Supabase; plantilla personal de tiendas inspeccionada pero no impuesta al brief.

Para referencias visuales reales se exige archivo del mismo owner/lead en Storage con metadata.visual_verification: status=verified, role=logo/photo/product, verified_by, source_description, section_positions. El importador no lo marca automáticamente. Pending/processing/failed, referencias sociales y notas de fotos sin archivo no entran como imágenes reales. URLs externas solas no se descargan; requieren incorporación/verificación previa. El enrichment actual no confirma fuentes tipográficas; siempre propuestas. Colores verificables hex desde complete conservan origen, el resto se marca proposed/mixed.

automation_runs: workflow visual-generator-v1; acción, proposal/posición/inputs, estado, intento, proveedor/modelo, request_id, decisión de nuevo gasto y hash del motivo. Sin prompts, base64 ni feedback textual potencialmente sensible. No se añadió acción de rechazo/feedback; regeneración explícita antes de aprobación disponible.

### Checks de cierre

- `node --test scripts/test-proposal-prep.mjs scripts/test-visual-generator.mjs`: 28/28 aprobadas (11 Prep + 17 Visual Generator), repetidas tras el último ajuste; sin red ni API keys reales.
- `npx tsc --noEmit --incremental false`: aprobado.
- ESLint sobre los siete archivos JS/TS del batch: aprobado (exit 0). Se corrigió únicamente el nombre local `module` en el test, exigido por la regla de Next.js.
- Lint general anterior encontró ese error del test (ya corregido) y el error preexistente `react-hooks/set-state-in-effect` en reset-password/page.tsx:24, fuera de alcance y sin modificar.
- `git diff --check`: aprobado. Aviso de conversión LF/CRLF de .env.example, sin error de whitespace.
- Build no ejecutado. No se hizo prueba remota de escritura ni generación/inspección visual real.

Concurrencia probada: dos anchors llegando al CAS solo invocan una vez al proveedor; reserva activa bloquea segunda llamada; aprobación simultánea idempotente; Prep no entra en propuesta congelada; generador devuelve busy durante preparing; respuesta tardía no vence recuperación. Otros casos: assets inexistentes, fallo explícito, timeout, upload fallido, fallo de INSERT después de subir bytes, recuperación gratuita, retry parcial, spec exacto y referencias filtradas.

Riesgos pendientes: verificación gráfica/legibilidad/veracidad requiere muestra real autorizada; regex no demuestra todos los hechos comerciales; parser PNG verifica cabecera/dimensiones/tamaño, no decodifica toda la imagen. Calidad, latencia/timeout del hosting, permisos efectivos de escritura y acceso al modelo por cuenta no probados. Los mocks modelan CAS pero no sustituyen integración en Postgres/Storage aislados. No se construyó scheduler durable ni limpieza automática de assets históricos/huérfanos.

Archivos modificados: PROJECT.md, handoff/CURRENT.md, .env.example, src/lib/whatsapp/proposal-prep.ts, scripts/test-proposal-prep.mjs. Nuevos: src/lib/whatsapp/visual-direction.ts, visual-generator.ts, visual-image-provider.ts, scripts/test-visual-generator.mjs y scripts/test-helpers/proposal-fixture.mjs. Sin dependencias nuevas. Próximo paso: revisión del diff; cualquier generación real, despliegue o escritura productiva necesita autorización posterior. No hacer commit/push en este batch.

## Investigación previa — decisión resuelta por el checkpoint superior (histórico)

El contenido siguiente conserva el diagnóstico anterior a la implementación. Sus referencias a opciones pendientes y motor no implementado ya no describen el estado vigente.

Visual Generator NO implementado. Checkpoint Git real confirmado: HEAD `5854e4c0200b6289ec0cbcb5a68c5e4a21b5b451`, rama `feat/whatsapp-cloud-mvp`, raíz y remoto `ederartmo/edercreawebs-crm` correctos. Este checkpoint reemplaza las afirmaciones históricas de Prep sin commit que aparecen debajo. El usuario informa que Prep ya está publicado; no se verificó el despliegue.

- `. ./scripts/start.ps1 -DryRun` cargó el entorno externo y ejecutó doctor sin FAIL. OPENAI_API_KEY ausente; no bloquea pruebas con dobles. Estado inicial: únicamente `Nuevo Documento de texto.txt` sin seguimiento; no se modificó ni agregó a Git. `.env.local` intacto.
- Catálogo efectivo: `supabase-edercreawebs` presente, Miriam ausente. MCP confirmó URL `https://ycdosrsanutbhbgejwwg.supabase.co`. Solo lecturas de metadatos remotos.
- Storage disponible: bucket privado `whatsapp-imports`, límite 104857600 bytes, sin restricción MIME configurada. Políticas SELECT/INSERT/UPDATE/DELETE limitan primer segmento a auth.uid(). El importador ya sube bytes con upsert:false y luego inserta assets con owner_id, lead_id, storage_bucket/path, mime_type, size_bytes y metadata. No se encontró helper compartido ni generador de imágenes existente. Se puede reutilizar esta infraestructura sin crear bucket.
- Schema remoto confirmado: assets.metadata jsonb; visual_proposals.direction_notes text; section.status text; section.asset_id FK a assets; UNIQUE(proposal_id,position) y UNIQUE(lead_id,version). automation_runs tiene input/output jsonb y estados text. No se leyeron conversaciones ni archivos de clientes.
- Skills inspeccionadas: Imagegen, OpenAI Docs, Supabase y plantilla personal Tiendas y servicios / Compra por secciones. La plantilla es específica y no debe imponer cuatro secciones fijas, precios ni identidad ajena al ProposalBrief. Imagegen aporta estructura de prompts, pero su herramienta interactiva no constituye integración del backend Next.js. No se ejecutó generación.
- Documentación oficial consultada: https://developers.openai.com/api/docs/guides/image-generation y https://developers.openai.com/api/reference/resources/images/methods/edit . Hay soporte documentado de referencias de imagen y dimensiones personalizadas en modelos actuales; proveedor/modelo/contrato final todavía NO elegidos ni implementados. No confundir referencias a fotos en enrichment con bytes utilizables.

### Decisión de coordinación antes de implementar

`proposal-prep.ts` escribe direction_notes como ProposalBrief directo, reconoce drafts por generator en la raíz y hace upsert de las cuatro secciones con status=pending y asset_id=null. La comprobación previa del proposal y el upsert no son atómicos. Un envelope con otro generator protege frente a lecturas posteriores, pero no frente a Prep que ya pasó la comprobación.

Reproducción local en memoria usando fixture/database/engine de `scripts/test-proposal-prep.mjs` (sin editar ese archivo ni usar red): crear draft; iniciar reintento de Prep; en afterQuery de la lectura individual previa al upsert, simular envelope visual y anchor approved con asset_id; continuar Prep. Resultado: Prep arroja error en su comprobación final, pero la sección ya quedó pending y asset_id=null. No es evidencia de corrupción real en producción: el anchor fue simulado. La primera ejecución del probe falló por resolución de TypeScript desde data URL; se corrigió usando import.meta.resolve y la reproducción pasó.

Hace falta coordinar ambos escritores, no únicamente bloquear llamadas duplicadas al generador. También definir qué hacer si el proceso muere después de enviar una petición pagada y antes de guardar sus bytes: no es seguro regenerar automáticamente por timeout.

Opciones pendientes de elección del usuario:

1. **Recomendada para V1 sin migraciones:** protocolo compartido de reserva persistente mediante compare-and-set en filas existentes y envelope versionado; adaptar Prep y todas las acciones visuales para respetarlo. Proteger propuestas en generación/revisión frente a reescritura, conservar briefs, no liberar automáticamente reservas ambiguas y exigir recuperación explícita cuando no se conozca el resultado de una llamada pagada. Diseñar y probar fallos/concurrencia antes de habilitar generación. No basta mutex en memoria, TTL ni una lectura adicional.
2. Separar primero un batch de coordinación transaccional en BD mediante RPC/migración para reservas y cambios entre proposal/sections. Fuera de la restricción actual de V1 sin migraciones; requiere cambiar alcance, sin ejecutar nada remoto ahora. Tampoco hace atómica una llamada externa a OpenAI: necesita política de recuperación para resultados inciertos.

Siguiente paso: elegir protocolo y política de recuperación; luego implementar Visual Direction persistente, anchor idempotente, aprobación backend y pantallas 2–4 secuenciales con el mismo spec e imagen aprobada como referencia. Convertir la reproducción en regresión automatizada al modificar Prep. Permanecen pendientes los 14 contratos solicitados y el reporte final A–P. No cambiar lead.status, pricing, desktop, HTML, PDF ni envío.

Único cambio de esta investigación: este handoff. Sin cambios funcionales, dependencias, variables nuevas, migraciones, escrituras de producción, generaciones reales, deploy, commit ni push. PROJECT.md y .env.example se actualizarán con la implementación, sin anunciar capacidades inexistentes.

## Checkpoint anterior — Proposal Prep Engine V1 (2026-10-05, histórico)

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
# Revisión dirigida de compatibilidad Intake V1

- Phone nullable revisado en webhook, CRM/inbox, listas, pipeline, hoy e importador: sin bug de nullabilidad encontrado. SQL local comprueba UNIQUE(owner_id,phone) y proyección de inbox con NULL.
- Email-only → ECW probado con servicio y webhook reales sobre SQL local: mismo contacto/lead, teléfono real asignado, first-touch intacto, sin preguntas ni tareas duplicadas.
- Dedupe entre sesiones por email no verificado queda pendiente de decisión de identidad: actualmente dos sesiones completas crean dos registros, aunque cada sesión es idempotente. No fusionar automáticamente: el ECW de otra sesión podría asignar teléfono a un contacto compartido ajeno. Detalle en INTAKE_V1.md.
- 66 tests pasan sin skips, incluidas las 45 anteriores; TypeScript, ESLint del batch y git diff --check aprobados. Migración sigue local. Esta revisión solo amplía pruebas/documentación, sin cambio productivo, commit, push o deploy.
