# Resend y confirmación de Recursos

Se registró `edercreawebs.com` en Resend y se verificó desde su panel. Dominio:
`https://resend.com/domains/d565fa57-9e35-47e1-93cc-ae3f13cec2ef`.

## DNS aplicado

Se agregaron mediante la API de Hostinger, con `overwrite=false`, únicamente:

- TXT `resend._domainkey`: clave pública DKIM proporcionada por Resend, TTL 3600.
- CNAME `rsend` → `rsend.forge.rmta.net`, TTL 3600.
- CNAME `send` → `send.forge.rmta.net`, TTL 3600.

La comparación completa antes/después confirmó que los registros anteriores
permanecieron iguales. Se conservaron los MX, SPF, DKIM de Hostinger, DMARC y los
registros del sitio/CRM. El dominio mostró estado **Verified**. No se habilitó
recepción de correo en Resend. La autenticación mejora la entrega; no garantiza
que cada destinatario lo reciba en bandeja principal.

## Flujo preparado

El registro sigue guardando en Supabase. Si `RESOURCES_CONFIRMATION_ENABLED=true`,
el CRM reserva una solicitud, firma un token y envía un correo transaccional de
confirmación mediante Resend. El remitente predeterminado es
`EderCreaWebs <recursos@edercreawebs.com>`; se puede configurar con `RESEND_FROM`.

Asunto: «Confirma tu correo para recibir recursos de EderCreaWebs».
El correo tiene versiones HTML y texto, botón «Confirmar mi correo», explicación
de su propósito y vencimiento a las 24 horas. La vista previa se generó en
`outputs/resource-confirmation-email.html` del frontend, con un enlace ficticio.
Diseño revisado: fondo cálido claro, tarjeta blanca, marca tipográfica, título
«Confirma tu correo.», botón negro de ancho completo y firma de Eder. Tiene
preheader y estilos móviles, sin depender de imágenes ni fuentes remotas.
Se usa la misma función `buildConfirmationEmail` para vista previa y envío.

El enlace abre `/api/resources/confirm#token=...` en el origen público del CRM.
La página exige pulsar «Confirmar suscripción»: un GET o un escáner de enlaces no
confirma el correo. El token no contiene el correo y viaja en el fragmento, que
no se envía al servidor; la página lo quita de la barra al abrir. POST valida
firma, fecha y origen antes de confirmar en Supabase. No se guardan tokens sin
firmar ni claves en la base o en el navegador.

Las solicitudes repetidas preservan la fecha original y las bajas. La reserva
en Supabase y la clave de idempotencia de Resend evitan duplicar el mensaje:
un envío fallido puede repetirse con el mismo token y payload; uno ya aceptado
no vuelve a enviarse durante 24 horas. No se envían confirmaciones a bajas ni a
correos ya confirmados. Los existentes no se marcan confirmados automáticamente.

## Configuración privada pendiente de activación

Las variables pertenecen solo al CRM:

Eder confirmó que `RESEND_API_KEY` ya está guardada en las variables del CRM en
Hostinger. No se leyó ni se copió su valor y no se modificó ese entorno remoto.

```dotenv
RESEND_API_KEY=
RESEND_FROM=EderCreaWebs <recursos@edercreawebs.com>
RESOURCES_EMAIL_SIGNING_SECRET=
RESOURCES_CONFIRMATION_ORIGIN=https://crm.edercreawebs.com
RESOURCES_CONFIRMATION_ENABLED=false
```

La clave de Resend puede tener permiso Sending access restringido al dominio.
El secreto de firma debe ser aleatorio y tener al menos 32 caracteres. No usar
variables `NEXT_PUBLIC_*`, ni guardar valores reales en Git o en el chat.
El origen debe ser el CRM donde esté desplegada la ruta de confirmación. El flag
queda desactivado hasta configurar las credenciales y publicar las rutas; de lo
contrario un correo real llevaría a una página todavía no desplegada.

La migración `supabase/migrations/20261018062000_resource_confirmation.sql`
añade el identificador opaco, fechas de solicitud/envío/confirmación y dos RPC
solo para `service_role`. Solo enviar avisos futuros si `confirmed_at IS NOT NULL`
y `unsubscribed_at IS NULL`. No se implementó ni lanzó una campaña de recursos.

No se ha enviado ningún correo real ni hecho deploy web, commit o push.

## Validación

Build de producción y TypeScript correctos; lint dirigido y `git diff --check`
sin errores. Pasaron 34 pruebas de Recursos/Intake del CRM, incluidas firma,
vencimiento, reintentos idempotentes, confirmación y controles de origen.
Las RPC se probaron en transacciones revertidas, sin dejar suscriptores de QA.
El frontend pasó 9 pruebas del formulario y 6 de la página/correo de confirmación
en tres tamaños; el envío y el POST de confirmación de esas pruebas se simularon.
La suite global del frontend conserva un fallo preexistente del texto del hero
(225/226 correctas); las 6 pruebas unitarias del proxy de Recursos pasan.
