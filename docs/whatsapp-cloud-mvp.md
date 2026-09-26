# WhatsApp Cloud MVP

## Objetivo de esta rama

Conectar el número aprobado de WhatsApp Cloud API con el CRM sin n8n ni VPS.

La primera prueba deliberadamente es pequeña:

1. Meta verifica el webhook.
2. Llega un mensaje de texto real.
3. Se crea o reutiliza contacto, lead y conversación en Supabase.
4. Se guarda el mensaje entrante usando `provider_message_id` para evitar duplicados.
5. Si es el primer mensaje de la conversación, se responde automáticamente:

> Hola 😁 Cuéntame un poco de tu negocio: ¿qué vendes y cómo suelen llegarte actualmente tus clientes?

6. La respuesta saliente también se guarda en `messages`.

Todavía no hay IA ni flujo de diagnóstico completo en esta fase. El objetivo es validar primero el circuito WhatsApp → Next.js → Supabase → WhatsApp.

## Endpoint

```text
GET  /api/whatsapp/webhook
POST /api/whatsapp/webhook
```

El `GET` resuelve la verificación de Meta con `hub.verify_token` y `hub.challenge`.

El `POST` acepta eventos de WhatsApp. En este MVP procesa únicamente mensajes de texto. Eventos de estado, lectura o entrega se reconocen con 200 pero todavía no se almacenan.

## Variables necesarias

Copia `.env.example` a `.env.local` para desarrollo y configura las mismas variables en el proveedor de despliegue.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRM_OWNER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_GRAPH_API_VERSION=
META_APP_SECRET=
```

### Seguridad

- `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN` y `META_APP_SECRET` son secretos de servidor.
- Nunca usar prefijo `NEXT_PUBLIC_` en esos secretos.
- No pegarlos en commits, screenshots o documentación.
- `META_APP_SECRET` es recomendado para producción. Si existe, el webhook exige una firma `x-hub-signature-256` válida.

## Configuración en Meta

Cuando exista un deployment HTTPS público de esta rama:

1. Usar como callback:
   `https://<dominio>/api/whatsapp/webhook`
2. Definir un valor aleatorio como `WHATSAPP_VERIFY_TOKEN` y usar el mismo en Meta.
3. Suscribir el webhook al campo de mensajes de WhatsApp.
4. Configurar el token de acceso, Phone Number ID y versión de Graph API en variables de entorno.
5. Configurar `META_APP_SECRET` antes de considerar el endpoint listo para producción.

## Prueba de aceptación V0

Desde otro WhatsApp:

```text
Hola, quiero una página
```

Resultado esperado:

```text
Hola 😁 Cuéntame un poco de tu negocio: ¿qué vendes y cómo suelen llegarte actualmente tus clientes?
```

Además deben existir en Supabase:

- contacto;
- lead;
- conversación;
- mensaje inbound;
- mensaje outbound.

Si Meta reintenta el mismo mensaje, `provider_message_id` debe impedir que el flujo lo procese dos veces.

## Siguiente fase después de validar V0

Agregar el motor comercial que extraiga, sin preguntarle al prospecto "cuál es su problema":

- qué vende;
- cómo llegan los clientes;
- cómo ocurre la venta;
- si requiere pago directo;
- si requiere cotización;
- si requiere panel/operación;
- redes o sitio del negocio;
- información crítica faltante.

Cuando haya contexto suficiente, el bot debe dejar de preguntar y marcar el lead para intervención humana y propuesta visual.
