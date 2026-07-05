# Roadmap oficial V2 — EderCreaWebs CRM + WhatsApp Agent

## Visión

Construir un sistema que reciba leads por WhatsApp, lea texto, audios, imágenes, PDFs y enlaces, investigue la presencia digital del negocio, consolide la información, genere una propuesta visual de sitio web, cotice, registre pagos y, después del anticipo, mueva al cliente a un portal propio para gestionar su proyecto.

---

## Estado actual

### Ya existe

- Supabase y autenticación.
- Panel Hoy, Pipeline, Leads, Conversaciones y Tareas.
- Ficha de lead, cotizaciones y pagos básicos.
- Importador histórico de ZIP de WhatsApp.
- Lectura de mensajes y adjuntos.
- Transcripción de notas de voz.
- Análisis de imágenes y comprobantes.
- Lectura y análisis de PDFs.
- Detección comercial inicial:
  - qué vende;
  - cómo vende;
  - si ya vende;
  - si hace anuncios;
  - problema;
  - objetivo;
  - funciones;
  - score;
  - intención;
  - precio sugerido.
- Automatización inicial posterior al anticipo.
- Investigación inicial de redes, sitios y screenshots.
- Base para generar cuatro secciones visuales.

### Limitaciones actuales

- Los analizadores aún trabajan parcialmente separados.
- Hay reglas heurísticas mezcladas con análisis por IA.
- No existe una fuente única de verdad consolidada.
- WhatsApp todavía no entra en tiempo real.
- No existe generación automática final de propuesta visual.
- No existe cotizador PDF final completamente operativo.
- No existe portal de cliente.

---

# Fase 0 — Consolidación técnica

## Objetivo

Dejar un solo proyecto canónico, estable y fácil de continuar.

## Entregables

- Repositorio principal en GitHub.
- Rama `main` estable.
- Variables de entorno documentadas.
- Migraciones SQL ordenadas.
- Eliminación de parches duplicados.
- Manejo uniforme de errores.
- Validación de respuestas de IA.
- Registro de ejecuciones y fallos.
- Protección contra importar dos veces el mismo ZIP.
- Identificadores únicos por conversación, mensaje y archivo.

## Criterio de terminado

- `npm install`, `npm run dev` y `npm run build` funcionan.
- No hay que copiar cinco parches manualmente.
- Existe una sola versión clara de base de datos.

**Prioridad: crítica.**

---

# Fase 1 — Motor maestro de análisis

## Objetivo

Unificar chat, audios, imágenes, PDFs, enlaces, redes y datos manuales en una sola ficha consolidada.

## Salida principal

```json
{
  "business": {
    "name": "",
    "industry": "",
    "what_sells": "",
    "how_sells": "",
    "currently_selling": true,
    "runs_ads": true,
    "ad_platforms": [],
    "location": "",
    "audience": "",
    "services": [],
    "products": [],
    "brand_style": {}
  },
  "lead": {
    "main_problem": "",
    "main_goal": "",
    "requested_features": [],
    "project_type": "",
    "lead_score": 0,
    "intention_level": "",
    "recommended_next_action": ""
  },
  "commercial": {
    "suggested_price": 0,
    "currency": "MXN",
    "requires_human_review": true,
    "reason": ""
  },
  "sources": [],
  "confidence": {}
}
```

## Reglas

- Resolver contradicciones.
- Diferenciar cliente, referencia y competidor.
- Diferenciar lo que vende el negocio de lo que Eder propone.
- No sobrescribir datos confirmados con inferencias débiles.
- Marcar datos faltantes.
- Mostrar cambios antes de guardar.
- Aceptar o rechazar campos individualmente.

## Criterio de terminado

Un botón **“Analizar expediente completo”** produce una ficha coherente y versionada.

---

# Fase 2 — Investigación digital y biblioteca de activos

## Fuentes

- Sitio web.
- Instagram.
- Facebook.
- TikTok.
- Google Business.
- Catálogos y Drive.
- Screenshots manuales.
- Referencias y competidores.

## Funciones

- Guardar URLs.
- Tomar screenshots.
- Descargar logo cuando sea posible.
- Extraer teléfonos, ubicación, servicios y textos.
- Detectar colores y estilo visual.
- Clasificar fuente como negocio real, referencia o competidor.
- Crear biblioteca de activos:
  - logos;
  - fotos;
  - screenshots;
  - testimonios;
  - colores;
  - textos;
  - productos;
  - servicios.

## Criterio de terminado

La ficha del negocio queda lista para alimentar una propuesta visual sin pedir de nuevo lo que ya existe públicamente.

---

# Fase 3 — Planificador automático del sitio

## Objetivo

Convertir el análisis del negocio en una arquitectura web específica.

## Salida

- Tipo de sitio recomendado.
- Objetivo principal.
- Público.
- Propuesta de valor.
- CTA principal.
- Navegación.
- Secciones.
- Funciones.
- Flujo del usuario.
- Contenido disponible.
- Contenido faltante.

## Plantillas base

### Web informativa

1. Hero.
2. Servicios.
3. Confianza, proyectos o testimonios.
4. Contacto / CTA.

### Tienda, reservas o cobro

1. Hero.
2. Catálogo.
3. Flujo de compra o reserva.
4. Cuenta, confirmación o administración.

### Cursos

1. Hero.
2. Galería de cursos.
3. Bundles, testimonios o metodología.
4. Área del alumno.

## Criterio de terminado

Cada lead obtiene un plan de sitio específico, no una plantilla genérica con bigote falso.

---

# Fase 4 — Generador de propuesta visual

## Flujo

1. Aprobar plan del sitio.
2. Crear brief por sección.
3. Generar una imagen separada por sección.
4. Generar versión desktop y móvil.
5. Guardar prompts y versiones.
6. Revisar y aprobar.
7. Enviar por WhatsApp.

## Reglas

- Usar identidad real.
- Respetar público, edad y contexto.
- No inventar servicios.
- Separar referencias de la marca real.
- Máximo una ronda conceptual antes del anticipo.

## Entregable típico

```text
Propuesta visual V1
├── 01 Hero Desktop
├── 01 Hero Mobile
├── 02 Sección principal Desktop
├── 02 Sección principal Mobile
├── 03 Confianza Desktop
├── 03 Confianza Mobile
├── 04 CTA Desktop
└── 04 CTA Mobile
```

## Criterio de terminado

Desde la ficha del lead se puede generar, revisar y enviar la propuesta completa.

---

# Fase 5 — Cotizador y PDF comercial

## Reglas actuales

### Sitio informativo

- $10,000 MXN + IVA.

### Tienda, cobro, login o administración

- $15,000 a $17,000 MXN + IVA.

### Cursos o sistemas complejos

- Desde $20,000 MXN + IVA.

### Condiciones

- Hosting y dominio: $1,200 MXN.
- 50% para iniciar.
- 50% al finalizar.
- Entrega estimada: dos semanas desde anticipo e información completa.

## Presentación sugerida

### Inicio

- Solución mínima.
- Alcance básico.

### Crecimiento

- Solución recomendada.
- Mejor equilibrio valor/precio.

### Sistema completo

- Usuarios, administración, automatizaciones o cursos.

## Funciones

- Calcular IVA, anticipo y saldo.
- Generar PDF.
- Versionar.
- Registrar aceptación.
- Guardar vigencia.
- Enviar por WhatsApp.
- Crear seguimientos.

## Criterio de terminado

Con un clic se genera una cotización PDF revisable y lista para enviar.

---

# Fase 6 — WhatsApp en tiempo real, modo copiloto

## Flujo

```text
WhatsApp Cloud API
→ webhook
→ guardar mensaje
→ procesar texto o archivo
→ actualizar análisis maestro
→ sugerir respuesta
→ aprobación humana
→ enviar
```

## Funciones

- Leer mensajes nuevos.
- Transcribir audios.
- Analizar imágenes y PDFs.
- Revisar enlaces.
- Actualizar CRM.
- Proponer respuesta.
- Aprobar, editar, descartar o tomar control.
- Pausar bot.
- Crear seguimiento.
- Detectar intención de pago.

## Automático al inicio

- Saludo.
- Preguntar qué vende.
- Preguntar cómo vende.
- Preguntar si hace anuncios.
- Pedir redes.
- Explicar 50/50.
- Confirmar materiales.
- Recordar fecha prometida.

## Revisión humana obligatoria

- Precio final.
- Descuento.
- Negociación.
- Contratos especiales.
- Proyectos mayores a $20,000.
- Garantías.
- Pago.
- Cambios de alcance.

## Criterio de terminado

Eder puede operar WhatsApp desde el CRM con respuestas sugeridas.

---

# Fase 7 — Portal del cliente

## Objetivo

Mover la operación posterior al pago fuera del caos de WhatsApp.

## Acceso

- Google OAuth.
- Invitación por correo o enlace.
- Rol `client`.
- Cada cliente ve solo sus proyectos.

## Panel del cliente

### Resumen

- Objetivo.
- Alcance.
- Estado.
- Responsable.
- Próxima fecha.
- Porcentaje de avance.

### Plan

- Estructura del sitio.
- Funciones.
- Secciones.
- Flujo.
- Entregables.

### Etapas

```text
Anticipo
→ Onboarding
→ Información completa
→ Diseño
→ Desarrollo
→ Revisión
→ Ajustes
→ Pago final
→ Publicación
→ Entrega
```

### Fechas

- Kickoff.
- Fecha límite de información.
- Revisión.
- Entrega estimada.
- Publicación.

### Contrato

- Documento.
- Versión.
- Aceptación.
- Fecha.
- Alcance vigente.

### Pagos

- Cotización.
- Anticipo.
- Saldo.
- Comprobantes.
- Estado.

### Archivos

- Logo.
- Fotos.
- Textos.
- Productos.
- Documentos.
- Referencias.
- Entregables.

### Conversación del proyecto

- Comentarios por etapa.
- Solicitudes de información.
- Aprobaciones.
- Historial.

## Criterio de terminado

El cliente entiende su proyecto sin escribir “¿cómo vamos?” cada tercer desayuno.

---

# Fase 8 — Operación y control de cambios

## Funciones

- Tareas internas.
- Responsables.
- Milestones.
- Bloqueos.
- Información faltante.
- Checklist.
- Cambios fuera de alcance.
- Costos adicionales.
- Aprobaciones.
- Entrega final.
- Credenciales.
- Capacitación.
- Soporte.

## Regla de cambio

Todo cambio registra:

- solicitud;
- impacto;
- costo;
- tiempo;
- aprobación;
- nueva versión de alcance.

---

# Fase 9 — Automatización avanzada

## Posibilidades

- Responder preguntas seguras.
- Pedir información faltante.
- Enviar propuesta visual aprobada.
- Enviar cotización aprobada.
- Recordar anticipo.
- Crear onboarding.
- Notificar etapas.
- Detectar inactividad.
- Preparar resumen diario.
- Detectar riesgo de pérdida.
- Resumir llamadas.
- Convertir reuniones en tareas.

## Videollamadas

```text
MP4 / audio
→ extraer pista
→ dividir si es larga
→ transcribir
→ resumir acuerdos
→ crear tareas
→ actualizar CRM
```

No es requisito para el primer MVP operativo.

---

# Orden recomendado

| Orden | Bloque | Prioridad |
|---:|---|---|
| 1 | Consolidación técnica | Crítica |
| 2 | Motor maestro de análisis | Crítica |
| 3 | Investigación digital estable | Alta |
| 4 | Planificador del sitio | Alta |
| 5 | Generador visual | Alta |
| 6 | Cotizador PDF | Alta |
| 7 | WhatsApp copiloto | Crítica para operación real |
| 8 | Portal del cliente | Alta después de ventas |
| 9 | Operación y cambios | Media |
| 10 | Automatización avanzada | Posterior |

---

# MVP comercial

Debe lograr:

1. Recibir o importar conversación.
2. Analizar todas las fuentes.
3. Consolidar ficha del lead.
4. Investigar redes.
5. Crear plan del sitio.
6. Generar propuesta visual.
7. Generar cotización.
8. Guardar seguimiento.
9. Registrar pago.

No necesita todavía:

- respuesta 100% automática;
- portal completo;
- videollamadas;
- gestión avanzada de producción.

---

# MVP del portal del cliente

Debe incluir:

- login con Google;
- resumen;
- etapas;
- fechas;
- contrato;
- pagos;
- archivos;
- comentarios;
- solicitudes de información;
- aprobación de entregables.

No necesita inicialmente:

- videollamada integrada;
- chat en tiempo real;
- facturación completa;
- firma electrónica sofisticada;
- app móvil.

---

# Próximo sprint recomendado

## Sprint: consolidación y cerebro maestro

1. Elegir el proyecto canónico.
2. Subirlo a GitHub.
3. Ordenar migraciones SQL.
4. Crear tabla `fact_sources`.
5. Crear tabla `analysis_versions`.
6. Crear endpoint `/api/analyze-lead`.
7. Enviar al endpoint:
   - chat;
   - transcripciones;
   - PDFs;
   - imágenes;
   - investigación digital.
8. Obtener una sola respuesta JSON.
9. Mostrar diferencias antes de guardar.
10. Aprobar campos individualmente.
11. Guardar versión del análisis.
12. Probar con Beto, Samuel, Terraxo, Aurora, Alkance y BBVA Venta de Casa.

## Resultado esperado

Un botón:

> **Analizar expediente completo**

que alimente todo lo que sigue.

---

# Métricas

## Comerciales

- Tiempo de primera respuesta.
- Tiempo hasta propuesta visual.
- Porcentaje que pide precio.
- Porcentaje que recibe cotización.
- Porcentaje que paga anticipo.
- Tiempo promedio de cierre.
- Motivos de pérdida.

## Calidad de IA

- Campos aceptados sin corrección.
- Respuestas editadas.
- Errores de clasificación.
- Precios modificados.
- Propuestas visuales rechazadas.
- Fuentes conflictivas.

## Operativas

- Proyectos con información completa.
- Retrasos por cliente.
- Cambios fuera de alcance.
- Saldo pendiente.
- Tiempo real de entrega.

---

# Definición final del producto

**Eder CRM será un sistema comercial y operativo que convierte conversaciones desordenadas de WhatsApp en análisis, propuestas visuales, cotizaciones, pagos y proyectos administrados desde un portal propio.**
