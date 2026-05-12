# Prompt para Codespace Agent — CRM Interno EderCreaWebs Nivel 1

Usa los documentos dentro de `/docs` como fuente de verdad para el CRM Interno EderCreaWebs Nivel 1.

## Contexto

El CRM es una herramienta interna para organizar leads, clientes, proyectos, checklist, pagos, links y próximas acciones.

No se debe construir como un SaaS completo ni como portal para clientes.

## Rutas previstas

```text
/login
/dashboard
/leads
/leads/[id]
/clientes
/clientes/[id]
/proyectos
/proyectos/nuevo
/proyectos/[id]
/pagos
```

## Reglas de negocio clave

- No permitir avanzar a diseño o desarrollo si el anticipo no está confirmado.
- No permitir entrega o publicación final si el segundo pago no está confirmado, salvo excepción futura.
- Todo proyecto debe crearse con checklist base.
- Todo proyecto debe tener `next_action`.
- El dominio debe poder quedar como `pendiente`, `confirmado`, `comprado` o `conectado`.
- La UI de mantenimiento no es prioridad en la primera fase técnica aunque el schema pueda contemplarla.

## Restricciones globales

- No construyas todo el CRM en una sola tarea.
- No inventes funcionalidades fuera del Nivel 1.
- No crees portal de cliente.
- No agregues automatizaciones.
- No integres WhatsApp, Gmail, Drive ni Calendar.
- Mantén el código limpio, simple y escalable.

## Forma de trabajo obligatoria

No construyas todo el CRM en una sola tarea.

Trabaja por fases pequeñas, verificables y acumulativas.

Antes de modificar código:

1. Revisa los documentos dentro de `/docs`.
2. Resume el alcance de la fase actual.
3. Identifica archivos que vas a crear o modificar.
4. Implementa solo la fase solicitada.
5. Ejecuta lint/build si aplica.
6. Resume qué cambió y qué falta.

No avances a la siguiente fase sin que la fase actual esté estable.

## Prompt inmediato para Fase 1 técnica

```text
Usa los documentos dentro de /docs como fuente de verdad para el CRM Interno EderCreaWebs Nivel 1.

No construyas todo el CRM todavía.

Implementa únicamente la Fase 1 técnica.

Objetivo de esta fase:
- Configurar la base del proyecto Next.js.
- Configurar Tailwind CSS.
- Configurar shadcn/ui.
- Configurar Supabase client.
- Crear archivo .env.example con variables necesarias.
- Crear layout base con sidebar + header.
- Crear página /login visualmente funcional.
- Crear página /dashboard placeholder.
- Crear navegación base para:
  - Dashboard
  - Leads
  - Clientes
  - Proyectos
  - Pagos

Restricciones:
- No implementes CRUD todavía.
- No implementes auth completa si requiere credenciales reales; deja la estructura lista para Supabase Auth.
- No crees portal de cliente.
- No agregues automatizaciones.
- No integres WhatsApp, Gmail, Drive ni Calendar.
- No inventes funcionalidades fuera del Nivel 1.

Estilo:
- Limpio
- Profesional
- Administrativo
- Sidebar + header
- Cards blancas
- Fondo gris claro
- Badges preparados para estados
- Componentes reutilizables cuando tenga sentido

Al terminar:
1. Ejecuta lint/build si aplica.
2. Resume archivos creados o modificados.
3. Indica cómo correr el proyecto.
4. Indica el siguiente paso recomendado.
```

## Prompt recomendado para Fase 2 técnica

```text
Implementa la Fase 2 técnica del CRM Nivel 1.

Objetivo:
- Aplicar o preparar el schema de Supabase usando docs/supabase_schema_crm_nivel_1.sql.
- Crear tipos TypeScript para los enums principales.
- Crear helpers para estados visibles.
- Crear configuración de Supabase Auth.
- Proteger rutas internas para que /dashboard, /leads, /clientes, /proyectos y /pagos requieran sesión.
- Mantener /login pública.

Restricciones:
- No implementes todavía CRUD completo.
- No agregues funcionalidades fuera del Nivel 1.
- No crees portal de cliente.

Al terminar:
1. Ejecuta lint/build si aplica.
2. Resume cambios.
3. Indica próximos pasos.
```

## Orden ideal de prompts

1. Fase 1: Base técnica + layout + login visual + dashboard placeholder
2. Fase 2: Supabase Auth + protección de rutas + types/helpers
3. Fase 3: CRUD leads
4. Fase 4: CRUD clientes + convertir lead a cliente
5. Fase 5: CRUD proyectos + checklist automático
6. Fase 6: Detalle de proyecto: checklist, notas, links, pagos
7. Fase 7: Dashboard real + Kanban
8. Fase 8: Pulido, pruebas, seed data y deploy
