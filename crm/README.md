# EderCreaWebs CRM · Nivel 1

Sistema CRM interno para gestión de leads, clientes, proyectos y pagos.

**Estado:** Fase 2 · Autenticación + Rutas Protegidas

---

## Quick Start

### 1. Instalar dependencias
```bash
cd crm
npm install
```

### 2. Configurar Supabase
```bash
# Copiar variables de entorno
cp .env.example .env.local

# Editar .env.local con tus credenciales de Supabase
# Ver docs/SUPABASE_SETUP.md para instrucciones detalladas
```

Variables esperadas en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-publishable-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
```

`SUPABASE_SERVICE_ROLE_KEY` es solo para backend/server-side y nunca debe usarse en componentes cliente ni exponerse como `NEXT_PUBLIC_*`.

### 3. Iniciar servidor de desarrollo
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)
- Redirige a `/login` (no hay sesión)
- Crea usuario en Supabase Auth y prueba login/logout

### 4. Build para producción
```bash
npm run build
npm start
```

---

## Tecnología

- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS v4
- **UI:** shadcn/ui components
- **Base de datos:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth + SSR cookies
- **Protección de rutas:** Next.js Middleware

---

## Estructura

```
crm/
├── src/
│   ├── app/
│   │   ├── (app)/            # Rutas protegidas
│   │   │   ├── dashboard/
│   │   │   ├── leads/
│   │   │   ├── clientes/
│   │   │   ├── proyectos/
│   │   │   ├── pagos/
│   │   │   └── layout.tsx     # Layout con sidebar + header
│   │   ├── login/             # Ruta pública
│   │   ├── auth/callback/     # Callback de OAuth
│   │   └── layout.tsx         # Layout raíz
│   ├── components/
│   │   ├── auth/              # AuthProvider
│   │   ├── layout/            # Sidebar, Header
│   │   └── ui/                # shadcn/ui
│   ├── lib/
│   │   └── supabase/          # Clients, middleware
│   ├── types/                 # Tipos CRM
│   └── config/                # Navegación
├── middleware.ts              # Protección de rutas
└── docs/
    └── SUPABASE_SETUP.md      # Guía de configuración
```

---

## Rutas

| Ruta | Estado | Requerimientos |
|------|--------|---|
| `/login` | Pública | – |
| `/dashboard` | Protegida | Autenticación activa |
| `/leads` | Protegida | Autenticación activa |
| `/clientes` | Protegida | Autenticación activa |
| `/proyectos` | Protegida | Autenticación activa |
| `/pagos` | Protegida | Autenticación activa |

---

## Documentación

- [Supabase Setup](docs/SUPABASE_SETUP.md) — Configuración de BD y auth
- [docs/crm_nivel_1_especificacion.md](../docs/crm_nivel_1_especificacion.md) — Requisitos funcionales
- [docs/ui_crm_nivel_1.md](../docs/ui_crm_nivel_1.md) — Wireframes

---

## Mejoras pendientes

- Exigir al menos email o teléfono antes de convertir un lead a cliente para reforzar prevención de duplicados.

## Siguiente fase

**Fase 6:** Detalle de proyecto `/proyectos/[id]`
- Checklist operativo del proyecto
- Notas internas por proyecto
- Pagos del proyecto
- Links del proyecto (Drive, diseño, test, final)
