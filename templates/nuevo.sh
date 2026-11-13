#!/usr/bin/env bash
# Crea archivos de un video a partir de las plantillas, con los imports ya corregidos.
#   bash templates/nuevo.sh escena <slug> <nombre-de-escena>     -> videos/<slug>/<nombre-de-escena>/
#   bash templates/nuevo.sh historia <slug> <escena-de-ejemplo>  -> videos/<slug>/historia/
# Tambien crea videos/<slug>/theme.ts (tema neutro) si todavia no existe.
# No registra nada: el import va a mano en engine/runtime/videos.ts (ver SKILL.md).
set -euo pipefail
cd "$(dirname "$0")/.."

modo="${1:-}"; slug="${2:-}"; nombre="${3:-}"
if [[ -z "$modo" || -z "$slug" || -z "$nombre" ]] || [[ "$modo" != "escena" && "$modo" != "historia" ]]; then
  echo "Uso: bash templates/nuevo.sh escena <slug> <nombre-de-escena>" >&2
  echo "     bash templates/nuevo.sh historia <slug> <nombre-de-una-escena>" >&2
  exit 2
fi
[[ "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "El slug va en minusculas, numeros y guiones." >&2; exit 2; }
[[ "$nombre" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "El nombre va en minusculas, numeros y guiones." >&2; exit 2; }

base="videos/$slug"
mkdir -p "$base"
if [[ ! -f "$base/theme.ts" ]]; then
  sed -E 's#"\.\./themes"#"../../themes"#g' templates/theme.ts > "$base/theme.ts"
  echo "creado $base/theme.ts"
fi

if [[ "$modo" == "escena" ]]; then
  dest="$base/$nombre"
  [[ ! -e "$dest" ]] || { echo "Ya existe $dest" >&2; exit 1; }
  cp -r templates/scene "$dest"
  sed -i -E 's#"\.\./\.\./(engine|kit|themes|stories)#"../../../\1#g' "$dest"/*.ts "$dest"/*.tsx
  sed -i "s#\"plantilla-escena\"#\"$slug-$nombre\"#" "$dest/index.ts"
  echo "creado $dest (id de video: $slug-$nombre)"
  echo "falta: import \"../../videos/$slug/$nombre\"; en engine/runtime/videos.ts"
else
  dest="$base/historia"
  [[ ! -e "$dest" ]] || { echo "Ya existe $dest" >&2; exit 1; }
  [[ -d "$base/$nombre" ]] || { echo "Primero crea la escena: bash templates/nuevo.sh escena $slug $nombre" >&2; exit 1; }
  cp -r templates/story "$dest"
  sed -i -E 's#"\.\./\.\./(engine|kit|themes|stories)#"../../../\1#g' "$dest"/*.ts
  sed -i "s#\"\.\./scene/Scene\"#\"../$nombre/Scene\"#; s#\"plantilla-historia\"#\"$slug\"#" "$dest/index.ts"
  echo "creado $dest (id de video: $slug)"
  echo "falta: reemplazar las dos escenas de ejemplo por las reales y agregar import \"../../videos/$slug/historia\"; en engine/runtime/videos.ts"
fi
