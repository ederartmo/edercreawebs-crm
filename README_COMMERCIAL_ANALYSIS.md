# Análisis comercial automático V1

Este parche amplía el importador de WhatsApp para completar y guardar automáticamente:

- qué vende;
- cómo vende;
- si ya vende;
- si hace anuncios;
- plataformas y destino de anuncios;
- problema principal;
- objetivo;
- funciones solicitadas;
- puntuación del lead;
- nivel de intención;
- precio sugerido;
- moneda;
- resumen comercial.

## Instalación

1. Detén Next con `Ctrl + C`.
2. Copia la carpeta `src` de este parche sobre la carpeta `src` de tu proyecto.
3. Confirma el reemplazo de archivos.
4. Ejecuta:

```powershell
npm run dev
```

No requiere SQL nuevo ni dependencias nuevas.

## Importante

Esta V1 utiliza reglas comerciales derivadas del Prompt Maestro y funciona sin una API externa. Los campos son editables antes de importar. El siguiente paso será conectar un modelo de IA para análisis semántico más profundo, transcripción de audios y extracción de PDFs e imágenes.
