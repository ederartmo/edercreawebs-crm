# CRM Interno EderCreaWebs — Especificación Funcional Nivel 1

## Objetivo

Construir una herramienta interna para organizar leads, clientes, proyectos, pagos, pendientes, links importantes y próximas acciones, con foco en responder todos los días:

> ¿Qué cliente tengo, en qué etapa está, qué falta, cuánto ha pagado y qué sigue?

## Alcance MVP

### Incluye

- Login interno
- Dashboard operativo
- CRUD de leads
- CRUD de clientes
- CRUD de proyectos
- Estados de proyecto
- Checklist automático por proyecto
- Notas internas
- Pagos manuales
- Links importantes
- Vista tabla
- Vista Kanban simple
- Próximas acciones

### No incluye

- Portal para cliente
- Automatizaciones con WhatsApp
- Integraciones completas con Google Drive, Gmail o Calendar
- Pagos integrados
- Facturación
- Roles avanzados
- Subida de archivos
- Cotizaciones automáticas avanzadas

## Flujo base

```text
Lead entra
↓
Se diagnostica
↓
Se manda cotización
↓
Espera anticipo
↓
Se convierte en cliente/proyecto
↓
Se pide información
↓
Diseño
↓
Desarrollo
↓
Revisión
↓
Segundo pago
↓
Entrega
↓
Mantenimiento
```

## Primer objetivo real del MVP

El MVP debe permitir:

1. Iniciar sesión.
2. Crear lead.
3. Cambiar estado del lead.
4. Convertir lead en cliente.
5. Crear proyecto.
6. Ver checklist del proyecto.
7. Marcar tareas como hechas.
8. Guardar links importantes.
9. Registrar pagos manualmente.
10. Ver dashboard con pendientes.

## Pantallas mínimas

```text
/login
/dashboard
/leads
/clientes
/proyectos
/proyectos/[id]
/pagos
```

## Dashboard

Debe responder qué se debe hacer hoy y mostrar:

- Leads nuevos
- Cotizaciones enviadas
- Esperando anticipo
- Proyectos en diseño
- Proyectos en desarrollo
- Proyectos en revisión
- Pagos pendientes
- Clientes en mantenimiento

### Cards sugeridas

- Leads nuevos
- Esperando anticipo
- En desarrollo
- Pagos pendientes en MXN

### Tabla de próximas acciones

Columnas sugeridas:

- Cliente / Lead
- Proyecto
- Estado
- Próxima acción
- Fecha límite
- Monto pendiente
- Link rápido al proyecto

## Estados

### Estados internos

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

### Etiquetas visibles

```text
Lead nuevo
Diagnóstico
Cotización enviada
Esperando anticipo
Información pendiente
Diseño
Diseño enviado
Ajustes de diseño
Desarrollo
Revisión cliente
Segundo pago pendiente
Publicado
Entregado
Mantenimiento
Perdido
```

## Módulos

### Leads

Campos:

- Nombre
- Empresa
- WhatsApp
- Correo
- Qué vende
- Qué necesita
- Fuente
- Estado
- Notas
- Fecha de contacto

Fuentes:

- Meta Ads
- Instagram
- Facebook
- Referido
- WhatsApp
- Sitio web
- Otro

Estados sugeridos para leads:

- Nuevo lead
- Respondido
- En diagnóstico
- Pendiente de información
- Cotización enviada
- No respondió
- Cliente ganado
- Cliente perdido

### Clientes

Campos:

- Nombre
- Empresa
- Correo
- WhatsApp
- Teléfono
- RFC
- Ubicación
- Redes sociales
- Sitio actual
- Notas generales
- Fecha de creación

### Proyectos

Campos:

- Cliente
- Lead relacionado
- Tipo de proyecto
- Nombre del proyecto
- Precio total
- Anticipo
- Segundo pago
- Estado
- Fecha de inicio
- Fecha estimada de entrega
- Link de Drive
- Link de cotización
- Link de sitio en prueba
- Link de sitio final
- Próxima acción
- Notas internas

Tipos sugeridos:

- Landing page
- Sitio web informativo
- Sitio web con formulario
- Sitio web con agenda
- Sitio web con chatbot
- Sitio web con pagos
- Sistema con login
- Portal de clientes
- Dashboard administrativo
- Automatización
- Mantenimiento

### Checklist por proyecto

Todo proyecto debe generarse con este checklist base:

```text
[ ] Responder lead
[ ] Identificar qué vende
[ ] Identificar qué espera
[ ] Identificar herramienta necesaria
[ ] Pedir referencias
[ ] Crear carpeta Drive
[ ] Crear documento de info base
[ ] Pedir fotos/videos/contenido
[ ] Preparar cotización
[ ] Enviar propuesta
[ ] Solicitar anticipo 50%
[ ] Confirmar anticipo
[ ] Confirmar dominio
[ ] Comprar dominio
[ ] Contratar hosting
[ ] Definir fechas
[ ] Analizar conversación y referencias
[ ] Generar resumen estratégico
[ ] Crear propuesta de diseño
[ ] Enviar diseño
[ ] Aprobar diseño
[ ] Desarrollar sitio/sistema
[ ] Probar responsive
[ ] Probar formularios
[ ] Enviar versión de revisión
[ ] Aplicar ajustes
[ ] Solicitar segundo pago
[ ] Confirmar segundo pago
[ ] Publicar
[ ] Entregar accesos
[ ] Ofrecer mantenimiento
[ ] Cerrar proyecto
```

### Notas internas

Deben permitir guardar contexto operativo del proyecto o cliente.

### Pagos

Campos:

- Proyecto
- Concepto
- Monto
- Estado
- Fecha límite
- Fecha de pago
- Método de pago
- Notas

Estados:

- Pendiente
- Pagado
- Vencido
- Cancelado

### Links importantes

Tipos recomendados:

- drive
- quote
- design
- test_site
- final_site
- repository
- hosting
- domain
- admin_panel
- other

## Tablas requeridas

- profiles
- leads
- clients
- projects
- project_tasks
- project_notes
- payments
- project_links

## Reglas de negocio

1. Un proyecto puede existir antes del anticipo, pero no debe pasar a `Diseño` ni `Desarrollo` sin confirmar el primer pago.
2. El sistema debe registrar si el dominio está confirmado, comprado o pendiente.
3. Las fechas se definen solo después de revisar alcance, contenido, integraciones, dominio, hosting y pagos.
4. Todo proyecto debe tener checklist automático.
5. Todo proyecto debe tener `next_action`.
6. No se debe entregar o publicar definitivamente sin segundo pago, salvo acuerdo especial.
7. Al entregar un proyecto debe existir una tarea para ofrecer mantenimiento.

## Criterios de terminado del Nivel 1

El Nivel 1 se considera útil cuando permite:

1. Entrar con usuario.
2. Registrar un lead.
3. Cambiar estado del lead.
4. Convertirlo en cliente.
5. Crear proyecto.
6. Ver proyecto en dashboard.
7. Ver proyecto en Kanban.
8. Marcar tareas del checklist.
9. Agregar notas.
10. Registrar pago pendiente.
11. Marcar pago como pagado.
12. Guardar links importantes.
13. Ver próxima acción.

## Stack recomendado

- Next.js
- Supabase
- Tailwind CSS
- shadcn/ui
- Vercel

## Frase guía

> Primero orden interno. Después experiencia premium para el cliente.
