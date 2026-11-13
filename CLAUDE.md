# video-estudio: convenciones para agentes

Herramienta para producir videos animados con un motor propio (TypeScript + React 18). Para hacer un video seguí la skill `.claude/skills/video-estudio/SKILL.md`; las reglas están en `docs/reglas.md`, la guía de escenas en `docs/guia-escenas.md`, el sonido en `docs/audio.md` y el catálogo de efectos listos (`fx/`) en `docs/animaciones.md`: usalo antes de escribir una animación desde cero.

## Idioma

- Toda la documentación y todo texto que ve una persona va en español rioplatense: voseo, "sentence case" (solo la primera palabra con mayúscula), sin emojis.
- Los identificadores de código pueden ir en inglés o en español; los comentarios, en español.

## Reglas del repo

- **Pureza**: toda escena y toda pieza del kit es una función pura del número de cuadro (`useFrame()`) y de sus props. La lista completa de lo prohibido y permitido (estado, azar, CSS animado, `useId`, canvas, CSS 3D por elemento, texto) está en `docs/reglas.md`, sección "Lista única de determinismo".
- **Tema**: colores, tipografías, radios, sombras, curvas y tamaños de letra salen de `useTheme()`. Nada de valores de marca ni `#hex` en escenas ni en el kit.
- **Interfaces**: se recrean con su estructura y sus rótulos; no se usan capturas.
- **Privacidad**: repo público. Sin nombres de empresas, clientes o personas reales, sin credenciales, correos ni dominios internos, en ningún archivo. Cifras emuladas y nombres ficticios por defecto. Lo que la persona dice que no puede aparecer va en `videos/<slug>/prohibidos.txt` y se verifica con `ve-privacy`.
- **Licencias**: no agregar fuentes, música, imágenes ni marcas sin verificar que su licencia permita usarlas donde se va a mostrar el video y redistribuirlas.
- **Origen del motor**: no leer ni copiar código fuente de otros frameworks de video; ver `docs/ORIGEN.md`.
- **Ámbito**: para producir un video no se edita `engine/`, `kit/`, `themes/`, `render/`, `stories/`, `fx/` ni `qa/` (no hay excepciones: los videos se descubren solos); las escenas viven en `videos/<slug>/`. Si falta una pieza, anotarlo y pedirlo.

## Antes de dar algo por terminado

```bash
npm run typecheck
npm test
npm run render -- <id> --check          # determinismo (repetir con --format vertical y cuadrado si el video los admite)
npm run qa -- <id> --count 40           # control de calidad
npm run privacy -- <id> --deny videos/<slug>/prohibidos.txt --scan-source videos/<slug>
npm run sheet -- <id> --count 12        # y mirar la hoja
```

## Si cambiás el toolkit (engine, kit, themes, stories, fx, qa, audio, render)

Esto no es para hacer un video: es para quien modifica la herramienta. Además de `npm run typecheck`:

```bash
npm test                # pruebas rápidas (~1 a 2 min): todo menos los archivos `*.e2e.test.*`
npm run test:e2e        # pruebas lentas (~10 min): `--check` por escena de varias historias; correr antes de cerrar un cambio en `stories/`, `kit/` o el render
```

Los casos lentos se llaman `*.e2e.test.ts` y quedan fuera de `npm test` (ver `vitest.config.ts` y `vitest.e2e.config.ts`).

Los videos no se registran a mano: el runtime descubre toda carpeta `examples/*/index.ts(x)` y `videos/<slug>/index.ts(x)` (también `videos/<slug>/<carpeta>/index.ts(x)`); `npm run render -- --list` muestra los que ve. Un `id` repetido entre dos carpetas falla con un error que nombra las dos. Formatos: `--format horizontal|vertical|cuadrado` en render, qa y sheet (el video los habilita con `formats` en `defineVideo`); una escena sola: `--scene <id|índice>` y `--list-scenes`.
