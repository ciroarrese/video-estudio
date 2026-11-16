Carpeta de videos fuera del repo (VE_VIDEOS_DIR)
================================================

Se prepara sola con:

    VE_VIDEOS_DIR=/ruta/a/mis-videos npm run nuevo -- externo     (PowerShell: $env:VE_VIDEOS_DIR="C:\ruta\mis-videos"; npm run nuevo -- externo)

(o al crear la primera escena con `npm run nuevo -- escena <slug> <nombre>` con la variable definida). Deja en la carpeta:

  tsconfig.json   paths a este repo (video-estudio/*) y a los tipos de react; excluye node_modules, assets, out y .ve-cache; sin baseUrl (TypeScript 7 lo rechaza) y con
                  `types: []` (vite/client no se resuelve desde afuera; env.d.ts declara los imports `?url`).
  env.d.ts        declaraciones de `*?url`, `*?raw`, imágenes, fuentes y audio.

Revisión de tipos: `VE_VIDEOS_DIR=/ruta/a/mis-videos npm run typecheck` (o `npm run typecheck:videos`).
Los archivos se referencian de dos maneras (ver docs/reglas.md, "Archivos del video"):
  asset("fonts/x.otf")                 carpeta assets/ al lado de los videos (se sirve sola), o --assets <dir>
  import f from "../assets/x.otf?url"  vite copia el archivo al video
