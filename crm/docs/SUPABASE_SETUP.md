# Configuración de Supabase · Fase 2

Este archivo documenta los pasos necesarios para configurar Supabase y aplicar el schema del CRM.

## 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto (elige región, contraseña de BD)
3. Espera a que se complete (5-10 min)
4. Ve a **Settings → API** y copia:
   - `Project URL`
   - `Publishable key` (pública)
   - `Service role key` (secreta, solo backend)

## 2. Configurar variables de entorno

En `crm/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-publishable-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
```

⚠️ **Nunca** expongas `SUPABASE_SERVICE_ROLE_KEY` al cliente. Solo úsalo en backend/server-side.

Para esta fase (Auth + rutas protegidas + base para CRUD con RLS) normalmente basta con:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Deja `SUPABASE_SERVICE_ROLE_KEY` configurada solo para uso futuro en operaciones administrativas server-side.

## 3. Aplicar el Schema SQL

El archivo `docs/supabase_schema_crm_nivel_1.sql` contiene:
- Extensiones (pgcrypto)
- Tipos enumerados (app_role, crm_status, etc.)
- Tablas base (se completarán en Fase 3+)
- Funciones helper (set_updated_at)

**Cómo aplicarlo manualmente:**

1. Ve a **SQL Editor** en Supabase Dashboard
2. Haz clic en **New Query**
3. Copia todo el contenido de `docs/supabase_schema_crm_nivel_1.sql`
4. Pégalo en el editor
5. Haz clic en **Execute** (botón play ▶)
6. Espera a que termine (sin errores)

## 4. Verificar setup

```bash
# En crm/
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000):
- Debe redirigir a `/login` (no hay sesión)
- Ingresa un correo/contraseña válidos desde Supabase Auth

Para crear usuarios de prueba:
1. Ve a **Authentication → Users** en Supabase
2. Haz clic en **Add user**
3. Inicia sesión en el CRM con esas credenciales

## 5. Resto de rutas protegidas

- `/dashboard` → protegido, requiere sesión activa
- `/leads`, `/clientes`, `/proyectos`, `/pagos` → protegidos
- `/login` → público
- `/auth/callback` → usado por OAuth o Magic Links

**Middleware en `src/middleware.ts`** gestiona las redirecciones automáticas.

## Siguiente paso: Fase 3 (CRUD Leads)

Una vez verificada la autenticación:
1. Aplicar tablas del schema (leads, clientes, proyectos, etc.)
2. Crear componentes de CRUD
3. Implementar Row-Level Security (RLS)

---

**Notas importantes:**

- `NEXT_PUBLIC_SUPABASE_URL` se obtiene en Supabase Project Settings → API
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` es la llave pública publishable
- `SUPABASE_SERVICE_ROLE_KEY` es secreta y no debe ir al navegador
- Si cambias `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, reinicia el servidor (`npm run dev`)
- La autenticación usa cookies vía `@supabase/ssr` para SSR seguro
