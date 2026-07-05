# Plan operativo — Eder CRM (derivado del Roadmap V2)

Resumen breve

Este plan transforma el Roadmap V2 en pasos accionables y priorizados para el próximo sprint: consolidación técnica y creación del "motor maestro" de análisis.

Prioridades inmediatas (Sprint 1)

1. Consolidación técnica (crítica)
   - Elegir proyecto canónico y limpiar parches duplicados.
   - Documentar variables de entorno y migraciones.
   - Asegurar que `npm install`, `npm run dev` y `npm run build` funcionen en CI y local.

   Checklist para TODO: "Choosing canonical project"
   1. Confirmar carpeta más completa/recent (esta carpeta raíz del repo).  
   2. Declarar este repo como canónico en `README.md`.  
   3. Documentar instalación, variables de entorno y SQL requerido en `README.md`.  
   4. Identificar parches/archivos antiguos (listar) sin eliminarlos.  
   5. Verificar localmente: `npm install`, `npm run build`, `npm run lint` (si existe).  
   6. Generar reporte de duplicados, migraciones dispersas y riesgos (CANONICAL_REPORT.md).  
   7. Commit mínimo y marcar TODO como `done` solo si `npm run build` pasa.

2. Infraestructura del análisis maestro (crítica)
   - Ordenar migraciones SQL y crear tablas base (`fact_sources`, `analysis_versions`).
   - Crear endpoint `/api/analyze-lead` que acepte chat, transcripciones, PDFs, imágenes y urls.
   - Implementar versión y diff de análisis antes de guardar.
3. Pruebas e integración
   - Probar con datasets de ejemplo y leads reales (Beto, Samuel, etc.).
   - Crear scripts para aplicar parches SQL (`supabase_patch_after_schema_v1.sql`, `supabase_whatsapp_import_patch_v1.sql`).

Entregables sprint 1

- Repositorio canónico en GitHub con rama `main` estable.
- Migraciones ordenadas y tablas nuevas en DB.
- Endpoint `/api/analyze-lead` funcionando y retornando JSON consolidado.
- UI: botón "Analizar expediente completo" que muestra diff y permite aprobar campos.

Backlog de siguiente iteración

- Biblioteca de activos e investigación digital (screenshots, logos, scraping básico).
- Planificador automático del sitio y generación de propuestas visuales V1.
- Cotizador y generación de PDF comercial.
- Webhook para WhatsApp Cloud API y modo copiloto.

Notas

- Mantener separación entre heurísticas y módulos de IA; cada respuesta de IA debe incluir confidence y fuente.
- Documentar claramente variables env y pasos para ejecutar patches.
- Priorizar pruebas manuales con 5 leads antes de automatizar.

---

Resumen de tareas creadas en el sistema de seguimiento de esta sesión: `todos` con prioridad inicial "pending".
