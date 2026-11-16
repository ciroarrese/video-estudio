# Instalación y primer uso de Video Studio

Esta guía te lleva de cero a un video renderizado y a tu primer pedido a un agente de código, sin ayuda. Si ya tenés Node, ffmpeg y un agente, el inicio rápido del [README](../README.md) alcanza.

El repo se llama `video-studio`, pero el paquete, el alias de import (`video-estudio/*`), la skill y los comandos se siguen llamando `video-estudio`: es normal que veas los dos nombres.

Los tiempos de esta guía se midieron en una máquina Linux de 4 núcleos con la caché de npm ya tibia; con descargas desde cero, esperá bastante más en la instalación.

## Qué vas a tener al final

- El repo clonado y sus dependencias instaladas.
- `npm run doctor` en verde y el video de ejemplo `hello` renderizado en `out/hello.mp4`.
- Tu agente de código listo para pedirle "haceme un video de...".

## Requisitos

| Qué | Versión | Para qué |
|---|---|---|
| Node.js | 22 o superior (`engines` de `package.json`) | corre todos los comandos |
| ffmpeg y ffprobe | cualquier versión reciente, **con los codificadores `libx264` y `aac`** (las compilaciones de brew, apt, winget y chocolatey los traen) | arman el MP4 y mezclan el sonido |
| Chromium | el que baja Playwright, o un Chrome o Chromium tuyo (`VE_CHROMIUM`) | captura cada cuadro |
| Git | cualquiera | para clonar y actualizar (o bajás el ZIP) |
| Un agente de código | ver "Con qué agente usarlo" | conduce las etapas del video |

Espacio en disco: unos 170 MB de `node_modules`, unos 400 MB el Chromium de Playwright, y de 100 MB a varios GB de caché y salidas según cuántos videos hagas (`npm run clean` los borra).

### macOS

```bash
brew install node ffmpeg git      # node queda en la última versión estable, que es 22 o superior
node -v && ffmpeg -version
```

Si no usás Homebrew, bajá Node desde <https://nodejs.org> y ffmpeg desde <https://ffmpeg.org/download.html>.

### Linux

Debian o Ubuntu:

```bash
sudo apt update && sudo apt install -y ffmpeg git curl
node -v    # si falta o es menor que 22, instalá Node como se explica abajo
```

El Node de los repositorios de Debian y Ubuntu suele ser viejo. Instalá la versión 22 o superior con [nvm](https://github.com/nvm-sh/nvm) (`nvm install 22`) o con [fnm](https://github.com/Schniz/fnm), o con los paquetes de <https://nodejs.org>.

Otras distribuciones: instalá `nodejs` (22 o superior), `npm`, `ffmpeg` y `git` con tu gestor de paquetes (`dnf`, `pacman`, `zypper`...), o Node con nvm.

Chromium en Linux necesita bibliotecas del sistema (fuentes, `libnss3`, etc.). El paso del navegador de abajo, `npx playwright install --with-deps chromium`, las instala junto con Chromium (pide `sudo`); si ya tenías Chromium y solo falta una biblioteca, `npx playwright install-deps chromium`.

### Windows

Hay dos caminos: **Windows nativo con PowerShell** (sin bash ni WSL) o **WSL 2**. Los comandos de la herramienta son `npm run ...` en los dos (incluido `npm run nuevo` para crear escenas).

**Windows nativo (PowerShell).** Se prueba en cada cambio con integración continua en Linux, macOS y Windows (ver `.github/workflows/instalacion.yml`): esos pasos corren en un Windows real con la PowerShell de siempre, sin bash. Abrí PowerShell (no hace falta que sea de administrador) y:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Gyan.FFmpeg        # o: choco install ffmpeg / scoop install ffmpeg
```

Cerrá la PowerShell y abrí una nueva (para que tome el PATH) y comprobá:

```powershell
node -v                # 22 o superior
ffmpeg -version
ffprobe -version
```

Después seguí **"Descargar el repo"** e **"Instalar, paso a paso"** más abajo: los comandos son los mismos (`git clone`, `npm install`, `npx playwright install chromium`, `npm run doctor`, `npm run render -- hello`). La integración continua instala ffmpeg con Chocolatey (`choco install ffmpeg`); `winget` y `scoop` son equivalentes pero no se ejercitan en esa prueba. Notas para Windows:

- Para una variable de entorno se escribe `$env:VE_VIDEOS_DIR = "C:\Users\vos\mis-videos"` (dura hasta cerrar esa ventana; para dejarla fija, "Variables de entorno" del sistema). La forma `VE_X=valor comando` es de bash y no existe en PowerShell: primero se define la variable y después se corre el comando en otra línea.
- Crear una escena: `npm run nuevo -- escena <slug> <nombre>` (no `bash templates/nuevo.sh`).
- Si PowerShell dice que la ejecución de scripts está deshabilitada al correr `npm`, es la política de ejecución: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y abrí una ventana nueva; o usá `cmd`.
- Antivirus y OneDrive: cloná el repo en una carpeta que no sincronice OneDrive (por ejemplo `C:\dev\video-studio`); las carpetas sincronizadas ralentizan `node_modules` y la caché.
- Las rutas con espacios van entre comillas (`"C:\Mis videos"`).

**WSL 2 (Ubuntu).** Alternativa si ya trabajás en WSL o preferís bash. En una PowerShell de administrador:

```powershell
wsl --install -d Ubuntu
```

Reiniciá si lo pide, abrí "Ubuntu" y seguí **todo lo de Linux** de arriba dentro de esa terminal. Clonà el repo dentro del sistema de archivos de WSL (`~/video-studio`), no en `/mnt/c/...`: ahí todo es mucho más lento. Tu agente tiene que correr dentro de WSL (en la terminal de Ubuntu, o con la extensión de WSL de tu editor). Los MP4 de `out/` se ven desde Windows en `\\wsl$\Ubuntu\home\<tu-usuario>\video-studio\out`.

## Descargar el repo

```bash
git clone https://github.com/ciroarrese/video-studio.git
cd video-studio
```

(El clon crea la carpeta `video-studio`; todo lo que sigue se corre desde ahí. Si la carpeta se llama distinto, o la renombraste, no importa: donde esta guía dice `video-studio` leé "la carpeta donde clonaste".) Sin Git: en la página del repo, "Code" y "Download ZIP"; descomprimilo y abrí una terminal en la carpeta. Un ZIP no sirve para actualizar con `git pull`: para eso conviene el clon.

## Instalar, paso a paso

**1. Dependencias del proyecto.**

```bash
npm install
```

Incluye el paquete `playwright`, que está declarado en `package.json` (no hay que agregarlo aparte). Esperado: termina con una línea como `added 98 packages` y `found 0 vulnerabilities`. Medido: unos 8 s con caché de npm; con descarga desde cero, de 20 s a un minuto.

**2. Playwright y Chromium.**

```bash
npx playwright install chromium
```

En Linux, el comando es `npx playwright install --with-deps chromium`: además de bajar el navegador instala las bibliotecas del sistema que Chromium necesita (pide `sudo`); en macOS y Windows no hace falta. Es lo mismo en bash y en PowerShell.

Esperado: baja Chromium (cientos de MB; unos minutos según tu conexión; medido en Linux: unos 20 s con buena conexión) y no hace nada si ya lo tenés. El paquete `playwright` ya viene con `npm install` y este comando no modifica `package.json` ni `package-lock.json`, así que `git pull` no se traba.La descarga real de Chromium con `npx playwright install chromium` se prueba en cada cambio con integración continua en Linux, macOS y Windows (ver `.github/workflows/instalacion.yml`).

Si ya tenés Chrome o Chromium y no querés bajar otro, salteá este comando y definí `VE_CHROMIUM` con la ruta del ejecutable (macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; Linux: lo que devuelva `which chromium` o `which google-chrome`); el paquete `playwright` se instala igual. Un Chrome muy distinto del que espera Playwright puede dar capturas distintas: si el resultado te sorprende, usá el que baja Playwright.

**3. Diagnóstico.**

```bash
npm run doctor
```

Esperado (medido: unos 5 s):

```text
OK     Node: v22.23.4 (se pide 22 o superior)
OK     Dependencias (node_modules): instaladas
OK     Paquete playwright: presente
OK     Chromium: se lanzó y cerró bien (versión 153.0.8010.12)
OK     ffmpeg: versión 6.1.1-3ubuntu5
OK     ffprobe: versión 6.1.1-3ubuntu5
OK     Carpeta de salidas: /ruta/video-studio/out, 17,1 GB libres
OK     Carpeta de caché: /ruta/video-studio/.ve-cache, 17,1 GB libres
OK     Descubrimiento de videos: el motor lista 16 videos (incluye "hello")

Todo lo imprescindible está en orden.
```

Cada línea que no sea `OK` trae debajo `->` con lo que tenés que hacer. Termina con código distinto de 0 si falta algo imprescindible (`AVISO` no cuenta: por ejemplo, poco espacio libre). Las versiones y la cantidad de videos cambian de una máquina a otra. Opción `--rapido` (`npm run doctor -- --rapido`): omite la última prueba, la más lenta.

**4. Tu primer render.**

```bash
npm run render -- hello
```

Esperado: líneas `render: 5% (...)` hasta `100%`, con unos 25 a 30 cuadros por segundo, y al final:

```text
listo: /ruta/video-studio/out/hello.mp4 (90 cuadros, 8.0 s, 1 partes renderizadas, 0 en cache)
```

Los `8.0 s` son lo que tardó el render, no la duración del video. Medido: de 6 a 9 s (la primera vez compila el bundle). Resultado: `out/hello.mp4`, 1280x720, 3 segundos, unos 35 KB. Abrilo con tu reproductor.

**5. Una hoja de cuadros y el control de calidad de un ejemplo más largo.**

```bash
npm run sheet -- kit-demo --count 12
npm run qa -- kit-demo --count 12
```

Esperado: la primera escribe `out/kit-demo-sheet.png` (12 cuadros en una imagen, de 7 a 11 s: abrila). La segunda imprime hallazgos y termina con una línea como `kit-demo: 12 cuadros revisados en 17.8s; 0 errores, 7 avisos...` (unos 18 s). Que haya avisos en el ejemplo es normal; lo que importa en un video tuyo es que no haya errores. Si todo esto anduvo, la instalación está lista.

## Con qué agente usarlo

La herramienta se desarrolló y se probó con **Claude Code**. Con otros agentes el flujo es el mismo (el agente lee un archivo de instrucciones, ejecuta comandos de terminal y escribe archivos), pero **no está probado de punta a punta**. En todos los casos hace falta que el agente corra en la carpeta del repo, con permiso para leer archivos y ejecutar comandos.

La skill es el archivo `.claude/skills/video-estudio/SKILL.md`; las convenciones, `CLAUDE.md` y `AGENTS.md`.

### Claude Code

Claude Code lee `CLAUDE.md` y carga las skills de `.claude/skills/` del proyecto abierto.

- **Terminal:** `cd <carpeta-donde-clonaste>` (por defecto `video-studio`) y `claude`. Pedí lo que quieras ("haceme un video de...") y la skill `video-estudio` se activa por lo que pedís; si no, nombrala: "usá la skill video-estudio".
- **App de escritorio y extensión de editor:** abrí la **carpeta del clon** (`video-studio` por defecto) como proyecto (no una carpeta de más arriba) y pedí lo mismo en el chat. Es el mismo repo y las mismas skills; no se probaron una por una.
- **Web o nube:** el repo tiene que estar en una cuenta de GitHub tuya conectada (un fork o una copia propia). El entorno de la nube necesita Node 22 o superior, ffmpeg, ffprobe y Chromium, y salida de red para `npm install`; lo primero que conviene pedirle es `npm run doctor`. Probado: en una sesión de nube con esos programas ya instalados, `npm run render -- hello`, la hoja y `qa` anduvieron. No probado: preparar un entorno desde cero y bajar los MP4 resultantes a tu máquina (los archivos quedan en el entorno de la sesión).

### Codex CLI

Según su documentación (no verificado acá), Codex CLI lee `AGENTS.md` de la raíz del repo; ese archivo ya está en el repo y manda al agente a leer `CLAUDE.md` y a seguir `SKILL.md` etapa por etapa.

1. `cd <carpeta-donde-clonaste>` y abrí `codex`.
2. Primera frase: "Leé `AGENTS.md`, `CLAUDE.md` y `.claude/skills/video-estudio/SKILL.md` y, siguiendo la skill etapa por etapa y esperando mi aprobación en cada una, haceme un video de ...".

No se asume que Codex cargue skills desde `.claude/skills/`: por eso la frase le nombra el archivo. No probado con Codex CLI.

Lo que sí se verificó, con un agente simulado que solo lee `AGENTS.md` (no es una prueba con Codex CLI ni con ningún otro producto): que el contenido alcanza para llegar a la skill y producir una escena con su render, sin usar herramientas propias de un agente (solo terminal, `npm` y escritura de archivos).

### Cualquier otro agente que lea archivos y ejecute comandos (Cursor, Gemini CLI y otros)

1. Abrí el agente en la carpeta donde clonaste el repo (`video-studio` por defecto).
2. Si tu agente lee un archivo de instrucciones propio (cada uno usa un nombre y una ubicación distintos; mirá su documentación), apuntalo a `AGENTS.md` y a `CLAUDE.md`. Si no, no hace falta: alcanza con la primera frase.
3. Primera frase, siempre la misma: "Leé `AGENTS.md`, `CLAUDE.md` y `.claude/skills/video-estudio/SKILL.md` antes de empezar. Seguí la skill al pie de la letra, etapa por etapa, esperando mi aprobación en cada una. Quiero un video de ...".

Qué no se probó: ningún agente que no sea Claude Code (ver la verificación con un agente simulado, arriba, en Codex CLI). El repo no incluye archivos de reglas propios de Cursor ni de Gemini CLI a propósito, para no afirmar convenciones que no se verificaron: si tu agente soporta un archivo de reglas, creá uno que diga "seguí `AGENTS.md`".

Lo que sí pide la skill a cualquier agente: poder ejecutar `npm run ...` (y, en Linux, macOS o WSL, comandos de bash), leer imágenes (para mirar las hojas de cuadros; si el agente no las ve, mirá vos las hojas y decile qué corregir) y escribir en `videos/<slug>/`.

## Cómo se usa la skill

**Abrir y pedir.** Con el agente abierto en la carpeta del repo, pedí con tus palabras: "haceme un video de presentación de estos tres proyectos", "quiero un video de demo de mi herramienta", "agregá una escena de...", "cambiá el Tema 2". Si tu agente no activó la skill solo, nombrala: "usá la skill video-estudio".

**Las etapas.** El agente no hace el video de una sola pasada: en cada etapa se detiene y espera tu "aprobado".

| Etapa | Qué hace el agente | Qué tenés que hacer vos |
|---|---|---|
| 0 Cuestionario | Te hace todas las preguntas en un solo mensaje, con un valor por defecto en cada una | Contestar, o decir "todo por defecto". Lo único obligatorio: para qué es el video y quién lo mira |
| 1 Fichas | Resume cada tema en una ficha corta | Corregir lo que esté mal o inventado |
| 2 Tema | Arma el design system (colores, tipografía, esquinas, movimiento) y te muestra una hoja de cuadros | Aprobar cómo se ve |
| 3 Guion | Escribe `guion.md` con tiempos, qué se ve y qué texto va | Aprobarlo: sin guion aprobado no se construye ninguna escena |
| 4 Escenas | Una por una, con controles automáticos y una hoja de cuadros | Mirar la hoja, pedir cambios, aprobar |
| 5 Armado, sonido y entrega | Arma el video, agrega sonido si lo pediste y hace el render final | Aprobar tres veces: video mudo, sonido y entrega |

**Qué te va a preguntar** (etapa 0): objetivo y público; duración y formatos (horizontal 16:9 por defecto; vertical y cuadrado suman trabajo en cada escena); qué temas entran y de dónde sale la información; si tenés design system, capturas o código; si las cifras son reales o inventadas y qué nunca puede aparecer; qué texto va en pantalla y si hace falta subtítulos (si va a redes o se mira sin sonido, por defecto sí); si habrá locución; música y efectos de sonido; y dónde se va a mostrar (define licencias).

**Dónde quedan los archivos.**

- `videos/<slug>/`: tus fichas, el tema (`theme.ts`), el guion (`guion.md`), `prohibidos.txt` y una carpeta por escena. La carpeta `videos/` no se sube a git (está en `.gitignore`) y no existe en un clon nuevo: la crea el agente.
- `out/`: los MP4, las hojas de cuadros (`out/<id>-sheet.png`) y los informes. También fuera de git.
- `.ve-cache/`: caché de compilación y de partes ya renderizadas (volver a renderizar tras un cambio chico tarda segundos). Se puede borrar con `npm run clean`.

El `<slug>` es el nombre corto del video (minúsculas, números y guiones). El video completo tiene como id el `<slug>`, y cada escena `<slug>-<escena>`; `npm run render -- --list` los muestra.

**Pedir cambios.** Con el video ya armado, hablá por bloque: Apertura, Tema 1, Tema 2, Vuelta 1, Cierre. Si decís "la escena 2", el agente te confirma cuál entendió antes de tocar nada. Los cambios que alteran el guion aprobado se anotan primero en el guion y se aprueban de nuevo. Cada cambio vuelve a pasar por los controles (determinismo, calidad, privacidad) y te muestra solo lo que cambió.

**Tu propio design system.** Si tenés tokens (un archivo CSS con variables o un JSON), pasáselos en la etapa 0 o 2 y el agente genera un tema con un informe (qué tomó de tus tokens, qué quedó por defecto y qué pares de colores no llegan al contraste). Cómo se mapean: [themes/README.md](../themes/README.md), sección "Cómo traer tu design system". Sin tokens se usa un tema neutro (claro u oscuro): el agente no inventa colores de marca.

**Material privado.** El repo es público; los nombres, cifras y capturas reales no pueden quedar adentro. Definí antes de empezar una carpeta fuera del repo y arrancá el agente con la variable puesta:

```bash
export VE_VIDEOS_DIR=$HOME/mis-videos      # Windows (PowerShell): $env:VE_VIDEOS_DIR = "C:\Users\vos\mis-videos"
claude                                     # o tu agente, abierto en la carpeta del repo
```

Los videos viven en `$VE_VIDEOS_DIR/<slug>/`, y la caché, los MP4 y las hojas, en `$VE_VIDEOS_DIR/out` y `$VE_VIDEOS_DIR/.ve-cache`, nunca dentro del clon (`VE_OUT_DIR` y `VE_CACHE_DIR` los mueven). Detalle: [README, "Trabajar con material privado"](../README.md#trabajar-con-material-privado). Lo que no puede aparecer en pantalla va en `prohibidos.txt` y el comando `npm run privacy` lo verifica.

**Subtítulos y locución.** Quemados en el video (bloque o karaoke) y como `.srt` o `.vtt`: [docs/subtitulos.md](subtitulos.md). La herramienta no genera voz: la locución la grabás o aportás vos, y se alinea con los subtítulos ([docs/audio.md](audio.md) y [docs/subtitulos.md](subtitulos.md)). **Sonido:** efectos propios sintetizados, o una pista tuya con licencia que se ajusta al compás; no trae música ([docs/audio.md](audio.md)).

**Cuánto tarda un render.** Contá de 3 a 4 cuadros por segundo a 1920x1080 en una máquina compartida de 4 núcleos (un video de 60 s son unos 8 a 10 minutos por formato); con la máquina libre es bastante más rápido. El agente te avisa antes de lanzar cada render largo.

### Ejemplo de conversación

```text
Vos:     Haceme un video de presentación de mi app de turnos. Hablá en español.
Agente:  Voy a seguir la skill video-estudio. Preguntas, con valor por defecto:
         1. Objetivo y público (sin default)...
         2. Duración y formato (60 a 90 s, solo 16:9)...
         [...10 preguntas...]
Vos:     1. Presentarla al equipo de la clínica. Lo demás, todo por defecto.
Agente:  Resumen en 5 líneas... creé videos/turnos-clinica/ y prohibidos.txt. ¿Confirmás?
Vos:     Confirmado.
Agente:  Fichas de los tres temas (Agenda, Recordatorios, Panel)... ¿Las aprobás?
Vos:     En Recordatorios cambiá "SMS" por "mensaje".
Agente:  Listo. [sigue: tema con hoja de cuadros, guion con presupuesto de cuadros, escenas...]
Vos:     (tras ver la hoja del Tema 2) El número se ve chico.
Agente:  Entendí: el Tema 2, Recordatorios. ¿Es ese? ...
```

## Usar la skill con el video fuera del repo (otra carpeta o proyecto)

La skill y todos sus comandos son relativos a la raíz del repo (`npm run ...`, `docs/`, `templates/`), así que **el agente tiene que correr en el repo**. Hay dos formas.

**A. Abrir el agente en el repo y que el video viva afuera (la que está probada).** Es lo de "Material privado": `export VE_VIDEOS_DIR=/ruta/a/tu/proyecto/videos` y abrí el agente en la carpeta del clon. Los videos, la caché y las salidas quedan en tu carpeta; el repo no se toca. Con `--out out/x.mp4` la ruta relativa cae en `<VE_VIDEOS_DIR>/out/x.mp4` (y cada comando imprime la ruta final absoluta). Si tu agente corre cada comando en un shell nuevo, la variable va en cada uno: `cd <ruta-del-clon> && VE_VIDEOS_DIR=<carpeta> npm run ...`. Con `npm run nuevo -- escena <slug> <nombre>` la carpeta recibe un `tsconfig.json` y un `env.d.ts` para que tu editor entienda los imports. Probado acá: crear una escena en una carpeta externa, listarla con `render -- --list` y renderizar un tramo (`out/` queda en esa carpeta).

**B. Abrir el agente en otra carpeta y tener la skill disponible (solo Claude Code).** Claude Code carga las skills personales de `~/.claude/skills/<nombre>/SKILL.md`. Podés enlazar o copiar la de este repo:

```bash
mkdir -p ~/.claude/skills
ln -s "<ruta-del-clon>/.claude/skills/video-estudio" ~/.claude/skills/video-estudio    # o: cp -r (queda desactualizada con cada git pull)
```

En Windows (PowerShell) el enlace es una unión de carpetas:

```powershell
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
New-Item -ItemType Junction -Path "$HOME\.claude\skills\video-estudio" -Target "<ruta-del-clon>\.claude\skills\video-estudio"
```

La skill sigue necesitando el repo clonado, con sus dependencias instaladas, y cuál es su ruta: `SKILL.md` le indica al agente que, si el directorio actual no es la raíz del repo, use la ruta que le des o la variable `VIDEO_STUDIO_DIR` (una convención de esta guía: el motor no la lee) y corra cada comando con `cd <raíz> && ...`. Entonces abrí el agente donde quieras y decile, en la primera frase: "Usá la skill video-estudio. El repo está en `<ruta-del-clon>`; los videos van en `/ruta/a/mis-videos` (`VE_VIDEOS_DIR`)". Probado de punta a punta con un agente simulado (no con Claude Code cargando la skill): con una copia del `SKILL.md` en una carpeta personal falsa y el agente parado en una carpeta ajena, la comprobación de la raíz con `VIDEO_STUDIO_DIR`, `npm run nuevo`, `typecheck`, `--check`, `qa`, `privacy`, `sheet` y el render funcionaron con `cd <raíz> &&` y `VE_VIDEOS_DIR` en cada comando. No verificado: que Claude Code cargue la skill solo desde `~/.claude/skills` (el enlace resuelve, pero la carga automática no se probó). Se probó también el flujo A. En Windows nativo, `ln -s` pide permisos de administrador: copiá la carpeta.

## Problemas frecuentes

Primero corré `npm run doctor`: cubre casi todo lo de esta lista. Los mensajes están copiados del código.

| Síntoma | Causa y arreglo |
|---|---|
| Aviso `EBADENGINE Unsupported engine` al instalar, o errores raros de sintaxis | Node viejo (npm solo avisa, pero después los comandos fallan). `node -v` tiene que dar 22 o más; instalá una versión nueva (nvm: `nvm install 22 && nvm use 22`) y repetí `npm install`. |
| `tsx: not found` o `Cannot find module` al correr un `npm run` (o el aviso de `doctor` sobre `node_modules`) | Faltó `npm install` (o se hizo en otra carpeta). Corrélo en la raíz del repo. |
| `No se pudo ejecutar ffmpeg: spawn ffmpeg ENOENT (esta ffmpeg instalado y en el PATH?)` | Falta ffmpeg o no está en el PATH. Instalalo (ver "Requisitos"), abrí una terminal nueva y comprobá `ffmpeg -version` y `ffprobe -version`. En Windows, el PATH solo se actualiza en terminales nuevas. |
| ffmpeg corre pero el render falla al codificar | Tu ffmpeg no trae `libx264` o `aac`. `npm run doctor` lo dice. Instalá una compilación completa. |
| `No se pudo cargar "playwright"...` | Falta el paquete (viene en las dependencias del proyecto): corré `npm install` en la carpeta del repo. |
| `No se pudo lanzar Chromium ...: browserType.launch: Executable doesn't exist at ...` | Falta bajar el navegador: `npx playwright install chromium`. Si preferís el tuyo, `VE_CHROMIUM=/ruta/al/chrome`. Si usás `VE_CHROMIUM`, revisá que la ruta exista y sea ejecutable. |
| Chromium se cierra al lanzar en Linux, o dice que falta una biblioteca (`libnss3`, `libatk`...) | `npx playwright install-deps chromium` (con `sudo`).  `VE_CHROMIUM_ARGS` pasa argumentos extra al navegador si tu entorno los necesita. |
| `aviso: La fuente "X" no está instalada en esta máquina...` | El tema nombra una fuente del sistema que tu máquina no tiene, y el video sale con la tipografía de reserva (distinta en cada máquina). Instalala, o pedile al agente que la declare con archivo en `theme.font.files`. Con `--strict-fonts` (o `VE_STRICT_FONTS=1`) el aviso se vuelve un error: conviene para el render final. |
| `No cargó una fuente; el video saldría con otra tipografía...` | La fuente con archivo del tema no se pudo leer (ruta mal escrita o archivo dañado). Corregí la ruta; solo para un borrador, `--allow-missing-fonts`. |
| El render es lento | Es CPU pura: cuadros por segundo según los núcleos libres (`render` imprime los cuadros por segundo). Cerrá otros programas pesados; para un borrador de un tramo, `--seconds 10-20` o `--scene <nombre>`. `--scale 0.5` ayuda en una máquina libre, pero no se reutiliza en el render final. La caché reutiliza lo que no cambió, así que el segundo render casi no tarda. `--concurrency N` fija las páginas en paralelo (por defecto, tus núcleos, hasta 6): más que los núcleos libres enlentece. |
| `Unknown video "x". Available: ...` | El id no existe. `npm run render -- --list` muestra los ids exactos (escena: `<slug>-<escena>`; historia: `<slug>`). |
| Un `id` repetido entre dos carpetas | Ese video falla con un error que nombra las dos carpetas (`videos/<a>` y `videos/<b>`); cambiá el `id` de una. Los demás videos siguen andando. |
| `Atención: N carpetas no cargaron` al final de `--list` | Una carpeta de video no compila. Abajo dice cuál y por qué; arreglá ese video, los otros no se afectan. |
| Sin espacio en disco (`ENOSPC`) | `npm run clean` borra `.ve-cache/` y `out/` (y los de `VE_VIDEOS_DIR`, `VE_CACHE_DIR` y `VE_OUT_DIR` si están definidos) y libera lo que ocupa la caché; no toca tus videos. `npm run doctor` avisa cuando queda menos de 2 GB. |
| `npx playwright install chromium` falla o no avanza detrás de un proxy o red corporativa | Playwright usa las variables de proxy del sistema: definí `HTTPS_PROXY=http://proxy:puerto` antes de correrlo (y las certificadoras propias con `NODE_EXTRA_CA_CERTS=/ruta/cert.pem`). Si la red bloquea la descarga, pedí a tu equipo de sistemas un Chrome o Chromium y apuntá `VE_CHROMIUM` a él. Lo mismo vale para `npm install` (`npm config set proxy` y `https-proxy`). No probado acá. |
| El agente no ve las imágenes de la hoja de cuadros | No todos los agentes leen imágenes. Abrí `out/<id>-sheet.png` vos y contale qué corregir. |
| `npm run render -- <id> --check` falla | La escena depende de algo que cambia entre cuadros. Mensaje, causas y qué hacer: [docs/reglas.md](reglas.md), "Qué hacer cuando --check falla". |
| Salió algo viejo | `--no-cache`, o `npm run clean`. |

## Actualizar

```bash
git pull
npm install
npm run doctor
```

Si en una versión anterior de esta guía hiciste `npm i -D playwright`, tu `package.json` y `package-lock.json` quedaron modificados y `git pull` puede negarse. Salida: `git checkout package.json package-lock.json`, `git pull` y `npm install` (el paquete ya viene declarado; el Chromium ya bajado se reutiliza). Tus videos no se tocan (`videos/` y `VE_VIDEOS_DIR` están fuera del control de git). Un ZIP no se actualiza: bajá el ZIP nuevo y copiá tu carpeta `videos/` adentro.

Después de actualizar, un render tarda más la primera vez porque la caché se invalida.

## Desinstalar

1. Borrá la carpeta del repo (`rm -rf <carpeta-del-clon>`; en PowerShell, `Remove-Item -Recurse -Force <carpeta-del-clon>`). Tus videos privados en `VE_VIDEOS_DIR` **no** se borran: están afuera; copialos antes si querés conservarlos (los de `videos/` sí desaparecen con la carpeta).
2. Si enlazaste la skill: `rm ~/.claude/skills/video-estudio` (en PowerShell, `Remove-Item "$HOME\.claude\skills\video-estudio"`).
3. Chromium de Playwright vive aparte y ocupa unos 400 MB: Linux `~/.cache/ms-playwright`, macOS `~/Library/Caches/ms-playwright`, Windows `%USERPROFILE%\AppData\Local\ms-playwright`.
4. Sacá las variables `VE_*` de tu perfil de shell si las agregaste.
