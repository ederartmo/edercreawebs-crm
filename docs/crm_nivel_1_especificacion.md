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
/leads/[id]
/clientes
/clientes/[id]
/proyectos
/proyectos/nuevo
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
- Próxima acción
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

Cada proyecto debe permitir guardar notas internas.

Ejemplos:

- Cliente quiere algo parecido a referencia X.
- Le preocupa el precio.
- Necesita factura.
- Quiere pagos en línea.
- No tiene fotos.
- Ya tiene dominio.
- Necesita presentar la propuesta a un socio.
- Tiene urgencia por publicar.
- Requiere mantenimiento mensual.

### Pagos

El sistema debe permitir registrar pagos manuales.

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

Conceptos comunes:

- Anticipo 50%
- Segundo pago 50%
- Dominio
- Hosting
- Mantenimiento mensual
- Cambio adicional
- Integración extra

### Links importantes

Cada proyecto debe permitir guardar links relevantes.

Tipos sugeridos:

- Carpeta de Drive
- Cotización PDF
- Documento de información base
- Resumen estratégico
- Diseño
- Sitio en prueba
- Sitio publicado
- Repositorio
- Hosting
- Dominio
- Panel administrativo
- Otro

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
2. El sistema debe registrar si el dominio está `pendiente`, `confirmado`, `comprado` o `conectado`.
3. Todo proyecto debe tener checklist automático al crearse.
4. Todo proyecto debe tener `next_action`.
5. No se debe entregar o publicar definitivamente sin segundo pago, salvo acuerdo especial.
6. Al entregar un proyecto debe existir una tarea para ofrecer mantenimiento.

Ejemplos de `next_action`:

- Pedir fotos
- Esperar anticipo
- Enviar cotización
- Revisar referencias
- Comprar dominio
- Mandar versión de prueba
- Solicitar segundo pago

## Criterios de terminado del Nivel 1

El Nivel 1 se considera útil cuando permite:

```text
[ ] Iniciar sesión
[ ] Registrar un lead
[ ] Cambiar estado del lead
[ ] Convertir lead en cliente
[ ] Crear proyecto
[ ] Ver proyecto en dashboard
[ ] Ver proyecto en Kanban
[ ] Marcar tareas del checklist
[ ] Agregar notas internas
[ ] Registrar pago pendiente
[ ] Marcar pago como pagado
[ ] Guardar links importantes
[ ] Ver próxima acción
```

## Stack recomendado

- Next.js
- Supabase
- Tailwind CSS
- shadcn/ui
- Vercel

## Orden de construcción

### Fase 1

- Crear proyecto Next.js
- Instalar Tailwind
- Instalar shadcn/ui
- Configurar Supabase
- Crear `.env.example`
- Crear layout base
- Crear login
- Crear dashboard placeholder

### Fase 2

- Crear tablas en Supabase
- Configurar Auth
- Configurar RLS básico
- Crear cliente Supabase en la app
- Crear seed de estados

### Fase 3

- Crear CRUD de leads
- Crear CRUD de clientes
- Crear CRUD de proyectos

### Fase 4

- Crear detalle de proyecto
- Crear checklist automático
- Crear notas internas
- Crear pagos manuales
- Crear links importantes

### Fase 5

- Crear vista Kanban
- Pulir dashboard
- Probar flujo completo
- Subir a Vercel
- Usarlo con un cliente real

## Prompt exacto para construir la primera fase técnica

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

## Frase guía

> Primero orden interno. Después experiencia premium para el cliente.
