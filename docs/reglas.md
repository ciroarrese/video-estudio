# Reglas de producción

Lista de control para cada escena y cada video. Cada regla lleva su motivo, para poder decidir los casos que no cubre. Las que revisa una herramienta lo dicen al final.

## Técnicas (el render tiene que dar siempre lo mismo)

- [ ] **La escena es una función pura del cuadro.** Todo sale de `useFrame()` (o de una prop `frame`), de las props y del tema.
  *Por qué:* el motor salta entre cuadros en cualquier orden y en paralelo; si algo depende del historial, el mismo cuadro sale distinto según cómo se renderice.
  *Cómo:* calculá cada valor desde el cuadro con `kf`/`interpolate`; no lo guardes. *Se revisa con:* `npm run render -- <id> --check`.

### Lista única de determinismo

Esta es la lista de referencia; `CLAUDE.md`, `engine/README.md`, `kit/README.md` y `docs/animaciones.md` remiten acá.

- [ ] **Sin estado, referencias ni temporizadores:** nada de `useState`/`useRef` que acumulen entre cuadros, `setTimeout`/`setInterval`/`requestAnimationFrame`, `Date`/`Date.now()` ni `Math.random()`.
  *Por qué:* el resultado pasaría a depender de cuántas veces y en qué orden se renderizó. *Qué hacer:* derivá todo del cuadro; para azar usá `random(seed)` del motor (sembrado y determinista).
- [ ] **Sin animaciones ni transiciones CSS** (`transition`, `animation`, `@keyframes`).
  *Por qué:* corren con el reloj del navegador, no con el cuadro. *Qué hacer:* animá con `kf`/`interpolate` sobre el cuadro.
- [ ] **Sin `useId`.**
  *Por qué:* los ids que genera cambian con el historial de render y rompen referencias SVG (degradados, máscaras, recortes). *Qué hacer:* derivá los ids de las props (por ejemplo `id` del garabato o un prefijo + índice).
- [ ] **Canvas solo con `FrameCanvas`**, que redibuja todo en cada cuadro.
  *Por qué:* un `<canvas>` que conserva lo dibujado antes depende del historial. *Qué hacer:* `draw(ctx, frame, size)` pura, limpiando y dibujando la escena completa cada vez.
- [ ] **CSS 3D permitido solo como `perspective()` propio de cada elemento**, dentro de su `transform`, con las posiciones de layout en enteros: todo el movimiento va dentro de `transform` y `left`/`top` son píxeles enteros. **Prohibido** `transform-style: preserve-3d` y `perspective` en un ancestro.
  *Por qué:* con la perspectiva en un ancestro, Chromium rasteriza las capas de forma distinta según el historial de cuadros; con `perspective()` en el propio `transform` y layout entero, el resultado es estable (es lo que hace `stories/`). *Qué hacer:* `transform: perspective(P) rotateX(..) rotateY(..) translate3d(..)` en cada pieza, orden de profundidad con `zIndex`, nada de planos que se crucen. Ver `stories/README.md`.
- [ ] **`scale()` sobre texto y traslados de texto fraccionarios: riesgo conocido, no prohibición.**
  *Por qué:* el texto escalado o ubicado en una posición fraccionaria puede rasterizarse distinto según el historial. *Qué hacer:* se permiten dentro de una pieza mientras esa pieza pase `--check` completo; si el chequeo falla, preferí animar `font-size` o usar un traslado entero (`Math.round`).
- [ ] **Desenfoques y sombras están bien**, dentro de la tolerancia de `--check`.
- [ ] **Siempre correr `npm run render -- <id> --check`.** Por defecto es tolerante: ningún píxel con diferencia mayor que 2 por canal, hasta 0,1 % de píxeles con diferencia 2 y hasta 20 % con diferencia 1 (ruido de desenfoques y sombras); `--check-strict` compara byte a byte.
  *Por qué:* es la única forma de enterarse de que una escena depende del historial antes de que lo note la persona.

- [ ] **Todo sale del tema.** Colores, tipografías, radios, sombras, curvas y tamaños de letra vienen de `useTheme()`. Ningún `#hex` ni `font-family` suelto en una escena.
  *Por qué:* el mismo video tiene que poder rehacerse con otro design system cambiando solo el tema. Con un color fijo, esa escena queda desentonando.
- [ ] **Los recursos externos se esperan.** Fuentes e imágenes se cargan con `asset()` y `holdRender`/`releaseRender` (las piezas del kit ya lo hacen).
  *Por qué:* un cuadro capturado antes de que cargue la imagen sale vacío, y no lo ves hasta el final.
- [ ] **Cada garabato tiene un `id` único.** *Por qué:* el `id` es también la semilla del temblor y el nombre del degradado SVG; dos iguales se pisan.
- [ ] **Los cuadros clave de cámara, de `kf` y de `interpolate` son estrictamente crecientes.** *Por qué:* si no, lanzan un error que nombra los cuadros.

## Qué hacer cuando --check falla

`npm run render -- <id> --check` hace dos pruebas: compara el HTML de cada cuadro renderizado de dos maneras y compara los píxeles de dos capturas. La comparación de HTML ignora el orden de atributos, clases y propiedades de `style`: no hace falta mantener constante el conjunto de propiedades ni agregar `key`s para eso. Cuentan los valores, los hijos, el texto y el orden entre un atajo y su componente (`margin` + `margin-left`). La de píxeles atrapa cualquier diferencia visual dentro de la tolerancia. El error más caro de arreglar es el que se ataca a ciegas; seguí este orden.

1. **Leé lo que imprime.** Para cada cuadro con diferencias: el rectángulo (bbox) donde difiere, los elementos que hay en su centro y sus esquinas (etiqueta, texto corto, ruta DOM), las escenas con nombre activas en ese cuadro y, al final, una línea `pista:` que remite a esta sección. El problema está en lo que se dibuja dentro de ese rectángulo, en ese cuadro; lo demás da igual. Repetí en el cuadro vecino: si falla solo en uno, mirá qué empieza o termina ahí (un `start`, un `kf` que cruza un valor, un montaje).
2. **Bisecá sacando piezas.** Comentá la mitad de los elementos de la escena (o dejá solo los del bbox), corré `--check --frames a-b` sobre el rango del cuadro y volvé a poner de a una hasta que reaparezca. Con `--scene <id>` revisás una escena sola; con `--format` probá cada formato por separado.
3. **Causas habituales y arreglos:**
   - **Residuos en elementos quietos:** `scale(1)`, `translate(0px)` u `opacity: 1` que quedan puestos cuando el elemento ya no se anima. Chromium crea una capa distinta con y sin ellos. *Arreglo:* emití el `transform`, la opacidad o el filtro solo mientras anima; al terminar, sin propiedad (`xform`, `fade`, `svgScale` de `fx/core` lo hacen; que la propiedad aparezca y desaparezca no rompe la comparación de HTML).
   - **Texto bajo `scale()`:** el glifo se rasteriza según el historial. *Arreglo:* animá `font-size`, o escalá el contenedor sin texto y poné el texto fuera, o con traslado entero.
   - **`left`/`top` fraccionarios bajo un ancestro con transform:** *Arreglo:* `Math.round` en las posiciones de layout, y todo el movimiento dentro de `transform`.
   - **Efectos de `fx/` montados antes de su `start` o después de terminar:** los efectos del catálogo pueden quedar montados todo el tiempo (`fx-in-scene` lo prueba): antes de `start` y una vez terminados no emiten `transform`, `filter` ni `opacity`. Si tu propio efecto deja residuos, aplicá lo de "Residuos" arriba; como último recurso montalo solo mientras corre (`f >= start && <Efecto start={start} />`).
   - **Elementos visibles durante `zoomThrough`:** al atravesar, la escala llega a 40 y todo lo que sigue visible se rasteriza enorme. *Arreglo:* ocultá (no montes) lo que sobra desde el cuadro en que empieza el atravesado.
   - **Escalas pesadas anidadas:** un contenedor con `scale()` dentro de un mundo que ya hace zoom multiplica el error. *Arreglo:* hacé el zoom con la cámara (`cameraAt`) y no escales además el contenedor.
   - **Fuentes sin cargar:** el cuadro se captura con la tipografía de reserva. *Arreglo:* declarala en `theme.font.files` o con `asset()` para que el motor espere; confirmá que el archivo existe.
4. **Verificá en todos los formatos** que el video admite y con `--check` completo (no solo el rango): un arreglo en vertical puede mover la causa en horizontal.
5. Solo después de eso, y si el diferencial es desenfoque o sombra legítimos, ver la tolerancia de `--check` (no la subas para tapar un defecto real).

Ver también el catálogo (`docs/animaciones.md`): los efectos de `fx/` ya cumplen estas reglas.

## De contenido y privacidad

- [ ] **Cifras emuladas y nombres ficticios por defecto.** Solo van datos reales si la persona lo pidió expresamente y dijo cuáles.
  *Por qué:* un video se comparte más de lo previsto; un número o un nombre real en pantalla no se puede retirar.
- [ ] **Nunca se imprimen ni se versionan credenciales.** Nada de claves, tokens, correos, dominios ni URLs internas en el código, en `--props`, en los registros ni en el chat.
  *Por qué:* el repo es público y el código queda en el historial para siempre. *Se revisa con:* `npm run privacy -- <id> --deny <lista> --scan-source videos/<slug>` (correos, teléfonos, dominios que no sean de ejemplo y términos prohibidos; no escanea los archivos de `--deny`/`--allow` ni ningún `prohibidos.txt`, así la lista no se reporta a sí misma).
- [ ] **Cada video trae su lista de términos prohibidos** (`videos/<slug>/prohibidos.txt`, un término o `/regex/flags` por línea), armada en el cuestionario con lo que la persona dijo que no puede salir, y se corre en cada escena y en el video final.
- [ ] **Nada de nombres de empresas, clientes o personas reales** en lo que se sube al repo: ni en el código, ni en los textos, ni en los ejemplos.
- [ ] **Licencias del lugar de exhibición.** Antes de agregar una fuente, una música, un efecto de sonido, un logo o una marca de terceros, verificar que su licencia permita usarlos donde se va a mostrar el video (interno, web pública, redes, evento) y redistribuirlos si se suben al repo.
  *Por qué:* lo que sirve para una reunión interna puede no servir en un canal público. El repo no incluye fuentes, música ni marcas; la responsabilidad de lo que se agrega es de quien lo agrega.

## De imagen

- [ ] **Las herramientas se recrean con su estructura y sus rótulos reales; no se usan capturas.** Ventana, tabla, tarjeta, gráfico y formulario se arman con primitivas del tema.
  *Por qué:* una captura se pixela al acercar la cámara, no sigue el tema y puede traer datos reales. Una recreación se acerca sin perder nitidez y se reconoce por su estructura.
- [ ] **Si la herramienta real es oscura, se deja oscura** (con `dark` o un tema oscuro propio), aunque el resto del video sea claro.
  *Por qué:* es lo que ayuda a la gente a reconocerla de inmediato.
- [ ] **El titular de la escena se aparta cuando la cámara se acerca** (`hide={hideFromScale(cam.scale)}`), y las vistas generales dejan lugar arriba (unos 170 px libres).
  *Por qué:* el titular está fijo en pantalla y tapa contenido apenas hay zoom. *Se revisa con:* `qa` (`overlap`, `covered`) y la hoja de cuadros.
- [ ] **Acercamiento rápido en cada acción clave** (clic, número, campo que se completa) y **desenfoque de movimiento en los viajes largos** (`cameraAt` lo calcula con la velocidad; solo se apaga en el atravesado final con `noBlurFrom`).
  *Por qué:* el zoom dice dónde mirar; sin desenfoque, un viaje largo parece un salto.
- [ ] **Entre un tema y otro se vuelve al listado, se tilda el que se acaba de mostrar y se entra al siguiente.** `composeStory` lo hace con las vueltas al listado; con `interludes: false` se pierde.
  *Por qué:* da orientación (dónde estamos, cuánto falta) sin subtítulos.
- [ ] **Subtítulos solo si la persona los pide.** El valor por defecto es sin subtítulos: la imagen tiene que explicarse sola.
  *Por qué:* se probaron y se sacaron; compiten con la imagen y la tapan.
- [ ] **Los flujos tienen dirección:** lo que sale hacia un lado vuelve por el mismo eje (lo que viaja a la derecha, vuelve desde la derecha; un arco de ida y uno de vuelta no se cruzan).
  *Por qué:* un flujo sin dirección se lee como desorden.
- [ ] **Cada escena termina atravesando un elemento** (`zoomThrough` con un punto de destino) **y cierra con un velo** (`Wash`) hacia la siguiente.
  *Por qué:* la transición es continua y nunca hay un corte seco.
- [ ] **El texto es legible:** letra de al menos 18 px a 1080p (contando el zoom de cámara), contraste mínimo 4.5 en texto chico y todo dentro del área segura. Se usan los tamaños de `theme.type`.
  *Se revisa con:* `qa` (`min-size`, `contrast`, `safe-area`, `clip`, `offscreen`).
  Cómo decide `qa` cada severidad (`offscreen`: error, aviso o info según el movimiento y la cámara; `contrast` bajo un velo en transición contra uno quieto): `qa/README.md`, secciones "Reglas de `ve-qa`" y "`offscreen`: por qué error, aviso o info". Un `Wash` lleva `data-qa-veil` para que `qa` lo distinga.

## De proceso

- [ ] **Antes de mostrar una escena: hoja de cuadros.** `npm run sheet -- <id> --count 12` y mirarla.
  *Por qué:* es mucho más barato corregir ahí que después del render.
- [ ] **Antes de mostrar una escena: `typecheck`, `--check`, `qa` y `privacy` en limpio.** *Por qué:* la persona revisa el contenido, no los defectos que una máquina encuentra.
- [ ] **Se muestra una escena por vez y se espera la aprobación** antes de la siguiente; el guion se aprueba antes de construir nada.
  *Por qué:* un cambio de rumbo en el guion es barato; en la escena 5 ya no.
- [ ] **La música arranca donde entra la percusión** (`startFrom` salta lo que sobra del comienzo del archivo) **y los empalmes y repeticiones caen en el compás.**
  *Por qué:* un golpe fuera de tiempo se nota más que cualquier otro defecto de sonido.
- [ ] **Al final, el guion refleja lo producido.** *Por qué:* es la documentación del video y la base para los cambios futuros.
