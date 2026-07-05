-- IMPORTADOR DE WHATSAPP V1
-- Crea un bucket privado y políticas para que cada usuario autenticado
-- solo pueda manejar archivos dentro de una carpeta cuyo primer segmento
-- sea su propio auth.uid().

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit
)
values (
  'whatsapp-imports',
  'whatsapp-imports',
  false,
  104857600
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists whatsapp_imports_select_own on storage.objects;
create policy whatsapp_imports_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'whatsapp-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists whatsapp_imports_insert_own on storage.objects;
create policy whatsapp_imports_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'whatsapp-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists whatsapp_imports_update_own on storage.objects;
create policy whatsapp_imports_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'whatsapp-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'whatsapp-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists whatsapp_imports_delete_own on storage.objects;
create policy whatsapp_imports_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'whatsapp-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

select id, name, public, file_size_limit
from storage.buckets
where id = 'whatsapp-imports';
