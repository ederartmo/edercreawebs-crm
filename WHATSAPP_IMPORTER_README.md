# Importador WhatsApp V1 — parche

## Qué agrega

- Nueva sección **Importar** en el menú del CRM.
- Lectura de ZIP exportados por WhatsApp en el navegador.
- Vista previa de participantes, mensajes y archivos.
- Creación de negocio, contacto, lead y conversación.
- Importación del historial completo de mensajes.
- Subida de imágenes, audios, videos y documentos a un bucket privado.
- Asociación de adjuntos con sus mensajes cuando el nombre coincide.

## Instalación

1. Copia los archivos del parche sobre tu proyecto actual.
2. Ejecuta en Supabase el archivo:

```text
supabase_whatsapp_import_patch_v1.sql
```

3. Instala la dependencia:

```powershell
npm install jszip
```

4. Reinicia el servidor:

```powershell
npm run dev
```

5. Abre:

```text
http://localhost:3000/importar-whatsapp
```

## Notas

- La primera versión importa el audio como archivo, pero todavía no lo transcribe.
- El bot queda pausado para conversaciones históricas importadas.
- No vuelvas a importar el mismo ZIP dos veces: esta V1 todavía no calcula una huella del archivo para bloquear duplicados.
- Si algún adjunto falla, los mensajes se conservan y la pantalla muestra una advertencia.
