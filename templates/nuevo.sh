#!/usr/bin/env bash
# Crea archivos de un video a partir de las plantillas, con los imports ya corregidos.
#   bash templates/nuevo.sh escena <slug> <nombre-de-escena>     -> videos/<slug>/<nombre-de-escena>/
#   bash templates/nuevo.sh historia <slug> <escena-de-ejemplo>  -> videos/<slug>/historia/
#   bash templates/nuevo.sh externo                             -> solo prepara tsconfig.json y env.d.ts de VE_VIDEOS_DIR
# Tambien crea videos/<slug>/theme.ts (tema neutro) si todavia no existe.
# Con VE_VIDEOS_DIR definida (videos fuera del repo) escribe ahi en vez de en videos/, con los imports por alias
# (`video-estudio/engine`, ...) y crea tsconfig.json y env.d.ts de esa carpeta si faltan.
# No hay que registrar nada: el runtime descubre solo toda carpeta videos/<slug>/**/index.ts (ver SKILL.md).
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$(pwd)"

# Carpeta externa: tsconfig.json con paths a este repo y env.d.ts (solo si faltan).
preparar_externo() {
  local dir="$1"
  mkdir -p "$dir"
  if [[ ! -f "$dir/tsconfig.json" ]]; then
    sed "s#__REPO__#$repo#g" templates/externo/tsconfig.json > "$dir/tsconfig.json"
    echo "creado $dir/tsconfig.json"
  fi
  if [[ ! -f "$dir/env.d.ts" ]]; then
    cp templates/externo/env.d.ts "$dir/env.d.ts"
    echo "creado $dir/env.d.ts"
  fi
}

modo="${1:-}"; slug="${2:-}"; nombre="${3:-}"
if [[ "$modo" == "externo" ]]; then
  [[ -n "${VE_VIDEOS_DIR:-}" ]] || { echo "Falta VE_VIDEOS_DIR (la carpeta de videos fuera del repo)." >&2; exit 2; }
  externa="$(mkdir -p "$VE_VIDEOS_DIR" && cd "$VE_VIDEOS_DIR" && pwd)"
  preparar_externo "$externa"
  echo "revision de tipos: VE_VIDEOS_DIR=$externa npm run typecheck"
  exit 0
fi
if [[ -z "$modo" || -z "$slug" || -z "$nombre" ]] || [[ "$modo" != "escena" && "$modo" != "historia" ]]; then
  echo "Uso: bash templates/nuevo.sh escena <slug> <nombre-de-escena>" >&2
  echo "     bash templates/nuevo.sh historia <slug> <nombre-de-una-escena>" >&2
  echo "     bash templates/nuevo.sh externo        (con VE_VIDEOS_DIR: prepara tsconfig.json y env.d.ts)" >&2
  exit 2
fi
[[ "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "El slug va en minusculas, numeros y guiones." >&2; exit 2; }
[[ "$nombre" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "El nombre va en minusculas, numeros y guiones." >&2; exit 2; }

if [[ -n "${VE_VIDEOS_DIR:-}" ]]; then
  externa="$(mkdir -p "$VE_VIDEOS_DIR" && cd "$VE_VIDEOS_DIR" && pwd)"
  preparar_externo "$externa"
  base="$externa/$slug"
  pref_tema="video-estudio/"   # imports por alias: la carpeta de afuera no tiene engine/ al lado
  pref_nivel="video-estudio/"
else
  base="videos/$slug"
  pref_tema="../../"
  pref_nivel="../../../"
fi
mkdir -p "$base"
if [[ ! -f "$base/theme.ts" ]]; then
  sed -E "s#\"\.\./themes\"#\"${pref_tema}themes\"#g" templates/theme.ts > "$base/theme.ts"
  echo "creado $base/theme.ts"
fi

if [[ "$modo" == "escena" ]]; then
  dest="$base/$nombre"
  [[ ! -e "$dest" ]] || { echo "Ya existe $dest" >&2; exit 1; }
  cp -r templates/scene "$dest"
  sed -i -E "s#\"\.\./\.\./(engine|kit|themes|stories|fx|qa)#\"${pref_nivel}\1#g" "$dest"/*.ts "$dest"/*.tsx
  sed -i "s#\"plantilla-escena\"#\"$slug-$nombre\"#" "$dest/index.ts"
  echo "creado $dest (id de video: $slug-$nombre)"
  echo "ya se descubre solo (${VE_VIDEOS_DIR:+VE_VIDEOS_DIR=$VE_VIDEOS_DIR }npm run render -- --list); no hay que registrarla"
else
  dest="$base/historia"
  [[ ! -e "$dest" ]] || { echo "Ya existe $dest" >&2; exit 1; }
  [[ -d "$base/$nombre" ]] || { echo "Primero crea la escena: bash templates/nuevo.sh escena $slug $nombre" >&2; exit 1; }
  cp -r templates/story "$dest"
  sed -i -E "s#\"\.\./\.\./(engine|kit|themes|stories|fx|qa)#\"${pref_nivel}\1#g" "$dest"/*.ts
  sed -i "s#\"\.\./scene/Scene\"#\"../$nombre/Scene\"#; s#\"plantilla-historia\"#\"$slug\"#" "$dest/index.ts"
  echo "creado $dest (id de video: $slug)"
  echo "falta: reemplazar las dos escenas de ejemplo por las reales (la historia ya se descubre sola)"
fi
