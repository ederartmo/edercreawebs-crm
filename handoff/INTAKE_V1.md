# Intake V1 — contrato local, 2026-10-05

Migración remota aplicada y validada; sin deploy. Único Supabase autorizado: ycdosrsanutbhbgejwwg. Se consultaron únicamente metadatos remotos, no conversaciones de clientes. Migration aplicada: `supabase/migrations/20261005210820_intake_v1.sql`, creada con CLI y probada en PostgreSQL local en memoria (PGlite temporal fuera del repo).

## Auditoría y representación única

| Dato | Almacenamiento canónico al existir lead |
| --- | --- |
| Nombre, email, WhatsApp verificado | contacts.full_name/email/phone; teléfono declarado web en intake.answers.whatsapp hasta verificarlo |
| Nombre del negocio y redes | businesses.name/instagram_url/facebook_url/tiktok_url/website/google_business_url |
| Qué vende, proceso comercial, vendiendo | leads.what_sells/how_sells/currently_selling |
| Fricción, objetivo | leads.main_problem/main_goal |
| Timing concreto ya conocido | leads.likely_start_date tiene prioridad |
| Adquisición separada, rango, timing textual, no presencia digital, otras referencias, interés de proyecto | leads.intake.answers |
| First-touch y último referral con identificador | leads.intake.first_touch/last_referral |
| Fotos/screenshots y referencias existentes | assets del mismo owner y lead; no se usan imágenes generadas como prueba |
| Conversación, pausa, historial | conversations y messages existentes |
| Readiness, completion, missing | Derivados puros al leer; intake_version=1. intake.ready_for_quote/readiness_evaluated_at registran recepción lista para revisión |
| updated_at | Timestamp del lead/sesión; no representa cada cambio externo en businesses/assets |

`crm_settings` contiene pricing/impuestos/defaults del bot, sin campo semántico de intake. No se utiliza como presupuesto. `leads.source` se conserva; first_touch expresa atribución del intake sin reescribir fuentes históricas como whatsapp_cloud. `cotizacion_pendiente_aprobacion` presupone una cotización: no se utiliza para readiness; ningún enum cambia.

La baseline exige contacts.phone y leads.contact_id. La corrección web permite contacts.phone=NULL; leads.contact_id sigue obligatorio. Sesiones parciales no crean registros CRM. Al alcanzar ready_for_quote, `getIntakeSession` evalúa con el helper puro y llama `intake_materialize_session` con el snapshot exacto evaluado. La RPC bloquea la sesión, verifica vigencia/owner/snapshot, devuelve el vínculo si ya existe y crea contacto, negocio cuando corresponda, lead y tarea en una sola transacción. Guarda materialized_at y lead_id y vacía answers/first_touch del staging. Si el snapshot cambió, el servicio relee y reevalúa antes de reintentar. El navegador no proporciona IDs ni el resultado de readiness.

El contacto web nace sin teléfono verificado (NULL), con nombre/email conocidos. Un WhatsApp declarado permanece en intake.answers.whatsapp; la proyección canónica lo reutiliza para readiness y no lo repregunta. Esto permite email-only real y evita asociar datos de navegador a contactos CRM previos. Al recibir ECW firmado, se verifica el número y se elimina el dato provisional al establecer contacts.phone. Si ya existe otro contacto con ese número verificado, el MISMO lead web se asocia a ese contacto, preservando sus datos confirmados. El contacto web original se conserva para reconciliación humana, referenciado por intake.submitted_contact_id; no se borra información CRM. Idempotencia es por sesión, no una deduplicación automática de distintas sesiones por email/nombre.

## Regla determinística

Ocho grupos de igual peso:

1. identity: name y al menos whatsapp válido (8–15 dígitos con prefijo internacional) o email válido.
2. what_sells: descripción no vacía.
3. customer_acquisition: adquisición o how_sells conocido.
4. how_sells: proceso cuando alguien se interesa, no vacío.
5. objective: main_goal o main_problem.
6. budget_range: menos_de_15k, 15k_20k, 20k_35k, 35k_50k, 50k_plus.
7. timing: texto no vacío o fecha concreta existente.
8. reference: red/sitio/Google/otra URL, asset de referencia o foto almacenada no generada, o no_digital_presence=true explícito.

Ready solo si no falta ningún grupo; completion es round(completos/8*100). El nombre del negocio, currently_selling y otros detalles se conservan si llegan pero no bloquean V1. Un false es dato conocido. `known_fields` contiene valores reales normalizados; `missing_fields` son requisitos, no todas las columnas opcionales. Una referencia en assets se expresa además como reference_known. El helper es determinístico respecto a datos capturados; no demuestra la veracidad de una declaración ni la calidad semántica de texto libre.

## Merge y seguridad

Fill-only: los datos previos del CRM prevalecen, incluso false. Browser y modelo no pueden borrar ni reemplazar hechos conocidos. Las correcciones requieren revisión humana en V1. JSON solo contiene campos sin equivalente; no escribe suggested_price, approved_price, project_type final ni status. project_interest guarda interés declarado y puede recibir tipo de proyecto de Meta sin cambiar enum.

Campos del CRM se tratan conservadoramente como conocidos/protegidos. Nuevos datos son user_provided; atribución se almacena aparte. Enrichment público no se fusiona con respuestas declaradas. No hay sistema de confianza complejo por campo ni edición pública de confirmed.

RPCs SECURITY INVOKER, search_path vacío, EXECUTE revocado a PUBLIC/anon/authenticated y concedido solo a service_role. Tabla de sesiones con RLS y sin acceso anónimo/autenticado. Service role solo en servidor y con verificación de project URL/CRM_OWNER_ID. Escrituras con bloqueo de fila: no se pierden respuestas concurrentes. Readiness se vuelve a comprobar antes del handoff; la RPC de handoff no cambia status y hace pausa/tarea/resumen atómicamente. No existe nuevo endpoint que acepte IDs arbitrarios de lead.

## API web preparada

Ruta `/api/intake/session`, Node, no-store. Flag INTAKE_WEB_ENABLED=false por defecto; exige INTAKE_WEB_ORIGIN exacto en POST, JSON y máximo 12 KB leídos del stream. Allowlist de respuestas, máximo ocho campos por petición, strings hasta 1200; no admite owner, lead, precios ni campos de sistema. Límite durable de creación: 100 sesiones/hora por owner; protección IP/CAPTCHA/edge queda para publicación. No hay service role ni UUIDs en respuestas públicas.

- POST `{action:"create",attribution:{...}}`: crea o recupera sesión de cookie existente, sin reemplazar first-touch. Token aleatorio de 256 bits en cookie HttpOnly, SameSite=Strict, Secure en producción; en BD solo SHA-256. TTL 30 días.
- POST `{action:"save",answers:{what_sells:"..."}}`: guarda progreso; al completar materializa CRM y devuelve acuse `{linked:true,ready_for_quote:true,completion_percent:100,missing_fields:[],intake_version:1}`. Repetir el submit es no-op una vez materializada; no modifica datos CRM.
- GET: recupera progreso o el acuse anterior sin UUIDs/datos CRM. También reconcilia una sesión ready cuyo guardado se completó pero cuya materialización/respuesta se interrumpió. Vinculaciones parciales históricas hechas por WhatsApp siguen devolviendo solo `{linked:true}`.
- POST `{action:"continue"}`: disponible antes y después de completar web. En parcial exige whatsapp registrado; en web-only completo con solo email permite establecer el primer remitente por capacidad secreta + transporte firmado. Emite `ECW-` + 24 caracteres hex aleatorios (96 bits), hash en BD, TTL 24h; rotación invalida el anterior. Sin ID de destino inventado: el futuro botón usará el WhatsApp comercial verificado.

El webhook exige META_APP_SECRET y firma válida. `intake_resolve_continuation` corre ANTES de get-or-create, bloquea la misma sesión que la materialización y devuelve su lead exacto, incluso si existe otro más reciente. Para sesiones parciales también vincula/crea bajo ese bloqueo, evitando carreras de canales. Valida owner, expiración, número declarado/verificado y remitente. Un código ya utilizado solo admite reintentos del mismo teléfono, hasta vencer o rotar; no puede apropiárselo otro remitente. Inválido/expirado no cae en creación de otro lead: responde recuperación fallida. El código se retira del body/transcripción; raw_payload sigue reducido. Web completo ya tiene tarea y human_required antes de abrir WhatsApp. Ready provoca cierre fijo sin preguntas ni llamada al modelo, y no duplica la tarea.

## Atribución

Allowlist: source (organic/meta_ads/referral/direct/whatsapp/other), entry_channel, utm_source/medium/campaign/content/term, landing_path, referrer, fbclid; CTWA source_id/source_url/source_type/headline/body/ctwa_clid. Strings acotados, controles retirados, source/medium UTM en minúsculas, campaign/content/term preservan mayúsculas. URL de referrer/source_url conserva origin+path sin query/fragment/credenciales. landing_path sin query/fragment. No guarda medios del anuncio, claves desconocidas ni payloads masivos.

Primer evento recibido no se sustituye ni se completa con datos de visitas distintas. Materializar web copia source y todo first_touch al lead. WhatsApp conserva ese origen y registra last_channel/whatsapp_verified_at; referral posterior queda en last_referral y mensajes sin referral no lo borran. Al vincular una sesión parcial a un lead previo, el first-touch conocido del lead gana. Meta Lead Ads todavía no conectado: faltan permisos/webhook, recuperación autenticada por leadgen_id, mapeo de respuestas, idempotencia y verificación/resolución de identidad.

Contrato referral corroborado en la [colección oficial Meta Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api?entity=request-13382743-accf558f-2cde-4c15-8921-8fcb11b375ac). ctwa_clid corroborado como identificador CTWA en el [SDK oficial de Meta](https://github.com/facebook/facebook-ruby-business-sdk/blob/main/lib/facebook_ads/ad_objects/server_side/user_data.rb); se captura solo si realmente llega en referral, nunca se sintetiza. developers.facebook.com devolvió 429 durante la consulta; pendiente prueba con payload real autorizado del negocio. No se inspeccionaron mensajes privados de producción.

## Agente y motores congelados

save_intake_answer guarda respuestas explícitas; save_asset_reference sigue disponible. El contexto se refresca después de herramientas. Modelo responde FAQs/reconoce datos sin preguntar; código añade una sola pregunta de nextIntakeQuestion sobre el primer grupo faltante. Se descartan textos del modelo con preguntas/solicitudes detectadas antes de añadir la pregunta controlada. La interpretación/extracción y la semántica de respuestas libres siguen dependiendo del modelo: los tests usan dobles, no garantizan toda paráfrasis posible del proveedor.

Ready detectado antes del proveedor o tras guardar herramientas devuelve cierre fijo, sin nueva pregunta ni llamada al modelo. `intake_handoff` sirve tanto a materialización web (sin conversación) como a WhatsApp: human_required=true, human_reason=intake_v1_ready_for_quote, bot_mode=paused, marcador intake.ready_for_quote, resumen y tarea «Revisar proyecto y preparar cotización». Pausa conversación cuando existe. Misma automation_key en ambos canales; bloqueo del lead e índice UNIQUE evitan tareas duplicadas. Sin status/historial ficticio ni quote. El marcador persistido constata recepción lista; el evaluador sigue determinando readiness actual ante futuras ediciones manuales. Handoff excepcional previo también deja de escribir calificado.

Enrichment sigue disponible como contexto público. Solo ejecuta Prep con WHATSAPP_PROPOSAL_PREP_ENABLED=true. Visual Generator sin modificaciones; WHATSAPP_VISUAL_GENERATION_ENABLED=false. Bruma, imágenes y scripts históricos preservados. No hay generación de imagen, propuesta, pricing, PDF ni email en este batch.

## Validación y pendientes

Revisión dirigida de compatibilidad: phone nullable es compatible con getOrCreateContact (busca el teléfono del transporte), inbox, leads, detalle, hoy, pipeline y análisis. Los renders tienen fallback y las normalizaciones admiten null; los trim del importador trabajan con estado string del formulario. UNIQUE(owner_id,phone) conserva exclusividad para teléfonos presentes y admite varios NULL; probado contra SQL local, incluida la vista crm_inbox.

Pendiente de identidad entre sesiones: dos sesiones distintas con el mismo email normalizado todavía crean dos contactos/leads/tareas. Cada sesión sí es idempotente. No se implementó dedupe automático por email no verificado: compartir contacto permitiría que el ECW de otra sesión estableciera un teléfono sobre una identidad ajena y afectara sus otros leads. Resolverlo requiere verificación de email o reconciliación humana explícita; no basta un índice o lookup por owner+email. La prueba deja documentado el aislamiento actual. Email-only → ECW → webhook conserva exactamente contacto/lead/first-touch, verifica el teléfono y no repregunta, incluso con reintento.

Validación final dirigida: 66 tests pasan, cero skipped (45 originales + 21 web/CRM). Se amplió la prueba email-only y la auditoría SQL de las ocho RPC: SECURITY INVOKER, search_path vacío, EXECUTE denegado a anon/authenticated y RLS activo. Sin cambios adicionales al schema ni al código productivo en esta revisión; migración únicamente local.

node:test para dominio, agente, webhook y endpoint; se mantienen las 45 pruebas anteriores. `scripts/test-intake-web-crm.mjs` añade 19 pruebas del servicio/endpoint/webhook productivos contra PostgreSQL local: los diez requisitos web-only, email-only, aislamiento, reintentos, selección del lead exacto frente a otro reciente, atribución, rollback ante fallo de tarea y recuperación por GET. Las simulaciones concurrentes usan el runtime local serializado; revisar concurrencia multiconexión en integración aislada antes de publicar. PGlite sigue instalado fuera del repo, sin dependencia/framework nuevo. Las pruebas SQL requieren ECW_PGLITE_MODULE; no considerar validación completa si aparecen skipped.

Pendiente antes de publicación: revisión/aplicación autorizada de migración (incluido contacts.phone nullable), prueba con Supabase/Meta/OpenAI reales, UI de onboarding/webchat, uploads, limpieza por retención, antiabuso de hosting y entrega durable/reintentos del webhook existente. Web-only ya termina en CRM, sin depender de WhatsApp. Si falla envío después de persistir/pausar, el mecanismo previo de deduplicación no garantiza reenvío; no se añadió outbox. El esquema local y los mocks no sustituyen integración aislada.
