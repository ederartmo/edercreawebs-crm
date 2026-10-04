# EderCreaWebs CRM / WhatsApp Agent

El CRM centraliza contactos, negocios, leads, conversaciones, activos, tareas y seguimiento comercial de EderCreaWebs. WhatsApp Agent V2 conversa con prospectos para entender qué venden, cómo llegan sus clientes y cómo ocurre la venta, sin convertir la conversación en un cuestionario rígido.

**El agente conversa y razona; el código protege acciones de negocio.**

## Flujo y arquitectura actuales

WhatsApp Cloud API → webhook Next.js → texto o descarga/transcripción de audio → contexto CRM → agente OpenAI Responses → herramientas controladas → Supabase → referencias de negocio → enriquecimiento público.

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
- APIs adicionales de imagen, PDF, transcripción y análisis de leads; importador de conversaciones WhatsApp.

## Implementado y límites

El código incluye webhook V2, texto/audio, transcripción, agente conversacional, contexto persistente, `save_business_context`, `save_sales_process`, `mark_assets_requested`, `save_asset_reference`, handoff, alerta administrativa y enriquecimiento. Su presencia se confirmó en código; no equivale a una prueba actual de producción.

El agente no debe prometer condiciones no confirmadas, negociar descuentos, emitir cotización formal, cerrar pagos ni afirmar que investigó una referencia pendiente. Sus herramientas no ofrecen envío de cotizaciones ni cobro. Algunas restricciones son instrucciones al modelo y requieren supervisión; los controles de código actuales no garantizan todas las reglas comerciales.

No existe todavía Proposal Engine completo, generación final automática de propuesta visual, vistas móviles automatizadas, cotización HTML final, envío automático de cotización ni cierre/pago automatizado.

El siguiente gran trabajo planeado es Proposal Engine, usando contexto y enrichment como entrada. Para el estado actual usa `handoff/CURRENT.md`; los documentos antiguos se conservan y pueden describir fases previas.
