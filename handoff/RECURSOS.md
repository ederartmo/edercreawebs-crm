# Avisos de Recursos: recepción de correos

El frontend EderCreaWebs envía `{ email, consent: true, consentVersion:
"recursos-v1", website: "" }` a su propia ruta `/api/resources/subscribe`; esta
lo reenvía al mismo path del CRM. En desarrollo Vite lo reenvía directamente al
CRM. El navegador nunca recibe la clave administrativa de Supabase.

La ruta del CRM exige `RESOURCES_WEB_ENABLED=true` y el encabezado `Origin` igual
a `RESOURCES_WEB_ORIGIN`. Valida JSON, tamaño de hasta 2048 bytes, correo,
consentimiento versionado y campo trampa vacío. Antes de escribir se comprueba
la URL Supabase autorizada `https://ycdosrsanutbhbgejwwg.supabase.co`.

Se usa `upsert` con `onConflict: email` e `ignoreDuplicates: true`: no cambia una
fecha de alta anterior ni borra `unsubscribed_at`. Solo se confirma `{ ok: true }`
cuando Supabase responde sin error. Los errores son genéricos, sin correos,
credenciales ni detalles internos. No hay endpoint de lectura pública.

La tabla `public.resource_subscribers` ya se creó por solicitud de Eder mediante
su conexión Supabase. Su migración está documentada en el repositorio del
frontend: `supabase/migrations/20261018000100_resource_subscribers.sql`.
Tiene RLS activo y permisos exclusivamente de backend entre los roles de la app.
El flujo de confirmación posterior añade únicamente columnas/RPC a esta tabla;
ver `handoff/RESEND.md`. No se modifican otras tablas anteriores.

## Pruebas y ejecución local

Desde la raíz del CRM:

```powershell
./scripts/start.ps1 -DryRun
$env:RESOURCES_WEB_ENABLED = 'true'
$env:RESOURCES_WEB_ORIGIN = 'http://127.0.0.1:5174'
npm run dev -- --hostname 127.0.0.1 --port 3001
```

El launcher carga el entorno externo en el proceso. No imprimir valores ni copiar
claves a archivos del frontend. La vista del formulario corre en
`http://127.0.0.1:5174/#resources`; sus registros se guardan en Supabase real.

```powershell
node --test scripts/test-resource-subscription.mjs scripts/test-intake.mjs
npm run build
```

Se verificó el recorrido real de navegador a Supabase, una fila por correo,
consentimiento y timestamps, y una baja preservada tras repetir el registro.
Se limpiaron exactamente los correos `qa.resources.supabase.mobile-390@example.invalid`,
`qa.resources.supabase.mobile-360@example.invalid` y
`qa.resources.supabase.desktop@example.invalid`; no se enviaron comunicaciones.

## Publicación pendiente

No se ha desplegado este cambio. Para activarlo en producción, desplegar el CRM
y el frontend, fijar `RESOURCES_WEB_ORIGIN` al origen HTTPS exacto de la web y
`RESOURCES_WEB_ENABLED=true`, y configurar `RESOURCES_BACKEND_ORIGIN` o el
`INTAKE_BACKEND_ORIGIN` existente en el frontend. Mantener los secretos únicamente
en el CRM. La integración de Resend está preparada; su configuración y activación
se documentan en `handoff/RESEND.md`.
