# EderCreaWebs CRM / WhatsApp Agent

El CRM centraliza contactos, negocios, leads, conversaciones, activos, tareas y seguimiento comercial de EderCreaWebs. El nuevo rol de WhatsApp Agent es atención, Intake V1 y calificación: recuperar lo conocido, completar solo faltantes y dejar el proyecto listo para revisión personal de Eder. La propuesta visual y cotización se preparan manualmente.

**El agente conversa y razona; el código protege acciones de negocio.**

## Flujo y arquitectura actuales

Meta/orgánico → web o WhatsApp → ficha canónica de Intake → completar faltantes → ready_for_quote → Eder revisa personalmente. Backend local, pendiente de aplicar la migración de Intake y desplegar en una operación posterior autorizada. No hay landing ni webchat nuevos.

Proposal Prep y Visual Generator quedan congelados como experimentos históricos. El auto-trigger enrichment → Prep exige `WHATSAPP_PROPOSAL_PREP_ENABLED=true`; por defecto false. `WHATSAPP_VISUAL_GENERATION_ENABLED=false`; no hay generaciones desde Intake. La prueba histórica Bruma se conserva sin cambios. Las secciones de estos motores más abajo documentan código retenido, no el objetivo comercial vigente.

El webhook verifica el callback, recibe texto/audio, comprueba duplicados y persiste mensajes. Recupera contexto comercial y hasta 30 mensajes para el agente. Las herramientas permiten guardar contexto y proceso comercial, solicitar referencias, normalizar URLs/handles y guardar activos. El enriquecimiento se programa con Next.js `after()`; investiga información pública y guarda una ficha y fuentes en el activo para turnos posteriores.

El handoff de Intake marca intervención humana, guarda resumen, pausa el bot y crea una tarea idempotente mediante una RPC transaccional, sin escribir lead.status. El handoff humano anterior también conserva ahora el status. El aviso administrativo existente sigue siendo opcional.

## Intake V1

Contrato, auditoría del schema, API, atribución, seguridad y pruebas: [handoff/INTAKE_V1.md](handoff/INTAKE_V1.md). Dominio puro en `src/lib/intake/domain.ts`; almacenamiento de servidor en `service.ts`; adaptador web en `/api/intake/session`; adaptador WhatsApp en el agente/webhook existentes.

Se reutilizan `contacts`, `businesses`, `leads` y `assets`. La migración **local, no ejecutada remotamente** añade `leads.intake` e `intake_sessions` y permite `contacts.phone=NULL` para contactos web/email. La sesión parcial permanece anónima; al alcanzar readiness, el backend crea contacto, negocio cuando corresponde, lead y tarea en una transacción, vincula la sesión y vacía el staging. No depende de WhatsApp. Reenvíos y recargas no duplican registros. Nombre, negocio, proceso y objetivo usan las columnas existentes.

Readiness requiere ocho grupos: nombre + teléfono/email; qué vende; adquisición o cómo vende; proceso tras interés; objetivo o fricción; rango de inversión válido; timing; referencia existente o declaración explícita de ausencia digital. `completion_percent=round(grupos completos/8*100)`; `missing_fields` contiene solo grupos incompletos. Se calcula al leer, sin flags derivados que puedan quedar obsoletos. Presupuesto nunca modifica pricing. El agente recibe known_fields/missing_fields/ready_for_quote y el código selecciona una sola pregunta; completo produce cierre y handoff sin prometer plazos.

Web guarda una respuesta por POST y recupera progreso con cookie HttpOnly opaca. Ready crea la tarea «Revisar proyecto y preparar cotización», marca human_required, bot pausado e intake.ready_for_quote como constancia de recepción lista, sin cambiar lead_status. La evaluación pura sigue siendo la autoridad sobre los datos actuales. El teléfono web declarado se conserva como user_provided en intake hasta verificarse por transporte; no se asigna a otro contacto por coincidencia no verificada.

Tras completar web se puede emitir un código `ECW-` de 24h: WhatsApp lo resuelve antes de crear registros y recupera el MISMO lead. Exige firma Meta y coincidencia del teléfono declarado; para web completo con solo email, la capacidad secreta de sesión/código autoriza vincular el primer remitente firmado. El código queda ligado a ese remitente, tolerando sus reintentos sin permitir otros. La sesión dura 30 días; después de materializar devuelve solo un acuse sin datos CRM/UUIDs, acepta reenvíos como no-op y permite emitir continuidad. No admite edición pública del lead.

First-touch conserva UTM, landing/referrer saneados y datos Meta permitidos sin sobrescritura; un referral posterior se conserva separado. No se descargan medios del anuncio ni se guardan payloads completos. El enriquecimiento público no rellena por sí solo hechos de Intake.

Web permanece deshabilitado con `INTAKE_WEB_ENABLED=false` hasta autorizar migración/publicación. Faltan UI de preguntas, botón WhatsApp, carga segura de fotos, revisión de retención y protección antiabuso del hosting. Web-only ya termina en CRM con tarea. Meta Lead Ads requiere integración autenticada e idempotente futura; su importador podrá usar el mismo contrato, incluido `project_interest`.

## Stack y módulos

- Next.js 16, App Router y runtime Node.js; React 19, TypeScript 6, Tailwind 4.
- Supabase Auth, helpers cliente/servidor y cliente administrativo exclusivamente de servidor.
- Meta WhatsApp Cloud API, OpenAI Responses y transcripción de audio.
- CRM en `src/app/(crm)`; login y recuperación de contraseña en `src/app`.
- Webhook: `src/app/api/whatsapp/webhook/route.ts`.
- Agente/herramientas: `src/lib/whatsapp/sales-agent.ts`.
- Audio, enriquecimiento y alertas: `audio.ts`, `asset-enrichment.ts`, `admin-alert.ts` en el mismo directorio.
- Brief interno y validaciones: `src/lib/whatsapp/proposal-prep.ts`; pruebas locales: `node --test scripts/test-proposal-prep.mjs`.
- Motor visual: `visual-direction.ts`, `visual-generator.ts` y `visual-image-provider.ts` en `src/lib/whatsapp`; pruebas locales: `node --test scripts/test-visual-generator.mjs`.
- APIs adicionales de imagen, PDF, transcripción y análisis de leads; importador de conversaciones WhatsApp.

## Implementado y límites

El código incluye webhook V2, texto/audio, transcripción, agente conversacional, contexto persistente, `save_business_context`, `save_sales_process`, `mark_assets_requested`, `save_asset_reference`, handoff, alerta administrativa y enriquecimiento. Su presencia se confirmó en código; no equivale a una prueba actual de producción.

El agente no debe prometer condiciones no confirmadas, negociar descuentos, emitir cotización formal, cerrar pagos ni afirmar que investigó una referencia pendiente. Sus herramientas no ofrecen envío de cotizaciones ni cobro. Algunas restricciones son instrucciones al modelo y requieren supervisión; los controles de código actuales no garantizan todas las reglas comerciales.

Visual Generator V1 ofrece generación móvil y aprobación mediante funciones backend internas, con pruebas simuladas. No existe todavía Proposal Engine completo, desktop companion, cotización HTML final, pricing, PDF, envío automático ni cierre/pago automatizado. No se añadió interfaz CRM ni automatización de generación pagada.

## Proposal Prep Engine V1

`prepareVisualProposalDraft({ leadId, sourceAssetId })` recupera contexto comercial, hasta 40 mensajes inbound/outbound en orden cronológico y referencias del lead. Solo incluye perfiles con enrichment complete; exige que la referencia origen tenga perfil completo, what_sells/how_sells y conversación inbound. Si faltan prerrequisitos, registra fallo reintentable, sin crear propuesta.

Usa Responses API con JSON schema strict, `store: false`, sin herramientas web y modelo `WHATSAPP_PROPOSAL_MODEL` o `gpt-5.6-sol`. El brief incluye diagnóstico, solución propuesta, dirección visual mobile first, exactamente cuatro secciones elegidas según el caso, información faltante, supuestos a evitar, confianza y readiness. Validación local adicional exige posiciones ordenadas 1–4, project_type válido, ausencia de campos extra y colores presentes en perfiles completos; rechaza patrones de importes monetarios. No genera imágenes, HTML, cotizaciones ni precios y no envía el brief al prospecto.

Persiste JSON en visual_proposals.direction_notes y briefs autónomos por sección. Reutiliza el último draft propio de proposal_prep_v1; ante una versión ajena/aprobada/enviada sin envelope visual, crea max(version)+1. Las propuestas `preparing`, `visual_in_progress` o con envelope visual se conservan sin crear un draft competidor. Prep reserva la fila con una actualización condicional `draft → preparing`, manteniendo sus notas; comprueba secciones antes de sustituir el brief y libera a draft al terminar. El generador compite por la misma fila para congelar brief/spec. No hay expiración automática de reservas.

Se eliminó el upsert destructivo de secciones: INSERT sin reemplazo y, ante conflicto UNIQUE, UPDATE de brief/title/section_type únicamente con `status=pending AND asset_id IS NULL`. Nunca resetea status/asset_id de una fila existente. Si detecta una sección protegida conserva la propuesta y registra `protected_sections`; los conflictos concurrentes no borran una generación. Se verifica coherencia de las cuatro secciones antes de liberar la reserva. No hay transacción entre tablas: un error controlado libera la reserva para reintento; una interrupción abrupta puede dejar `preparing` y exige reconciliación por operador, sin takeover por tiempo.

`enrichBusinessReferenceAsset` solo dispara Prep si `WHATSAPP_PROPOSAL_PREP_ENABLED=true`; Intake V1 lo deja apagado. El código retenido lo ejecuta como paso separado fuera de su catch y conserva enrichment complete ante fallos. automation_runs usa workflow whatsapp-proposal-prep-v1, estados started/completed/failed e input/output pequeños.

El lead conserva activos_recibidos: ni Prep ni Visual Generator cambian automáticamente lead.status, incluso después de las cuatro imágenes. Quote Generator permanece pendiente. El agente confirma recepción de referencias, explica su utilidad para aterrizar la propuesta y solo pregunta una incógnita comercial si puede cambiar la solución, sin afirmar investigación recién hecha ni prometer plazos.

Validado localmente con dobles sin red; columnas, enum y restricciones únicas comprobadas remotamente solo en lectura. No se probó generación real OpenAI ni se escribió/desplegó producción. Para el estado actual usa `handoff/CURRENT.md`; los documentos antiguos se conservan y pueden describir fases previas.

## Visual Generator V1 — backend interno

**V1 sin migraciones mediante coordinación persistente y updates condicionales.** Visual Direction es un builder determinístico del ProposalBrief, enrichment complete y manifiesto de assets verificados; no relee conversaciones ni vuelve a decidir la solución. Elige tres colores (hex verificables desde enrichment o propuestas), tipografía propuesta —el enrichment actual no prueba fuentes oficiales—, spacing, radios, botones, cards, navegación e iconografía. Las reglas exigen una captura mobile realista, un viewport, CTA claro y copy corto, sin mockup/collage/landing completa. Se bloquean patrones comerciales antes de pagar; la veracidad semántica y el resultado gráfico siguen necesitando revisión humana.

VisualSpec tiene `generator=visual_generator_v1`, `schema_version=1`, `proposal_id`, `format`, `brand` (fuente de colores/tipografía y evidencia por color), `ui_system`, `imagery` (IDs y roles/posiciones de archivos verificados, guía de imágenes generadas), `composition_rules`, `consistency_rules`, `assumptions_to_avoid` y `source_summary`. El formato es siempre mobile / 9:16 / single_screen.

El primer freeze guarda en direction_notes `{generator:"visual_generator_v1",schema_version:1,proposal_brief:{...},visual_spec:{...}}` y cambia la propuesta `draft → visual_in_progress` mediante CAS de status/notas. El ProposalBrief original se conserva completo. Prep sigue aceptando drafts originales y reconoce el envelope como protegido; `parseVisualEnvelope` lee el nuevo formato. El spec queda congelado y su hash acompaña cada asset. No se modifica al aprobar ni al generar pantallas posteriores.

Funciones exportadas por `visual-generator.ts` (server-only; no hay endpoints nuevos ni herramientas del agente):

| Acción | Contrato |
| --- | --- |
| `generateVisualAnchor({proposalId})` | Solo position 1, según su tipo/contenido de Prep; reserva antes de pagar. Reutiliza estados existentes sin regenerar. |
| `approveVisualAnchor({proposalId})` | review_pending + asset completo + archivo válido → approved. Idempotente; no genera pantallas adicionales. |
| `generateRemainingVisualScreens({proposalId})` | Exige anchor approved; procesa 2, 3 y 4 secuencialmente, cada una con asset independiente. Omite completadas y se detiene en fallidas/ocupadas/desconocidas. |
| `generateRemainingVisualScreens({proposalId,retryFailedReason})` | Acción explícita para reintentar únicamente generation_failed y continuar las pendientes. Nunca reintenta generation_unknown. |
| `regenerateVisualAnchor({proposalId,reason})` / `regenerateVisualScreen({proposalId,position,reason})` | Nuevo intento pagado explícito desde review_pending, generation_failed o generation_unknown. Conserva asset anterior hasta persistir el nuevo. Approved es inmutable en V1. |
| `markVisualGenerationUnknown({proposalId,position,expectedAttemptId,reason})` | Intervención explícita sobre reserved/unknown; cambia el identificador de recuperación para bloquear escrituras de un worker antiguo. No cancela una petición ya enviada. |
| `recoverStoredVisualScreen({proposalId,position,expectedAttemptId})` | Desde unknown, recupera gratis un asset completo o bytes ya subidos por ese intento y asocia la sección como review_pending. No llama al proveedor. |

Las funciones productivas validan el Supabase autorizado y limitan propuestas/assets a CRM_OWNER_ID. Cualquier endpoint futuro deberá autenticar/autorizar al operador antes de invocarlas; no conectar aprobación ni generación al agente conversacional sin ese control. No se añadió rechazo/feedback en V1; usar regeneración explícita antes de aprobación. Los motivos se conservan como hash y presencia, no texto libre potencialmente sensible.

### Estados y persistencia

`pending + asset_id NULL → generation_reserved → review_pending + asset_id válido → approved`.

Fallo explícito conocido: reserved → generation_failed. Timeout, fallo de persistencia después de llamar o resultado ambiguo: reserved → generation_unknown. Si el proceso muere o la BD no permite registrar el resultado, puede quedar reserved, igualmente bloqueado. No hay TTL, bucle de retry ni retry automático del SDK. Una regeneración explícita desde estados permitidos vuelve a reserved conservando el asset anterior. Las escrituras comparan status, asset_id y el brief con un UUID de intento; una respuesta tardía no puede reemplazar el estado de una recuperación. Aprobación del anchor es irreversible en V1 para mantener la referencia de 2–4 estable.

Cada reserva conserva en section.brief el brief original más `visual_attempt` (UUID, run_id, fecha, modelo, spec_hash, asset anterior, IDs usados y hash del motivo). Los bytes PNG van al bucket privado existente `whatsapp-imports`, ruta `{owner}/{lead}/visual/{proposal}/{position}/{attempt}.png`, upload sin upsert. Después se inserta assets con el mismo UUID del intento, procedencia generada, metadata resumida e is_client_facing=false; solo entonces se asigna section.asset_id. No hay base64 en Postgres ni URLs firmadas persistidas. Assets anteriores quedan históricos; fallos parciales pueden dejar archivos/assets recuperables, sin borrado automático.

### Proveedor y referencias reales

OpenAI Images API directa, modelo fijado `gpt-image-2.5-sunburst-2026-09-08`, quality=high, n=1, PNG opaque, `864x1536` (9:16 exacto). `/v1/images/generations` sin imágenes; `/v1/images/edits` con inputs. Pantallas 2–4 incluyen los bytes del anchor aprobado más referencias pertinentes; se usa exactamente el mismo spec. Referencias: [guía oficial](https://developers.openai.com/api/docs/guides/image-generation), [contrato de edición](https://developers.openai.com/api/reference/resources/images/methods/edit). Se guarda x-request-id seguro para rastreo; no se implementa recuperación de resultados remotos, porque el contrato directo consultado no expone recuperar esa imagen mediante dicho ID. Un resultado solo existente en el proveedor requiere decisión humana antes de pagar otra vez.

La única variable nueva es `WHATSAPP_VISUAL_GENERATION_ENABLED`: vacía/false por defecto, debe ser true para llamadas pagadas. Reutiliza OPENAI_API_KEY del entorno externo. No modificar .env.local. La ausencia de clave no afecta los mocks. Habilitar la variable no dispara nada por sí mismo. Antes de una prueba real hacen falta autorización expresa y revisión de la propuesta.

Inputs de negocio: archivos PNG/JPEG/WebP del mismo owner/lead en el bucket existente, con `assets.metadata.visual_verification` que contenga `status:"verified"`, `role:"logo"|"photo"|"product"`, `verified_by`, `source_description` y `section_positions:[...]`. Es un contrato interno explícito; el importador actual no lo rellena automáticamente. Perfiles pending/processing/failed, assets generados, URLs sociales y meras notas sobre una foto nunca se presentan como inputs reales. Hasta cuatro archivos pertinentes por pantalla, además del anchor. No hay descarga arbitraria/scraping: material disponible solo como URL debe incorporarse/verificarse previamente. El modelo puede usar composición ilustrativa, pero el asset se marca internamente como generado.

automation_runs usa workflow `visual-generator-v1`, acciones generate/explicit_regeneration/approve_anchor/mark_unknown/recover_stored_asset; guarda IDs, posición, estado, modelo/proveedor, intento, request_id y decisión de nuevo gasto. Sin prompts, base64, claves ni texto de feedback. El spec freeze forma parte de la preparación de la generación, no una llamada a otro modelo.

### Verificación y límites operativos

Pruebas sin red: `node --test scripts/test-proposal-prep.mjs scripts/test-visual-generator.mjs`; dobles compartidos en `scripts/test-helpers/proposal-fixture.mjs`. Cubren reservas concurrentes, protección ante Prep, approval, fallos conocidos/desconocidos, referencias reales, generación por sección y recuperación de bytes/asset sin nuevo gasto. TypeScript y lint del batch se verifican por separado; consultar handoff para resultados finales.

No se verificaron calidad visual, legibilidad, acceso al modelo por cuenta, latencia del hosting ni escrituras reales de Storage/BD. Los dobles no sustituyen una prueba de integración en una BD aislada. Las comprobaciones PNG verifican cabecera/dimensiones/límite de tamaño; no son un decodificador completo ni una evaluación de diseño. Antes de publicar, deben terminar los workers con el Prep antiguo que todavía ejecutaba upsert destructivo. Una reserva preparing huérfana exige confirmar que el worker cesó y reconciliar datos antes de liberarla: no hay recuperación automática de Prep. Todo esto queda pendiente de operación autorizada; este batch no despliega ni migra.
