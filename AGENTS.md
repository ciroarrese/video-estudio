# Video Studio (`video-estudio`): instrucciones para agentes de código

Este archivo es el punto de entrada para cualquier agente que lea `AGENTS.md`. No repite las convenciones del repo: están en [CLAUDE.md](CLAUDE.md) (el nombre es histórico; vale para cualquier agente) y en [docs/reglas.md](docs/reglas.md). Leé `CLAUDE.md` entero antes de tocar nada.

## Para hacer un video

Seguí `.claude/skills/video-estudio/SKILL.md` **al pie de la letra, etapa por etapa, con aprobación de la persona en cada una**: cuestionario, fichas, tema (design system), guion, escenas de a una, armado, sonido y entrega. En cada alto te detenés y esperás una respuesta explícita; sin "aprobado" no pasás a la etapa siguiente. El archivo tiene formato de skill de Claude Code (una cabecera `name` y `description` y después texto común): si tu agente no carga skills, leelo igual como un documento y seguilo.

Todos los comandos corren desde la raíz de este repo. Si algo falla al arrancar, corré `npm run doctor` y seguí lo que indique; la guía de instalación y de uso es [docs/instalacion.md](docs/instalacion.md).

## Lo mínimo imprescindible (el detalle está en `CLAUDE.md`)

- Todo texto que ve una persona va en español rioplatense (voseo, solo la primera palabra con mayúscula, sin emojis); los comentarios del código, en español.
- Escenas y piezas del kit son funciones puras del número de cuadro: nada de estado, azar ni animaciones CSS (lista en `docs/reglas.md`, "Lista única de determinismo").
- Colores, tipografías, radios y curvas salen del tema (`useTheme()`); nunca `#hex` ni valores de marca en escenas.
- El repo es público: sin nombres de empresas, clientes ni personas reales, sin credenciales. El material privado va en `VE_VIDEOS_DIR` (fuera del repo) o en `videos/` (no se versiona).
- Para producir un video no se edita `engine/`, `kit/`, `themes/`, `render/`, `stories/`, `fx/` ni `qa/`: las escenas viven en `videos/<slug>/`. Si falta una pieza, se anota y se pide.
- No agregar fuentes, música, imágenes ni marcas sin verificar su licencia.
- No leer ni copiar código fuente de otros frameworks de video (`docs/ORIGEN.md`).
- Las interfaces se recrean con su estructura y sus rótulos; no se usan capturas.
- Para señalar se usa `Callout` (la señal la pone el tema); nada de flechas ni garabatos por costumbre.
- Antes de dar algo por terminado, la lista de control de `CLAUDE.md` ("Antes de dar algo por terminado").
