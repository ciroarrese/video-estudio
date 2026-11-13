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
npm run render -- --list                   # videos descubiertos (examples/* y videos/*), con tamaños y formatos
npm run render -- hello --format vertical  # vertical (1080x1920 / 720x1280); también cuadrado
npm run sheet -- hello --format vertical --count 8   # out/hello-vertical-sheet.png
npm run render -- story-demo --list-scenes # escenas con nombre; --scene <id|índice> renderiza solo una
npm run sheet -- fx-text --count 8         # galería del catálogo de efectos (también fx-3d y fx-data-ui-art)
```

Catálogo de efectos listos (texto, 3D, datos, interfaz y arte): [docs/animaciones.md](docs/animaciones.md), con tres galerías para verlos: `fx-text`, `fx-3d` y `fx-data-ui-art` (`/?video=fx-3d&props={"theme":"dark"}`). Sonido (tempo, empalme al compás, efectos propios y mezcla): [docs/audio.md](docs/audio.md). Otros ejemplos: `hello`, `story-demo` (historia con apertura, vueltas al listado y cierre), `qa-defects` (defectos sembrados para probar el QA). Cada comando y sus opciones: [render/README.md](render/README.md) y [qa/README.md](qa/README.md). Pruebas y tipos: `npm test`, `npm run typecheck`.

## Mapa de carpetas

| Carpeta | Qué hay |
|---|---|
| `engine/` | Reloj de cuadros, interpolación, azar determinista, secuencias, audio, espera de recursos, página runtime |
| `kit/` | Cámara, cursor, garabatos, titular que se aparta, vuelo de tarjetas, velo, números que cuentan |
| `themes/` | Tema neutro y oscuro, adaptador de tokens de un design system, chequeo de contraste |
| `fx/` | Catálogo de efectos listos y deterministas: texto, 3D, datos, interfaz y arte (`docs/animaciones.md`) |
| `stories/` | Apertura, vuelta al listado y cierre armados desde un solo objeto de configuración |
| `audio/` | `tempo`, `empalme`, `efectos` y `mezcla` (`npm run audio -- <comando>`); ver `docs/audio.md` |
| `render/` | `ve-render`: captura con Chromium y MP4 con ffmpeg, en paralelo y por partes |
| `qa/` | `ve-qa`, `ve-sheet`, `ve-privacy`: control de calidad, hoja de cuadros y privacidad |
| `examples/` | Videos cortos genéricos con datos ficticios y las galerías del catálogo (`fx-text`, `fx-3d`, `fx-data-ui-art`) |
| `templates/` | Escena e historia de arranque (con `nuevo.sh` para copiarlas) |
| `docs/` | Reglas de producción (con la lista de determinismo), guía de escenas, catálogo de animaciones, sonido, origen del motor |
| `.claude/` | Skill `video-estudio` (cuestionario y etapas con aprobación) |
| `videos/` | Los videos que se producen (`videos/<slug>/`). No existe en un clon nuevo: lo crea la skill (o `templates/nuevo.sh`) y se descubre solo |
| `public/` | Fuentes, imágenes y música con licencia, referenciadas con `asset()` |

## Hacer un video nuevo

Abrí el repo con Claude Code y pedí lo que necesitás: "haceme un video de presentación de estos tres proyectos". La skill [`video-estudio`](.claude/skills/video-estudio/SKILL.md) te lleva por etapas, y en cada una espera tu aprobación:

0. **Cuestionario** (un solo mensaje, con valores por defecto: podés contestar "todo por defecto").
1. **Fichas** de cada tema.
2. **Tema**: el design system pasado a tokens, con informe de contraste.
3. **Guion** por escena (tiempos, qué se ve, efecto, texto, fuente).
4. **Escenas de a una**, con QA, privacidad, hoja de cuadros y un MP4 de esa escena.
5. **Armado**: apertura, vueltas al listado, cierre, sonido (efectos, música, mezcla), render final y verificación.

Cada etapa exige lo anterior aprobado: sobre todo, el guion (con su presupuesto de cuadros) antes que cualquier escena.

Las reglas de producción y sus motivos: [docs/reglas.md](docs/reglas.md) (con "Qué hacer cuando --check falla"). Cómo se escribe una escena: [docs/guia-escenas.md](docs/guia-escenas.md). Qué efecto usar: [docs/animaciones.md](docs/animaciones.md). Convenciones para agentes en este repo: [CLAUDE.md](CLAUDE.md).

## Licencias

- El repo no incluye fuentes, música, efectos de sonido, logos ni marcas de terceros. Quien los agrega es responsable de que su licencia permita usarlos en el lugar donde se va a mostrar el video y, si se suben al repo, redistribuirlos.
- Los datos, nombres y cifras de los ejemplos son ficticios.
- Licencia del código del repo: MIT (ver `LICENSE`).
- La carpeta `videos/` no se sube al repo (está en `.gitignore`): ahí viven los guiones y las escenas de cada persona. El motor descubre solo las carpetas `videos/<slug>/` (no hay que editar `engine/runtime/videos.ts`), así que un video propio no deja cambios locales en el motor.
