# UI CRM Nivel 1 — Wireframe Textual

## Estilo general

- Herramienta interna, rápida y funcional
- Layout con sidebar + topbar
- Tablas limpias para administración
- Kanban simple para estado de leads y proyectos
- Cards resumidas en dashboard

## Rutas base

```text
/login
/dashboard
/leads
/clientes
/proyectos
/proyectos/[id]
/pagos
```

## /login

Objetivo: acceso interno.

Elementos:

- Logo o nombre del CRM
- Campo correo
- Campo contraseña
- Botón "Iniciar sesión"

## /dashboard

Objetivo: responder "¿Qué tengo que hacer hoy?"

Secciones:

1. Cards superiores
   - Leads nuevos
   - Esperando anticipo
   - En desarrollo
   - Pagos pendientes
2. Tabla "Próximas acciones"
   - Cliente / Lead
   - Proyecto
   - Estado
   - Próxima acción
   - Fecha límite
   - Monto pendiente
   - Link rápido
3. Resumen lateral opcional
   - Proyectos en diseño
   - Proyectos en revisión
   - Clientes en mantenimiento

## /leads

Objetivo: administrar entradas nuevas.

Vista tabla:

- Nombre
- Empresa
- WhatsApp
- Correo
- Fuente
- Estado
- Fecha de contacto
- Próxima acción
- Acciones

Acciones:

- Crear lead
- Editar
- Cambiar estado
- Convertir a cliente

Vista Kanban simple:

- Nuevo lead
- Diagnóstico
- Cotización enviada
- Esperando anticipo
- Perdido

Tarjeta de lead:

- Nombre / empresa
- Qué necesita
- Estado
- Fuente
- Próxima acción

## /clientes

Objetivo: consultar clientes confirmados.

Vista tabla:

- Nombre
- Empresa
- Correo
- WhatsApp
- RFC
- Sitio actual
- Proyectos activos
- Acciones

Ficha sugerida:

- Datos generales
- Redes sociales
- Notas
- Lista de proyectos relacionados

## /proyectos

Objetivo: ser el módulo principal de operación.

Vista tabla:

- Proyecto
- Cliente
- Tipo
- Estado
- Precio total
- Anticipo
- Segundo pago
- Próxima acción
- Fecha estimada
- Acciones

Vista Kanban:

- Lead nuevo
- Cotización enviada
- Esperando anticipo
- Diseño
- Desarrollo
- Revisión cliente
- Entregado
- Mantenimiento

Tarjeta Kanban:

- Nombre de empresa
- Nombre del proyecto
- Estado
- Precio total
- Pago pendiente
- Próxima acción
- Fecha estimada

## /proyectos/[id]

Objetivo: concentrar toda la operación del proyecto.

Bloques:

1. Encabezado
   - Nombre del proyecto
   - Cliente
   - Tipo
   - Estado
   - Próxima acción
2. Resumen financiero
   - Precio total
   - Anticipo
   - Segundo pago
   - Pago pendiente
3. Fechas y links clave
   - Inicio
   - Entrega estimada
   - Drive
   - Cotización
   - Sitio prueba
   - Sitio final
4. Checklist
   - Lista de tareas con checkbox
5. Notas internas
   - Timeline o listado simple
6. Pagos
   - Tabla de pagos manuales
7. Links importantes
   - Lista editable por tipo

## /pagos

Objetivo: controlar cobros pendientes y pagados.

Vista tabla:

- Proyecto
- Cliente
- Concepto
- Monto
- Estado
- Fecha límite
- Fecha de pago
- Método
- Acciones

Filtros:

- Pendiente
- Pagado
- Vencido
- Cancelado

## Componentes sugeridos

- Sidebar principal
- Header con búsqueda rápida opcional
- Card de métrica
- Tabla reutilizable
- Badge de estado
- Formulario modal o drawer
- Tarjeta Kanban
- Checklist item
- Timeline de notas
- Lista de links importantes

## Estados visibles sugeridos

- Lead nuevo
- Diagnóstico
- Cotización enviada
- Esperando anticipo
- Información pendiente
- Diseño
- Diseño enviado
- Ajustes de diseño
- Desarrollo
- Revisión cliente
- Segundo pago pendiente
- Publicado
- Entregado
- Mantenimiento
- Perdido
