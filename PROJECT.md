# EderCreaWebs CRM / WhatsApp Agent

El CRM centraliza contactos, negocios, leads, conversaciones, activos, tareas y seguimiento comercial de EderCreaWebs. WhatsApp Agent V2 conversa con prospectos para entender qué venden, cómo llegan sus clientes y cómo ocurre la venta, sin convertir la conversación en un cuestionario rígido.

**El agente conversa y razona; el código protege acciones de negocio.**

## Flujo y arquitectura actuales

WhatsApp Cloud API → webhook Next.js → texto o descarga/transcripción de audio → contexto CRM → agente OpenAI Responses → herramientas controladas → Supabase → referencias de negocio → enriquecimiento público complete → Proposal Prep V1 → visual_proposals draft + cuatro visual_proposal_sections pending → futuro Visual Generator.

El webhook verifica el callback, recibe texto/audio, comprueba duplicados y persiste mensajes. Recupera contexto comercial y hasta 30 mensajes para el agente. Las herramientas permiten guardar contexto y proceso comercial, solicitar referencias, normalizar URLs/handles y guardar activos. El enriquecimiento se programa con Next.js `after()`; investiga información pública y guarda una ficha y fuentes en el activo para turnos posteriores.

El handoff marca intervención humana, guarda resumen y pausa el bot. Las migraciones incluyen un trigger para tareas de seguimiento. El aviso administrativo por WhatsApp es opcional y tolera fallos de envío.

## Stack y módulos

- Next.js 16, App Router y runtime Node.js; React 19, TypeScript 6, Tailwind 4.
- Supabase Auth, helpers cliente/servidor y cliente administrativo exclusivamente de servidor.
- Meta WhatsApp Cloud API, OpenAI Responses y transcripción de audio.
- CRM en `src/app/(crm)`; login y recuperación de contraseña en `src/app`.
- Webhook: `src/app/api/whatsapp/webhook/route.ts`.
- Agente/herramientas: `src/lib/whatsapp/sales-agent.ts`.
- Audio, enriquecimiento y alertas: `audio.ts`, `asset-enrichment.ts`, `admin-alert.ts` en el mismo directorio.
- Brief interno y validaciones: `src/lib/whatsapp/proposal-prep.ts`; pruebas locales: `node --test scripts/test-proposal-prep.mjs`.
- APIs adicionales de imagen, PDF, transcripción y análisis de leads; importador de conversaciones WhatsApp.

## Implementado y límites

El código incluye webhook V2, texto/audio, transcripción, agente conversacional, contexto persistente, `save_business_context`, `save_sales_process`, `mark_assets_requested`, `save_asset_reference`, handoff, alerta administrativa y enriquecimiento. Su presencia se confirmó en código; no equivale a una prueba actual de producción.

El agente no debe prometer condiciones no confirmadas, negociar descuentos, emitir cotización formal, cerrar pagos ni afirmar que investigó una referencia pendiente. Sus herramientas no ofrecen envío de cotizaciones ni cobro. Algunas restricciones son instrucciones al modelo y requieren supervisión; los controles de código actuales no garantizan todas las reglas comerciales.

No existe todavía Proposal Engine completo, generación final automática de propuesta visual, vistas móviles automatizadas, cotización HTML final, envío automático de cotización ni cierre/pago automatizado.

## Proposal Prep Engine V1

`prepareVisualProposalDraft({ leadId, sourceAssetId })` recupera contexto comercial, hasta 40 mensajes inbound/outbound en orden cronológico y referencias del lead. Solo incluye perfiles con enrichment complete; exige que la referencia origen tenga perfil completo, what_sells/how_sells y conversación inbound. Si faltan prerrequisitos, registra fallo reintentable, sin crear propuesta.

Usa Responses API con JSON schema strict, `store: false`, sin herramientas web y modelo `WHATSAPP_PROPOSAL_MODEL` o `gpt-5.6-sol`. El brief incluye diagnóstico, solución propuesta, dirección visual mobile first, exactamente cuatro secciones elegidas según el caso, información faltante, supuestos a evitar, confianza y readiness. Validación local adicional exige posiciones ordenadas 1–4, project_type válido, ausencia de campos extra y colores presentes en perfiles completos; rechaza patrones de importes monetarios. No genera imágenes, HTML, cotizaciones ni precios y no envía el brief al prospecto.

Persiste JSON en visual_proposals.direction_notes (draft) y briefs autónomos por sección (pending). Reutiliza/actualiza el último draft propio de proposal_prep_v1; si la última versión es ajena, aprobada o enviada, crea max(version)+1. No vuelve a un draft antiguo tras una versión protegida. Upsert por proposal_id,position; conflictos de versión se resuelven releyendo hasta tres veces, y la actualización del draft comprueba que status/notas/aprobación/envío no cambiaron. Se verifica que persistieron exactamente cuatro posiciones y briefs coherentes antes de completar. No hay transacción entre tablas: un fallo parcial exige reintento; las restricciones únicas evitan duplicados, pero no sustituyen un bloqueo entre procesos.

`enrichBusinessReferenceAsset` dispara Prep como paso separado fuera de su catch, tanto al terminar como al reintentar una referencia ya complete. Su fallo conserva enrichment complete. automation_runs usa workflow whatsapp-proposal-prep-v1, estados started/completed/failed e input/output pequeños (IDs, versión, conteo, readiness); los errores son códigos por etapa, sin conversación ni respuestas del proveedor.

El lead conserva activos_recibidos: un brief todavía no es una propuesta con imágenes. Visual Generator y Quote Generator permanecen pendientes. El agente confirma recepción de referencias, explica su utilidad para aterrizar la propuesta y solo pregunta una incógnita comercial si puede cambiar la solución, sin afirmar investigación recién hecha ni prometer plazos.

Validado localmente con dobles sin red; columnas, enum y restricciones únicas comprobadas remotamente solo en lectura. No se probó generación real OpenAI ni se escribió/desplegó producción. Para el estado actual usa `handoff/CURRENT.md`; los documentos antiguos se conservan y pueden describir fases previas.
