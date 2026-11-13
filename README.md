# video-estudio

Herramienta para producir videos animados de nivel profesional a partir de un cuestionario, con el design system como tema intercambiable. El motor es propio: cada video es una función del número de cuadro, Chromium captura cada cuadro y ffmpeg arma el MP4. Pensada para que un agente de código (Claude Code) la maneje de punta a punta cuando alguien dice "haceme un video".

El plan, las etapas y la forma de trabajo están en [PLAN.md](PLAN.md). De dónde sale el motor: [docs/ORIGEN.md](docs/ORIGEN.md).

## Requisitos

- Node 22 o superior.
- Chromium vía Playwright (`npm i -D playwright` y `npx playwright install chromium`; otro ejecutable con `VE_CHROMIUM=/ruta/a/chrome`).
- `ffmpeg` y `ffprobe` en el PATH.

## Empezar

```bash
npm install
npm run render -- kit-demo                 # out/kit-demo.mp4 (video de ejemplo, datos ficticios)
npm run sheet -- kit-demo --count 12       # out/kit-demo-sheet.png: hoja de cuadros
npm run qa -- kit-demo                     # control de calidad automático
npm run privacy -- kit-demo --deny lista.txt   # chequeo de privacidad (lista.txt: un término por línea)
npm run dev                                # vista en el navegador: /?video=kit-demo (y &format=vertical)
npm run render -- --list                   # videos descubiertos (examples/* y videos/*), con tamaños y formatos; al final, las carpetas que no cargaron
npm run render -- hello --format vertical  # vertical (1080x1920 / 720x1280); también cuadrado
npm run sheet -- hello --format vertical --count 8   # out/hello-vertical-sheet.png
npm run render -- story-demo --list-scenes # escenas con nombre; --scene <id|índice> renderiza solo una
npm run qa -- story-demo --list-scenes     # lo mismo y, en una historia, el presupuesto de cuadros por bloque
npm run sheet -- fx-text --count 8         # galería del catálogo de efectos (también fx-3d y fx-data-ui-art)
```

Catálogo de efectos listos (texto, 3D, datos, interfaz y arte): [docs/animaciones.md](docs/animaciones.md), con tres galerías para verlos: `fx-text`, `fx-3d` y `fx-data-ui-art` (`/?video=fx-3d&props={"theme":"dark"}`). Sonido (tempo, empalme al compás, efectos propios y mezcla): [docs/audio.md](docs/audio.md). Otros ejemplos: `hello`, `fx-in-scene` (regresión: efectos montados desde el cuadro 0 dentro de una escena, sin residuos antes de su `start` ni después de terminar), `story-demo` (historia con apertura, vueltas al listado y cierre), `qa-defects` (defectos sembrados para probar el QA). Un video roto no deja inservibles a los demás (solo falla el que tiene el problema) y los tamaños tienen que ser pares. Cada comando y sus opciones: [render/README.md](render/README.md) y [qa/README.md](qa/README.md) (con el criterio de severidad de `offscreen` y del velo en `contrast`). Pruebas y tipos: `npm run typecheck`, `npm test` (rápidas, 1 a 2 minutos) y `npm run test:e2e` (lentas, unos 10 minutos: `--check` por escena de varias historias; solo hace falta si se toca el toolkit).

## Mapa de carpetas

| Carpeta | Qué hay |
|---|---|
| `engine/` | Reloj de cuadros, interpolación, azar determinista, secuencias, audio, espera de recursos, página runtime |
| `kit/` | Cámara, cursor, garabatos, titular que se aparta, vuelo de tarjetas, velo, números que cuentan |
| `themes/` | Tema neutro y oscuro, tres design systems de ejemplo (`editorial`, `neon`, `papel`), adaptador de tokens, capa de estilo (`theme.style`) y chequeo de contraste y de estilo |
| `fx/` | Catálogo de efectos listos y deterministas: texto, 3D, datos, interfaz y arte (`docs/animaciones.md`) |
| `stories/` | Apertura, vuelta al listado y cierre armados desde un solo objeto de configuración, con su presupuesto de cuadros (`storyBudget`) |
| `audio/` | `tempo`, `empalme`, `efectos` y `mezcla` (`npm run audio -- <comando>`); ver `docs/audio.md` |
| `render/` | `ve-render`: captura con Chromium y MP4 con ffmpeg, en paralelo y por partes |
| `qa/` | `ve-qa`, `ve-sheet`, `ve-privacy`: control de calidad, hoja de cuadros y privacidad |
| `examples/` | Videos cortos genéricos con datos ficticios, las galerías del catálogo (`fx-text`, `fx-3d`, `fx-data-ui-art`) y `fx-in-scene` |
| `templates/` | Escena e historia de arranque (con `nuevo.sh` para copiarlas) |
| `docs/` | Reglas de producción (con la lista de determinismo), guía de escenas, catálogo de animaciones, sonido, origen del motor |
| `.claude/` | Skill `video-estudio` (cuestionario y etapas con aprobación) |
| `videos/` | Los videos que se producen (`videos/<slug>/`). No existe en un clon nuevo: lo crea la skill (o `templates/nuevo.sh`) y se descubre solo |
| `public/` | Fuentes, imágenes y música con licencia, referenciadas con `asset()` |

## Hacer un video nuevo

Abrí el repo con Claude Code y pedí lo que necesitás: "haceme un video de presentación de estos tres proyectos". La skill [`video-estudio`](.claude/skills/video-estudio/SKILL.md) te lleva por etapas, y en cada una espera tu aprobación:

0. **Cuestionario** (un solo mensaje, con valores por defecto: podés contestar "todo por defecto").
1. **Fichas** de cada tema.
2. **Tema (el design system va primero)**: tokens, informe del adaptador, estilo elegido (esquinas, superficies, números, fondo, movimiento: `docs/estilo.md`) y una hoja de la historia de arranque bajo ese estilo. Las escenas no deciden forma ni movimiento: usan las ayudas del tema.
3. **Guion** por escena (tiempos, qué se ve, efecto, texto, fuente).
4. **Escenas de a una**, con QA, privacidad, hoja de cuadros y un MP4 de esa escena.
5. **Armado**: apertura, vueltas al listado, cierre, sonido (efectos, música, mezcla), render final y verificación.

Cada etapa exige lo anterior aprobado: sobre todo, el guion (con su presupuesto de cuadros) antes que cualquier escena.

El estilo del design system (qué decide y quién lo cumple): [docs/estilo.md](docs/estilo.md). Probar un video con otro design system: `--props '{"theme":"editorial"}'` en `render`, `qa` y `sheet`. Las reglas de producción y sus motivos: [docs/reglas.md](docs/reglas.md) (con "Qué hacer cuando --check falla"). Cómo se escribe una escena: [docs/guia-escenas.md](docs/guia-escenas.md). Qué efecto usar: [docs/animaciones.md](docs/animaciones.md). Convenciones para agentes en este repo: [CLAUDE.md](CLAUDE.md).

## Trabajar con material privado

Este repo es público: no puede llevar nombres de empresas, clientes o personas reales, credenciales, capturas ni marcas que no sean de quien las sube. Un video con material privado se produce así:

- **En una carpeta fuera del repo**: `VE_VIDEOS_DIR=/ruta/absoluta/mis-videos bash templates/nuevo.sh escena <slug> <nombre>` crea ahí el video (con `tsconfig.json` y `env.d.ts` para el editor, a partir de `templates/externo/`) y los comandos `render`, `qa`, `sheet`, `privacy` y `npm run dev` lo descubren si la variable está definida (junto con los ejemplos). Sus fuentes, logos y audio van en `<carpeta>/assets` o `<carpeta>/<slug>/assets` (se sirven solos) y se referencian con `asset()` o con `import ... ?url`. Los tipos se revisan con `npm run typecheck:videos` (o con `npm run typecheck`, que también los mira si la variable está definida).
- **O en `videos/`**, que está en `.gitignore` y no se sube nunca.
- **La cache y las salidas también quedan afuera**: con `VE_VIDEOS_DIR` definida, el bundle compilado (con fuentes, logos y código de las escenas), los segmentos, los cuadros, los mp4 y las hojas se escriben en `<VE_VIDEOS_DIR>/.ve-cache/` y `<VE_VIDEOS_DIR>/out/`, nunca dentro del clon (se pueden mover con `VE_CACHE_DIR` y `VE_OUT_DIR`). `npm run clean` borra esas carpetas y las del clon. Así el clon público se puede comprimir o compartir sin arrastrar nada privado.
- Nada privado va en `examples/`, `public/`, `docs/` ni en ningún otro archivo versionado. Lo que no puede aparecer en pantalla va en `prohibidos.txt` y se verifica con `ve-privacy`.

## Licencias

- El repo no incluye fuentes, música, efectos de sonido, logos ni marcas de terceros. Quien los agrega es responsable de que su licencia permita usarlos en el lugar donde se va a mostrar el video y, si se suben al repo, redistribuirlos.
- Los datos, nombres y cifras de los ejemplos son ficticios.
- Licencia del código del repo: MIT (ver `LICENSE`).
- La carpeta `videos/` no se sube al repo (está en `.gitignore`): ahí viven los guiones y las escenas de cada persona. El motor descubre solo las carpetas `videos/<slug>/` (no hay que editar `engine/runtime/videos.ts`), así que un video propio no deja cambios locales en el motor.
