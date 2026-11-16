#!/usr/bin/env bash
# Envoltorio de compatibilidad: toda la lógica vive en templates/nuevo.mjs (la misma en Linux, macOS y Windows).
# Preferí `npm run nuevo -- ...`; esto queda para quien ya usaba `bash templates/nuevo.sh ...` (mismos argumentos y mismas variables).
exec node "$(dirname "$0")/nuevo.mjs" "$@"
