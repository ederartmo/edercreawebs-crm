# Prompt para Codespace Agent — CRM Interno EderCreaWebs Nivel 1

Construye un CRM interno para EderCreaWebs enfocado en operación interna, no en experiencia de cliente.

## Objetivo

Permitir que el negocio pueda crear leads, convertirlos en clientes, crear proyectos y saber siempre:

- en qué estado está cada proyecto,
- qué falta,
- cuánto ha pagado,
- y cuál es la próxima acción.

## Stack obligatorio

- Next.js
- Supabase
- Tailwind CSS
- shadcn/ui

## Pantallas a crear

```text
/login
/dashboard
/leads
/clientes
/proyectos
/proyectos/[id]
/pagos
```

## Tablas a usar

- profiles
- leads
- clients
- projects
- project_tasks
- project_notes
- payments
- project_links

## Funcionalidad mínima obligatoria

1. Login interno.
2. CRUD de leads.
3. Cambio de estado de lead.
4. Conversión de lead a cliente.
5. CRUD de clientes.
6. CRUD de proyectos.
7. Generación automática del checklist base al crear un proyecto.
8. Visualización y actualización del checklist del proyecto.
9. Registro de notas internas por proyecto.
10. Registro de pagos manuales.
11. Registro de links importantes.
12. Campo y visibilidad de próxima acción en proyectos.
13. Dashboard con métricas operativas y próximas acciones.
14. Vista tipo Kanban simple para proyectos.

## Estados internos del sistema

```text
lead_nuevo
diagnostico
cotizacion_enviada
esperando_anticipo
info_pendiente
diseno
diseno_enviado
ajustes_diseno
desarrollo
revision_cliente
segundo_pago_pendiente
publicado
entregado
mantenimiento
perdido
```

## Reglas de negocio obligatorias

1. No permitir avanzar a diseño o desarrollo si el anticipo no está confirmado.
2. No permitir entrega o publicación final si el segundo pago no está confirmado, salvo excepción explícita futura.
3. Todo proyecto debe crearse con checklist base.
4. Todo proyecto debe tener `next_action`.
5. Debe poder registrarse el estado del dominio como confirmado, comprado o pendiente.
6. Al entregar un proyecto debe quedar contemplada la tarea de ofrecer mantenimiento.

## Checklist base obligatorio

```text
Responder lead
Identificar qué vende
Identificar qué espera
Identificar herramienta necesaria
Pedir referencias
Crear carpeta Drive
Crear documento de info base
Pedir fotos/videos/contenido
Preparar cotización
Enviar propuesta
Solicitar anticipo 50%
Confirmar anticipo
Confirmar dominio
Comprar dominio
Contratar hosting
Definir fechas
Analizar conversación y referencias
Generar resumen estratégico
Crear propuesta de diseño
Enviar diseño
Aprobar diseño
Desarrollar sitio/sistema
Probar responsive
Probar formularios
Enviar versión de revisión
Aplicar ajustes
Solicitar segundo pago
Confirmar segundo pago
Publicar
Entregar accesos
Ofrecer mantenimiento
Cerrar proyecto
```

## Estilo visual

- Limpio
- Profesional
- Rápido de usar
- Enfoque administrativo
- Sidebar + header
- Tarjetas para métricas
- Tablas para gestión
- Kanban simple y claro

## Qué sí debes entregar en el MVP

- Flujo completo desde lead hasta proyecto en seguimiento
- Dashboard útil con pendientes reales
- Gestión operativa diaria
- Base preparada para crecer a portal de cliente en futuro

## Qué no debes inventar

- Portal para clientes
- Automatizaciones con WhatsApp
- Integraciones completas con Gmail, Calendar o Drive
- Pagos reales integrados
- Facturación
- Roles avanzados
- Comentarios del cliente
- Subida de archivos

## Criterio de éxito

El MVP queda listo cuando un usuario interno puede:

1. iniciar sesión,
2. crear un lead,
3. cambiar su estado,
4. convertirlo en cliente,
5. crear un proyecto,
6. ver el proyecto en dashboard,
7. ver el proyecto en kanban,
8. marcar tareas del checklist,
9. registrar pagos,
10. guardar links,
11. agregar notas,
12. y consultar la próxima acción.
