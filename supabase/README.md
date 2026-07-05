# Supabase migrations

Orden local actual:

1. `migrations/20260705000100_baseline_current_public_schema.sql`
2. `migrations/20260705000200_whatsapp_import_storage_bucket_and_policies.sql`

La primera migracion es el baseline del esquema `public`, generado a partir del dump real del proyecto y saneado para uso local como migracion.

La segunda migracion configura Storage para el bucket `whatsapp-imports` y sus cuatro politicas de acceso.

`supabase_patch_after_schema_v1.sql` quedo integrado funcionalmente en el baseline y debe tratarse como archivo legado de referencia.

`supabase_whatsapp_import_patch_v1.sql` fue convertido en la segunda migracion y se conserva temporalmente como referencia.

`npx supabase db reset` debe usarse solamente en local para validar estas migraciones.

Estan prohibidos sin revision explicita:

- `npx supabase db reset --linked`
- `npx supabase db push`
- `npx supabase migration repair`
