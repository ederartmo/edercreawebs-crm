# UI CRM Nivel 1 — Wireframe Textual

## Estilo general

- Herramienta interna, rápida y funcional
- Layout con sidebar + topbar
- Tablas limpias para administración
- Kanban simple para estado de leads y proyectos
- Cards resumidas en dashboard

## Layout base

El CRM debe usar un layout con sidebar fija y contenido principal.

### Sidebar

Elementos:

- Dashboard
- Leads
- Clientes
- Proyectos
- Pagos

### Topbar

Elementos:

- Título de la pantalla actual
- Búsqueda rápida opcional
- Botón principal de acción según la pantalla
- Usuario actual / cerrar sesión

### Contenido principal

Debe usar cards, tablas y formularios simples.
El diseño debe priorizar claridad, velocidad y lectura rápida.

## Estilo visual recomendado

- Fondo general gris muy claro
- Cards blancas con borde suave
- Sidebar oscura o blanca con navegación clara
- Badges de estado con colores diferenciados
- Botones principales en color azul o negro
- Tipografía limpia, moderna y legible
- Espaciado amplio
- Nada de animaciones innecesarias
- Priorizar velocidad y claridad

Regla:

- No usar diseños demasiado decorativos. El CRM es una herramienta operativa.

## Rutas base

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

## /leads/[id]

Objetivo: ver el detalle del lead antes de convertirlo.

Bloques:

- Datos del lead
- Qué vende
- Qué necesita
- Fuente
- Estado
- Notas
- Próxima acción

Acción principal:

- Convertir a cliente

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

## /clientes/[id]

Objetivo: ver la ficha del cliente.

Bloques:

- Datos generales
- Contacto
- RFC / ubicación
- Redes sociales
- Notas
- Proyectos relacionados
- Pagos relacionados

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

## /proyectos/nuevo

Objetivo: crear un nuevo proyecto asociado a un cliente existente o a un lead convertido.

Elementos:

- Cliente
- Lead relacionado opcional
- Nombre del proyecto
- Tipo de proyecto
- Estado inicial
- Precio total
- Anticipo
- Segundo pago
- Fecha estimada
- Próxima acción
- Notas internas

Regla:

- Al crear proyecto, debe generarse automáticamente el checklist base.

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

Acciones disponibles:

- Editar proyecto
- Cambiar estado
- Marcar anticipo como pagado
- Marcar segundo pago como pagado
- Agregar nota
- Agregar link
- Agregar pago
- Marcar tarea como completada

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

## Badges de estado

Cada estado debe mostrarse como badge visual.

Ejemplos:

- Lead nuevo
- Diagnóstico
- Cotización enviada
- Esperando anticipo
- Información pendiente
- Diseño
- Desarrollo
- Revisión cliente
- Segundo pago pendiente
- Publicado
- Entregado
- Mantenimiento
- Perdido

Regla:

- Los badges deben usar colores consistentes en todo el CRM.

## Estados vacíos

### Leads vacío

Texto:

- "No tienes leads registrados todavía."

Botón:

- "Crear primer lead"

### Clientes vacío

Texto:

- "No tienes clientes registrados todavía."

Botón:

- "Crear cliente"

### Proyectos vacío

Texto:

- "No tienes proyectos activos todavía."

Botón:

- "Crear proyecto"

### Pagos vacío

Texto:

- "No hay pagos registrados todavía."

## Formularios mínimos

### Formulario de lead

Campos:

- Nombre
- Empresa
- WhatsApp
- Correo
- Fuente
- Qué vende
- Qué necesita
- Estado
- Próxima acción
- Notas

### Formulario de cliente

Campos:

- Nombre
- Empresa
- Correo
- WhatsApp
- Teléfono
- RFC
- Ubicación
- Sitio actual
- Redes sociales
- Notas

### Formulario de proyecto

Campos:

- Cliente
- Lead relacionado opcional
- Nombre del proyecto
- Tipo de proyecto
- Estado
- Precio total
- Anticipo
- Segundo pago
- Fecha inicio
- Fecha estimada
- Próxima acción
- Link Drive
- Link cotización
- Link sitio prueba
- Link sitio final
- Notas

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
