# Video Studio

Video Studio produce **videos animados** (presentaciones, demos, explicadores, recorridos de herramientas) a partir de una conversación: le decís a un agente de código (Claude Code, Codex CLI u otro) "haceme un video de presentación de estos tres proyectos" y la skill [`video-estudio`](.claude/skills/video-estudio/SKILL.md) te lleva por etapas (cuestionario, fichas, tema, guion, escenas, sonido), esperando tu aprobación en cada una. El motor es propio, en TypeScript y React 18: cada video es una función del número de cuadro, Chromium captura cada cuadro y ffmpeg arma el MP4. El design system (colores, tipografía, esquinas, movimiento) es un tema intercambiable: el mismo video se rehace con otro estilo cambiando solo el tema.

El nombre que ves es "Video Studio"; el repo, el paquete npm, el alias de import (`video-estudio/*`), la skill y los comandos se siguen llamando `video-estudio`.

## Qué necesitás instalar

- **Node 22 o superior** (`node -v`).
- **ffmpeg y ffprobe** en el PATH (`ffmpeg -version`): arman el MP4 y mezclan el sonido.
- **Chromium vía Playwright**: lo instala el paso 2 de abajo. Si ya tenés un Chrome o Chromium, alcanza con `VE_CHROMIUM=/ruta/al/chrome` (en ese caso igual hace falta el paquete `playwright`).
- Para producir un video con ayuda: un agente de código abierto en la carpeta del repo. Está desarrollado y probado con [Claude Code](https://claude.com/claude-code); con otros agentes (Codex CLI, Cursor, Gemini CLI...) el flujo es el mismo pero no está probado de punta a punta (ver [AGENTS.md](AGENTS.md)).

En Windows conviene usar WSL 2 (los scripts de las plantillas son de bash). Instrucciones por sistema operativo, problemas frecuentes y cómo usar la skill: **[docs/instalacion.md](docs/instalacion.md)**.

## Inicio rápido (unos 5 minutos; la guía completa está en [docs/instalacion.md](docs/instalacion.md))

```bash
# 1. Descargar (el repo se llama video-studio; el paquete y los comandos, video-estudio)
git clone https://github.com/ciroarrese/video-studio.git
cd video-studio

# 2. Instalar (una vez)
npm install
npm i -D playwright && npx playwright install chromium

# 3. Diagnóstico: Node, Chromium, ffmpeg, carpetas de salida (dice qué falta y cómo arreglarlo)
npm run doctor

# 4. Comprobar que todo anda: renderiza un video de ejemplo (datos ficticios) en out/hello.mp4
npm run render -- hello

# 5. Mirar los cuadros de un ejemplo más largo y correr su control de calidad
npm run sheet -- kit-demo --count 12      # out/kit-demo-sheet.png: abrila y mirá la hoja
npm run qa -- kit-demo --count 12         # textos cortados, contraste, áreas seguras
```

### Tu primer video propio

1. **Con la skill (lo recomendado).** Abrí tu agente de código (Claude Code, Codex CLI...) en esta carpeta y pedí lo que necesitás: "haceme un video de presentación de mi herramienta". Contestá el cuestionario (podés decir "todo por defecto") y aprobá cada etapa. Los archivos del video se crean en `videos/<slug>/` (que no se sube: está en `.gitignore`).
2. **Si tu material es privado**, definí antes una carpeta fuera del repo: `export VE_VIDEOS_DIR=$HOME/mis-videos`. La skill, las plantillas y los comandos la usan igual, y la cache, los MP4 y las hojas quedan ahí (`$VE_VIDEOS_DIR/out`).
3. **A mano, sin la skill**: `bash templates/nuevo.sh escena mi-video intro` crea `mi-video/intro/` con una escena de arranque ya descubierta por el motor; después `npm run render -- mi-video-intro` (el id es `<slug>-<escena>`), `npm run sheet -- mi-video-intro --count 6` y `npm run qa -- mi-video-intro`. `npm run render -- --list` muestra todos los videos que el motor ve.

El render termina en `out/<id>.mp4`. Antes de dar un video por terminado, la lista de control está en [CLAUDE.md](CLAUDE.md) (tipos, determinismo con `--check`, calidad, privacidad y hoja de cuadros).

## Comandos de referencia

```bash
npm run render -- kit-demo                 # out/kit-demo.mp4 (video de ejemplo, datos ficticios)
npm run sheet -- kit-demo --count 12       # out/kit-demo-sheet.png: hoja de cuadros
npm run qa -- kit-demo                     # control de calidad automático
npm run privacy -- kit-demo --deny lista.txt   # chequeo de privacidad (lista.txt: un término por línea)
npm run dev                                # vista en el navegador: /?video=kit-demo (y &format=vertical)
npm run render -- --list                   # videos descubiertos (examples/* y videos/*), con tamaños y formatos; al final, las carpetas que no cargaron
npm run render -- hello --format vertical  # vertical (1080x1920 / 720x1280); también cuadrado
npm run sheet -- hello --format vertical --count 8   # out/hello-vertical-sheet.png
npm run render -- story-demo --list-scenes # escenas con nombre; --scene <id|índice> renderiza solo una
npm run render -- kit-demo --seconds 1:30-2:05 # un extracto con su sonido (también --frames a-b); --audio-peak-strict falla si el AAC se pasa de -1 dBTP
npm run exec -- /ruta/al/script.ts           # corre un script de afuera que importa video-estudio/* (sin tsconfig propio)
npm run qa -- story-demo --list-scenes     # lo mismo y, en una historia, el presupuesto de cuadros por bloque
npm run sheet -- fx-text --count 8         # galería del catálogo de efectos (también fx-3d y fx-data-ui-art)
```

El plan, las etapas y la forma de trabajo están en [PLAN.md](PLAN.md). De dónde sale el motor: [docs/ORIGEN.md](docs/ORIGEN.md).

Catálogo de efectos listos (texto, 3D, datos, interfaz y arte): [docs/animaciones.md](docs/animaciones.md), con tres galerías para verlos: `fx-text`, `fx-3d` y `fx-data-ui-art` (`/?video=fx-3d&props={"theme":"dark"}`), y `fx-muro`, un muestrario en baldosas chicas con todos los efectos en lazo (`Loop`), `density="auto"` y una escena anidada (`NestedScene`). Para señalar algo: `Callout` (la forma la decide el design system, `annotation-demo` la muestra bajo los cinco temas). Sonido (tempo, empalme al compás, efectos propios y mezcla): [docs/audio.md](docs/audio.md). Subtítulos quemados en el video (bloque o karaoke) y como `.srt`/`.vtt`: [docs/subtitulos.md](docs/subtitulos.md). Otros ejemplos: `hello`, `fx-in-scene` (regresión: efectos montados desde el cuadro 0 dentro de una escena, sin residuos antes de su `start` ni después de terminar), `story-demo` (historia con apertura, vueltas al listado y cierre), `qa-defects` (defectos sembrados para probar el QA). Un video roto no deja inservibles a los demás (solo falla el que tiene el problema) y los tamaños tienen que ser pares. Cada comando y sus opciones: [render/README.md](render/README.md) y [qa/README.md](qa/README.md) (con el criterio de severidad de `offscreen` y del velo en `contrast`). Pruebas y tipos: `npm run typecheck`, `npm test` (rápidas, 1 a 2 minutos) y `npm run test:e2e` (lentas, unos 10 minutos: `--check` por escena de varias historias; solo hace falta si se toca el toolkit).

## Mapa de carpetas

| Carpeta | Qué hay |
|---|---|
| `engine/` | Reloj de cuadros, interpolación, azar determinista, secuencias, audio, espera de recursos, página runtime |
| `kit/` | Cámara, cursor, `Callout` (señal del design system) y `FocusGroup`, titular que se aparta, vuelo de tarjetas, velo, números que cuentan, escena anidada (`NestedScene`) y los garabatos para sistemas de trazo a mano |
| `themes/` | Tema neutro y oscuro, tres design systems de ejemplo (`editorial`, `neon`, `papel`), adaptador de tokens, capa de estilo (`theme.style`) y chequeo de contraste y de estilo |
| `fx/` | Catálogo de efectos listos y deterministas: texto, 3D, datos, interfaz y arte (`docs/animaciones.md`) |
| `stories/` | Apertura, vuelta al listado y cierre armados desde un solo objeto de configuración, con su presupuesto de cuadros (`storyBudget`) |
| `audio/` | `tempo`, `empalme`, `efectos` y `mezcla` (`npm run audio -- <comando>`); ver `docs/audio.md` |
| `render/` | `ve-render`: captura con Chromium y MP4 con ffmpeg, en paralelo y por partes |
| `qa/` | `ve-qa`, `ve-sheet`, `ve-privacy`: control de calidad, hoja de cuadros y privacidad |
| `examples/` | Videos cortos genéricos con datos ficticios, las galerías del catálogo (`fx-text`, `fx-3d`, `fx-data-ui-art`), el muestrario `fx-muro`, `annotation-demo` y `fx-in-scene` |
| `templates/` | Escena e historia de arranque (con `nuevo.sh` para copiarlas) |
| `docs/` | Guía de instalación y uso (`instalacion.md`), reglas de producción (con la lista de determinismo), guía de escenas, catálogo de animaciones, sonido, origen del motor |
| `.claude/` | Skill `video-estudio` (Video Studio: cuestionario y etapas con aprobación) |
| `AGENTS.md`, `CLAUDE.md` | Instrucciones para agentes de código: punto de entrada (`AGENTS.md`, que lee Codex CLI y otros) y convenciones del repo (`CLAUDE.md`, que lee Claude Code) |
| `videos/` | Los videos que se producen (`videos/<slug>/`). No existe en un clon nuevo: lo crea la skill (o `templates/nuevo.sh`) y se descubre solo |
| `public/` | Fuentes, imágenes y música con licencia, referenciadas con `asset()` |

## Hacer un video nuevo

Abrí el repo con tu agente de código y pedí lo que necesitás: "haceme un video de presentación de estos tres proyectos". La skill [`video-estudio`](.claude/skills/video-estudio/SKILL.md) te lleva por etapas, y en cada una espera tu aprobación:

0. **Cuestionario** (un solo mensaje, con valores por defecto: podés contestar "todo por defecto").
1. **Fichas** de cada tema.
2. **Tema (el design system va primero)**: tokens, informe del adaptador, estilo elegido (esquinas, superficies, números, fondo, movimiento: `docs/estilo.md`) y una hoja de la historia de arranque bajo ese estilo. Las escenas no deciden forma ni movimiento: usan las ayudas del tema.
3. **Guion** por escena (tiempos, qué se ve, efecto, texto, fuente).
4. **Escenas de a una**, con QA, privacidad, hoja de cuadros y un MP4 de esa escena.
5. **Armado, sonido y entrega**, con tres altos: el video armado y mudo (apertura, vueltas al listado, cierre), el sonido (efectos, música, mezcla) y la entrega (verificación completa y render final).

Cada etapa exige lo anterior aprobado: sobre todo, el guion (con su presupuesto de cuadros) antes que cualquier escena.

El estilo del design system (qué decide y quién lo cumple): [docs/estilo.md](docs/estilo.md). Probar un video con otro design system: `--props '{"theme":"editorial"}'` en `render`, `qa` y `sheet`. Las reglas de producción y sus motivos: [docs/reglas.md](docs/reglas.md) (con "Qué hacer cuando --check falla"). Cómo se escribe una escena: [docs/guia-escenas.md](docs/guia-escenas.md). Qué efecto usar: [docs/animaciones.md](docs/animaciones.md). Convenciones para agentes en este repo: [AGENTS.md](AGENTS.md) y [CLAUDE.md](CLAUDE.md). Instalación, requisitos por sistema, uso con distintos agentes y problemas frecuentes: [docs/instalacion.md](docs/instalacion.md).

## Trabajar con material privado

Este repo es público: no puede llevar nombres de empresas, clientes o personas reales, credenciales, capturas ni marcas que no sean de quien las sube. Un video con material privado se produce así:

- **En una carpeta fuera del repo**: `VE_VIDEOS_DIR=/ruta/absoluta/mis-videos bash templates/nuevo.sh escena <slug> <nombre>` crea ahí el video (con `tsconfig.json` y `env.d.ts` para el editor, a partir de `templates/externo/`) y los comandos `render`, `qa`, `sheet`, `privacy` y `npm run dev` lo descubren si la variable está definida (junto con los ejemplos). Sus fuentes, logos y audio van en `<carpeta>/assets` o `<carpeta>/<slug>/assets` (se sirven solos) y se referencian con `asset()` o con `import ... ?url`. Los tipos se revisan con `npm run typecheck:videos` (o con `npm run typecheck`, que también los mira si la variable está definida).
- **O en `videos/`**, que está en `.gitignore` y no se sube nunca.
- **La cache y las salidas también quedan afuera**: con `VE_VIDEOS_DIR` definida, el bundle compilado (con fuentes, logos y código de las escenas), los segmentos, los cuadros, los mp4 y las hojas se escriben en `<VE_VIDEOS_DIR>/.ve-cache/` y `<VE_VIDEOS_DIR>/out/`, nunca dentro del clon (se pueden mover con `VE_CACHE_DIR` y `VE_OUT_DIR`). `npm run clean` borra esas carpetas y las del clon. Así el clon público se puede comprimir o compartir sin arrastrar nada privado.
- Nada privado va en `examples/`, `public/`, `docs/` ni en ningún otro archivo versionado. Lo que no puede aparecer en pantalla va en `prohibidos.txt` y se verifica con `ve-privacy`.

## Licencias

- El repo no incluye fuentes, música, efectos de sonido, logos ni marcas de terceros. Quien los agrega es responsable de que su licencia permita usarlos en el lugar donde se va a mostrar el video y, si se suben al repo, redistribuirlos.
- Los datos, nombres y cifras de los ejemplos son ficticios.
- Licencia del código del repo: MIT (ver `LICENSE`). Lista de terceros (dependencias, Playwright, ffmpeg) y qué no se incluye (fuentes, música, imágenes): [NOTICE](NOTICE).
- La carpeta `videos/` no se sube al repo (está en `.gitignore`): ahí viven los guiones y las escenas de cada persona. El motor descubre solo las carpetas `videos/<slug>/` (no hay que editar `engine/runtime/videos.ts`), así que un video propio no deja cambios locales en el motor.
