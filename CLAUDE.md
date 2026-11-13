# video-estudio: convenciones para agentes

Herramienta para producir videos animados con un motor propio (TypeScript + React 18). Para hacer un video seguí la skill `.claude/skills/video-estudio/SKILL.md`; las reglas están en `docs/reglas.md`, la guía de escenas en `docs/guia-escenas.md` y el catálogo de efectos listos (`fx/`) en `docs/animaciones.md`: usalo antes de escribir una animación desde cero.

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
- **Ámbito**: para producir un video no se edita `engine/`, `kit/`, `themes/`, `render/`, `stories/`, `fx/` ni `qa/` (la única excepción es la línea de import en `engine/runtime/videos.ts`); las escenas viven en `videos/<slug>/`. Si falta una pieza, anotarlo y pedirlo.

## Antes de dar algo por terminado

```bash
npm run typecheck
npm test
npm run render -- <id> --check          # determinismo
npm run qa -- <id> --count 40           # control de calidad
npm run privacy -- <id> --deny videos/<slug>/prohibidos.txt --scan-source videos/<slug>
npm run sheet -- <id> --count 12        # y mirar la hoja
```

Los videos se registran con una línea de import en `engine/runtime/videos.ts`.
