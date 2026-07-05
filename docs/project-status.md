# Resumen del estado actual del CRM (para ChatGPT)

## Repositorio y versión
Tengo la copia activa del proyecto en este workspace; es la versión presente en el directorio del repositorio. Los cambios recientes (configuración para Windows) ya se aplicaron aquí.

## Tecnologías
- Next.js (app router)
- React, TypeScript
- Supabase (Auth + client/server helpers)
- Tailwind CSS

## Funcionalidad implementada
- Login con Supabase Auth
- Panel CRM: Hoy, Pipeline, Conversaciones, Leads, Ficha de lead, Tareas
- Importador de WhatsApp (parche V1) incluido en `src` (README comercial explica uso)
- APIs internas: /api/analyze-pdf, /api/transcribe, /api/analyze-image (requieren OPENAI_API_KEY)

## Requisitos y variables
- Node.js >= 20.9
- Proyecto de Supabase con esquema V1 aplicado
- Variables en `.env.local`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, OPENAI_API_KEY, OPENAI_TRANSCRIPTION_MODEL, OPENAI_VISION_MODEL, OPENAI_DOCUMENT_MODEL
- SQL: `supabase_patch_after_schema_v1.sql` y `supabase_whatsapp_import_patch_v1.sql` están presentes

## Estado de ejecución
- Dependencias instaladas (node_modules presente)
- `npm run dev` funciona localmente en Windows (ajustado para usar webpack)
- `/login` responde 200 OK en `http://localhost:3000`

## Notas y próximos pasos sugeridos
- Confirmar valores reales en `.env.local` (no compartir secretos)
- Ejecutar patches SQL en el proyecto Supabase
- Probar importador con ZIPs de WhatsApp
- Conectar modelo de IA (OpenAI) para análisis semántico si se desea

Archivo creado para que ChatGPT o cualquier colaborador pueda leer el estado actual y guiar siguientes pasos.