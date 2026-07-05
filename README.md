# Eder CRMEste repositorio es la fuente canónica del CRM de EderCreaWebs. Todo desarrollo, migración, despliegue y corrección deberá realizarse aquí mediante ramas y pull requests.No se deben copiar parches entre carpetas ni mantener versiones paralelas del proyecto.## Documentación- [Roadmap V2](docs/roadmap-v2.md)- [Estado actual del proyecto](docs/project-status.md)---

## Estado actual del starter

CRM (MVP) para EderCreaWebs.

Panel inicial para el CRM comercial conectado al esquema de Supabase creado previamente.

## Incluye

- Login con Supabase Auth.
- Proteccion de rutas con `@supabase/ssr`.
- Vista Hoy.
- Pipeline.
- Conversaciones.
- Lista de leads.
- Ficha del lead.
- Tareas.
- Lectura de cotizaciones y pagos.

## Requisitos

- Node.js 20.9 o superior.
- Proyecto de Supabase.
- Esquema SQL V1 ya ejecutado.
- Usuario creado en Supabase Auth.
- Fila de `crm_settings` creada para ese usuario.
- Patch SQL `supabase_patch_after_schema_v1.sql` ejecutado.

## Instalacion

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre:

```text
http://localhost:3000
```

## Variables

En Supabase abre **Project Settings / API** o el dialogo **Connect** y copia:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

No pongas una secret key en variables `NEXT_PUBLIC_*`.

## Nota

El panel mostrara estados vacios hasta que importemos o creemos leads. El siguiente paso es crear el importador de los chats ZIP y despues conectar WhatsApp.
