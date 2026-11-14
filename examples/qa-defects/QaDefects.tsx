import type { CSSProperties, ReactNode } from 'react';
import { Fill, useFrame } from '../../engine';

/**
 * Test scene for the QA tools: every frame holds exactly ONE deliberately seeded defect (or none).
 * Frame 0 clean | 1 clipped label | 2 off-screen text | 3 overlapping text | 4 tiny text |
 * 5 low contrast | 6 covered text | 7 e-mail and real-looking domain. All names are invented.
 * Frames 8-11 are NON-defects that must stay free of errors: a full-frame wash over fading text (8), a card
 * flying over text (9-10, moving 60 px per frame), faint decorative text (11) and a label leaving the frame
 * while clearly moving (12-14, 60 px per frame).
 * Frames 15-17 are defects that the first version of the rules missed: static text at 50% opacity that looks washed out
 * once composited (15), a gradient strip over the LEFT 40% of a line with its centre free (16), and static text fully
 * hidden under a static card (17). All three are errors.
 * Frames 19-21 are a NON-defect: light text on an accent block under a scene wash (a full-frame veil) whose opacity changes frame to
 * frame (0.45, 0.55, 0.65): the contrast the rule measures is a transition, so it is `info`. Frames 22-24 hold the SAME veil still
 * at 0.55 over the same text: that contrast is what the viewer sees, so frame 23 (both neighbours identical) is a `contrast` error.
 * Frames 25-54 pair each LENIENCY with its STRICT counterpart (same situation, but static: still an error). 25-27 text fading in at
 * the slow tail of an easing (+0.01 per frame) vs 28-30 the same text held at 51% (error at 29, contrast); 31-33 dark text moving across a dark band
 * (20 px per frame) vs 34-36 the same text still (error at 35, contrast); 37-39 a text drifting 6 px per frame over another vs 40-42 the same two
 * texts still (error at 41, overlap); 43-45 an opaque pill drifting 6 px per frame over a text vs 46-48 still (error at 47, covered);
 * 49-51 a 5 px sliver past the right edge under a camera that moves (info at 50) vs 52-54 the same sliver with the camera still (error at 53, offscreen).
 * Frames 55-56 are for the privacy check with the deny term `mercado pago`: 55 has two DIFFERENT elements ("Supermercado" and "Pagó ...") that
 * only look like the term when their texts are glued (no match); 56 writes the term in ONE line with a span per word (a `deny-joined` match).
 * Frames 57-68 cover the false positives fixed in the QA rules, each next to its STRICT counterpart:
 * 57 + 59 the SAME text small in an overview (57, 8.8 px) and readable zoomed in (59, 26 px) within the scene: a "detalle que se lee al acercar" (info, not an error);
 * 61 a small text that is never shown at a readable size (error, `min-size`). 58, 60 and 62 are clean spacers so a neighbour never looks like motion.
 * 63 SVG text whose CSS `color` equals the card background but whose `fill` is dark (no finding: the glyphs are painted with `fill`); 64 the same with a pale `fill` over
 * a dark `color` (error, `contrast`); 65 stroke-only text (fill none, dark stroke): no finding.
 * 66 an `opacity: 0` canvas and a `visibility: hidden` block over a text (no finding); 67 a canvas under an ancestor with `opacity: 0` (no finding); 68 the same canvas visible (error, `covered`).
 * Frames 69-75 son la marca `data-qa-decor` (adorno de una interfaz recreada), cada caso junto a su contrapunto estricto: 69 un texto de 10 px y otro casi
 * sin contraste dentro de `data-qa-decor` (sin hallazgos; resumen info con la cuenta) vs 70 los mismos textos sin la marca (errores `min-size` y `contrast`);
 * 71 un rótulo de adorno cortado (error `clip`: la marca no lo exime); 72 un adorno que pisa un texto normal (error `overlap`); 73 un adorno que sale del cuadro (sin hallazgo)
 * vs 74 el mismo con `data-qa-decor="main"` (error `offscreen`); 75 un texto con `data-qa-ignore="contrast"` (sin hallazgo, pero cuenta en `summary.silenced`).
 * Frames 76-92 son la CEGUERA bajo una capa de cuadro completo marcada `data-qa-ignore="covered"` (lo que llevan `Vignette`, `Wash` y la capa de fondo del escenario): ninguna capa de
 * estas puede hacer que el control deje de mirar el texto de abajo. 76 + 77, 78 + 79 y 80 + 81 son tres pares IDENTICOS salvo por la viñeta (degradado de cuadro completo con el
 * centro transparente y `data-qa-ignore="covered"`): texto de bajo contraste (error `contrast`), dos rótulos que se pisan (error `overlap`) y un rótulo bajo una pastilla opaca
 * (error `covered`); el hallazgo tiene que ser el mismo con y sin viñeta. 82-84 la misma viñeta con la opacidad cambiando entre cuadros (0,6 / 0,7 / 0,8) sobre un texto quieto: no es un
 * velo que cruza, el error de `contrast` se mantiene en los tres. 85-87 un lavado liso marcado `covered` a medio fundido (0,45 / 0,55 / 0,65) sobre texto claro: `contrast` es `info`;
 * 88-90 el mismo lavado quieto (0,55): error en el 89. 91 un lavado liso, marcado y cerrado del todo sobre todo el cuadro: el texto de abajo NO se ve, no hay hallazgos (el resumen lo cuenta como
 * tapado); 92 el contrapunto: un degradado de cuadro completo con el centro transparente SIN marca sobre dos rótulos que se pisan: el error `overlap` se informa.
 * Frames 93-95 son `data-qa-fixed-scale` (reproduccion de una herramienta a tamanos fijos), SOLO con `--font-scale 1.25` (sin estres los tres estan limpios): 93 un rotulo que entra justo
 * en su caja dentro de la marca (sin hallazgo, el resumen cuenta el texto exento del estres); 94 el MISMO rotulo sin la marca (error `clip` con el estres); 95 la marca puesta en el escenario entero,
 * sin otro texto fuera de ella: la exencion se RECHAZA (aviso, `summary.fixedScale.refused`), el estres se aplica y el rotulo da `clip`.
 * Frame 18 builds a term and an e-mail out of one span per letter / per part: only the privacy check cares (block-level scan).
 */
export const QA_DEFECT_FRAMES = { clean: 0, clip: 1, offscreen: 2, overlap: 3, tiny: 4, contrast: 5, covered: 6, privacy: 7, wash: 8, flyingA: 9, flyingB: 10, faint: 11, leavingA: 12, leavingB: 13, leavingC: 14, stillFaint: 15, sideCover: 16, hiddenStatic: 17, split: 18, veilCrossA: 19, veilCrossB: 20, veilCrossC: 21, veilStaticA: 22, veilStaticB: 23, veilStaticC: 24, slowFadeA: 25, slowFadeB: 26, slowFadeC: 27, slowStaticA: 28, slowStaticB: 29, slowStaticC: 30, crossMoveA: 31, crossMoveB: 32, crossMoveC: 33, crossStillA: 34, crossStillB: 35, crossStillC: 36, overlapMoveA: 37, overlapMoveB: 38, overlapMoveC: 39, overlapStillA: 40, overlapStillB: 41, overlapStillC: 42, coverMoveA: 43, coverMoveB: 44, coverMoveC: 45, coverStillA: 46, coverStillB: 47, coverStillC: 48, camMoveA: 49, camMoveB: 50, camMoveC: 51, camStillA: 52, camStillB: 53, camStillC: 54, splitBlocks: 55, splitLine: 56, zoomOut: 57, zoomIn: 59, neverReadable: 61, svgFillDark: 63, svgFillPale: 64, svgStroke: 65, hiddenCovers: 66, inheritedHidden: 67, visibleCanvas: 68, decorOk: 69, decorStrict: 70, decorClip: 71, decorOverlap: 72, decorOffscreen: 73, decorMainOffscreen: 74, ignoreCounted: 75, vigContrastA: 76, vigContrastB: 77, vigOverlapA: 78, vigOverlapB: 79, vigCoveredA: 80, vigCoveredB: 81, vigFadeA: 82, vigFadeB: 83, vigFadeC: 84, washCrossA: 85, washCrossB: 86, washCrossC: 87, washStillA: 88, washStillB: 89, washStillC: 90, washClosed: 91, gradientOverlap: 92, fixedOk: 93, fixedStrict: 94, fixedWhole: 95 } as const;

const font: CSSProperties = { fontFamily: 'Arial, Helvetica, sans-serif', color: '#1b1f2a' };
const abs = (left: number, top: number, extra: CSSProperties = {}): CSSProperties => ({ position: 'absolute', left, top, margin: 0, whiteSpace: 'nowrap', ...font, ...extra });

/** Viñeta de cuadro completo como la del kit: degradado radial con el centro transparente y `data-qa-ignore="covered"` (no es una tapa). */
function Vignette({ opacity }: { opacity?: number }) {
  return (
    <div
      data-testid="vignette"
      data-qa-ignore="covered"
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity, background: 'radial-gradient(ellipse at center, transparent 45%, rgba(20,30,60,0.22) 100%)' }}
    />
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h1 data-testid="heading" style={abs(96, 64, { fontSize: 44, fontWeight: 700 })}>{children}</h1>;
}

function Card({ top = 200, children }: { top?: number; children?: ReactNode }) {
  return (
    <div style={{ position: 'absolute', left: 96, top, width: 640, height: 300, background: '#eef1f6', borderRadius: 16, border: '1px solid #c9d0dc' }}>
      {children}
    </div>
  );
}

export function QaDefects() {
  const f = useFrame();
  let body: ReactNode;
  switch (f) {
    case 1:
      body = (
        <Card>
          <div data-testid="clip-label" style={{ position: 'absolute', left: 32, top: 40, width: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 26, ...font }}>
            Presupuesto trimestral ampliado
          </div>
        </Card>
      );
      break;
    case 2:
      body = <p data-testid="offscreen-text" style={abs(1120, 300, { fontSize: 40, fontWeight: 600 })}>Facturación total</p>;
      break;
    case 3:
      body = (
        <>
          <p data-testid="overlap-a" style={abs(96, 220, { fontSize: 56, fontWeight: 700 })}>Ventas del mes</p>
          <p data-testid="overlap-b" style={abs(140, 245, { fontSize: 56, fontWeight: 700, color: '#2b4a8c' })}>Costos del mes</p>
        </>
      );
      break;
    case 4:
      body = <p data-testid="tiny-text" style={abs(96, 220, { fontSize: 10 })}>Nota al pie con letra diminuta</p>;
      break;
    case 5:
      body = (
        <div style={{ position: 'absolute', left: 96, top: 200, width: 640, height: 200, background: '#f2f2f2', borderRadius: 16 }}>
          <p data-testid="low-contrast" style={abs(32, 70, { fontSize: 36, color: '#d2d2d2' })}>Texto casi invisible</p>
        </div>
      );
      break;
    case 6:
      body = (
        <Card>
          <p data-testid="covered-text" style={abs(40, 120, { fontSize: 36, fontWeight: 600 })}>Total pendiente</p>
          <div data-testid="covering-pill" style={{ position: 'absolute', left: 80, top: 112, width: 190, height: 56, borderRadius: 28, background: '#d7dbe6' }} />
        </Card>
      );
      break;
    case 7:
      body = (
        <Card>
          <p data-testid="email-text" style={abs(40, 70, { fontSize: 28 })}>Escribinos a persona.ejemplo@dominio-ficticio.com</p>
          <p data-testid="domain-text" style={abs(40, 150, { fontSize: 28 })}>Mas en www.dominio-ficticio.com/ayuda</p>
          <p data-testid="safe-text" style={abs(40, 230, { fontSize: 28 })}>Contacto de ejemplo: ejemplo@example.com</p>
        </Card>
      );
      break;
    case 8:
      body = (
        <>
          <p data-testid="fading-text" style={abs(96, 250, { fontSize: 40, opacity: 0.15 })}>Texto en fundido</p>
          <div data-testid="scene-wash" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', background: '#ffffff', opacity: 0.95 }} />
        </>
      );
      break;
    case 9:
    case 10:
      body = (
        <>
          <p data-testid="under-flight" style={abs(96, 250, { fontSize: 40, fontWeight: 600 })}>Resumen trimestral</p>
          <div data-testid="flying-card" style={{ position: 'absolute', left: 60 + (f - 9) * 60 + 90, top: 236, width: 240, height: 80, borderRadius: 12, background: '#dfe6f5', boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }} />
        </>
      );
      break;
    case 11:
      body = <p data-testid="decorative-text" style={abs(96, 250, { fontSize: 48, fontWeight: 700, opacity: 0.25 })}>Marca decorativa</p>;
      break;
    case 12:
    case 13:
    case 14:
      body = <p data-testid="leaving-text" style={abs(1060 + (f - 12) * 60, 300, { fontSize: 40, fontWeight: 600 })}>Facturación total</p>;
      break;
    case 15:
      body = <p data-testid="still-faint" style={abs(96, 250, { fontSize: 40, fontWeight: 700, color: '#6b6b6b', opacity: 0.5 })}>Saldo disponible</p>;
      break;
    case 16:
      body = (
        <Card>
          <p data-testid="side-covered" style={abs(40, 120, { fontSize: 32, fontWeight: 600 })}>Detalle del presupuesto anual</p>
          <div data-testid="side-strip" style={{ position: 'absolute', left: 20, top: 100, width: 190, height: 72, borderRadius: 12, background: 'linear-gradient(90deg, #cfd6e6, #dfe4ef)' }} />
        </Card>
      );
      break;
    case 17:
      body = (
        <Card>
          <p data-testid="hidden-static" style={abs(40, 120, { fontSize: 32, fontWeight: 600 })}>Dato escondido</p>
          <div data-testid="hiding-card" style={{ position: 'absolute', left: 20, top: 100, width: 420, height: 72, borderRadius: 12, background: '#d7dbe6' }} />
        </Card>
      );
      break;
    case 18:
      body = (
        <Card>
          <p data-testid="split-term" style={abs(40, 70, { fontSize: 28 })}>
            {[...'Acme Corp'].map((ch, i) => <span key={i}>{ch}</span>)}
          </p>
          <p data-testid="split-email" style={abs(40, 150, { fontSize: 28 })}>
            <span>persona</span><span>@</span><span>dominio-ficticio</span><span>.com</span>
          </p>
        </Card>
      );
      break;
    case 19:
    case 20:
    case 21:
    case 22:
    case 23:
    case 24: {
      const veil = f <= 21 ? 0.45 + (f - 19) * 0.1 : 0.55;
      body = (
        <>
          <div style={{ position: 'absolute', left: 96, top: 200, width: 640, height: 200, background: '#2b4a8c', borderRadius: 16 }}>
            <p data-testid="veil-text" style={abs(32, 70, { fontSize: 36, fontWeight: 700, color: '#ffffff' })}>Texto claro sobre acento</p>
          </div>
          <div data-testid="veil" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', background: '#ffffff', opacity: veil }} />
        </>
      );
      break;
    }
    case 25:
    case 26:
    case 27:
    case 28:
    case 29:
    case 30: {
      // lento al final de un easing: sube 0.01 por cuadro (25-27); el mismo texto quieto al 51 % (28-30)
      const op = f <= 27 ? 0.5 + (f - 25) * 0.01 : 0.51;
      body = <p data-testid="slow-fade" style={abs(96, 250, { fontSize: 40, fontWeight: 700, color: '#6b6b6b', opacity: op })}>Saldo disponible</p>;
      break;
    }
    case 31:
    case 32:
    case 33:
    case 34:
    case 35:
    case 36: {
      // texto oscuro sobre una banda oscura: se cruza en movimiento (31-33) o queda quieto (34-36)
      const x = f <= 33 ? 40 + (f - 31) * 20 : 80;
      body = (
        <div style={{ position: 'absolute', left: 96, top: 200, width: 1000, height: 160, background: '#2b3350', borderRadius: 16 }}>
          <p data-testid="cross-text" style={abs(x, 50, { fontSize: 40, fontWeight: 700 })}>Cena en la plaza</p>
        </div>
      );
      break;
    }
    case 37:
    case 38:
    case 39:
    case 40:
    case 41:
    case 42: {
      const x = f <= 39 ? 140 + (f - 37) * 6 : 140;
      body = (
        <>
          <p data-testid="drift-a" style={abs(96, 220, { fontSize: 56, fontWeight: 700 })}>Ventas del mes</p>
          <p data-testid="drift-b" style={abs(x, 245, { fontSize: 56, fontWeight: 700, color: '#2b4a8c' })}>Costos del mes</p>
        </>
      );
      break;
    }
    case 43:
    case 44:
    case 45:
    case 46:
    case 47:
    case 48: {
      const x = f <= 45 ? 80 + (f - 43) * 6 : 80;
      body = (
        <Card>
          <p data-testid="slow-covered" style={abs(40, 120, { fontSize: 36, fontWeight: 600 })}>Total pendiente</p>
          <div data-testid="slow-pill" style={{ position: 'absolute', left: x - 60, top: 112, width: 190, height: 56, borderRadius: 28, background: '#d7dbe6' }} />
        </Card>
      );
      break;
    }
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54: {
      // un contenedor con zoom 1.05: el texto sobresale ~5 px por la derecha; la camara se mueve 3 px por cuadro (49-51) o esta quieta (52-54)
      const dx = f <= 51 ? (f - 50) * 3 : 0;
      body = (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '0 0', transform: `translateX(${dx}px) scale(1.05)` }}>
          <p data-testid="sliver-text" style={{ position: 'absolute', right: 56, top: 300, margin: 0, whiteSpace: 'nowrap', fontSize: 40, fontWeight: 600, ...font }}>Facturación total</p>
        </div>
      );
      break;
    }
    case 55:
      body = (
        <Card>
          <p data-testid="blocks-a" style={abs(40, 70, { fontSize: 28 })}>Supermercado</p>
          <p data-testid="blocks-b" style={abs(40, 150, { fontSize: 28 })}>Pagó 1.200 con tarjeta</p>
        </Card>
      );
      break;
    case 56:
      body = (
        <Card>
          <p data-testid="line-spans" style={abs(40, 70, { fontSize: 28 })}>
            Cuenta <span>Mercado</span> <span>Pago</span> activa
          </p>
        </Card>
      );
      break;
    case 57:
    case 59: {
      // el mismo texto (mismo elemento) visto en el plano general (chico) y acercado (legible); entre medio, un cuadro limpio
      const k = f === 57 ? 0.4 : 1.2;
      body = (
        <div style={{ position: 'absolute', left: 96, top: 160, transformOrigin: '0 0', transform: `scale(${k})` }}>
          <p data-testid="board-detail" style={abs(0, 0, { fontSize: 22 })}>Detalle del tablero</p>
        </div>
      );
      break;
    }
    case 61:
      body = (
        <div style={{ position: 'absolute', left: 96, top: 160, transformOrigin: '0 0', transform: 'scale(0.4)' }}>
          <p data-testid="never-readable" style={abs(0, 0, { fontSize: 22 })}>Nota que nunca se acerca</p>
        </div>
      );
      break;
    case 63:
    case 64:
    case 65: {
      // texto SVG dentro de un anillo: lo que lo pinta es `fill` (o `stroke`), no el `color` CSS de los ancestros
      const [testid, fill, stroke] = f === 63 ? ['donut-centre', '#1b1f2a', 'none'] : f === 64 ? ['donut-faint', '#d2d2d2', 'none'] : ['donut-outline', 'none', '#1b1f2a'];
      body = (
        <Card>
          <div style={{ color: f === 64 ? '#1b1f2a' : '#eef1f6', position: 'absolute', left: 40, top: 30 }}>
            <svg width={240} height={240} viewBox="0 0 120 120">
              <circle cx={60} cy={60} r={50} fill="none" stroke="#c9d0dc" strokeWidth={12} />
              <text data-testid={testid} x={60} y={68} textAnchor="middle" fontSize={26} fontWeight={700} fontFamily="Arial, Helvetica, sans-serif" fill={fill} stroke={stroke} strokeWidth={stroke === 'none' ? 0 : 0.8}>72%</text>
            </svg>
          </div>
        </Card>
      );
      break;
    }
    case 66:
      body = (
        <Card>
          <p data-testid="under-invisible" style={abs(40, 120, { fontSize: 36, fontWeight: 600 })}>Total pendiente</p>
          <canvas data-testid="invisible-canvas" width={300} height={72} style={{ position: 'absolute', left: 20, top: 100, width: 300, height: 72, opacity: 0 }} />
          <div data-testid="hidden-block" style={{ position: 'absolute', left: 20, top: 100, width: 300, height: 72, background: '#d7dbe6', visibility: 'hidden' }} />
        </Card>
      );
      break;
    case 67:
      body = (
        <Card>
          <p data-testid="under-inherited" style={abs(40, 120, { fontSize: 36, fontWeight: 600 })}>Total pendiente</p>
          <div style={{ opacity: 0 }}>
            <canvas data-testid="inherited-canvas" width={300} height={72} style={{ position: 'absolute', left: 20, top: 100, width: 300, height: 72 }} />
          </div>
        </Card>
      );
      break;
    case 68:
      body = (
        <Card>
          <p data-testid="under-visible" style={abs(40, 120, { fontSize: 36, fontWeight: 600 })}>Total pendiente</p>
          <canvas data-testid="visible-canvas" width={300} height={72} style={{ position: 'absolute', left: 20, top: 100, width: 300, height: 72 }} />
        </Card>
      );
      break;
    case 69:
    case 70: {
      const marca = f === 69 ? { 'data-qa-decor': '' } : {};
      body = (
        <Card>
          <div {...marca}>
            <p data-testid="chrome-tiny" style={abs(40, 60, { fontSize: 10 })}>Menu lateral ficticio</p>
            <p data-testid="chrome-faint" style={abs(40, 120, { fontSize: 30, color: '#d2d2d2' })}>Ayuda</p>
          </div>
        </Card>
      );
      break;
    }
    case 71:
      body = (
        <Card>
          <div data-qa-decor="">
            <div data-testid="chrome-clip" style={{ position: 'absolute', left: 32, top: 40, width: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 26, ...font }}>
              Filtros guardados ampliados
            </div>
          </div>
        </Card>
      );
      break;
    case 72:
      body = (
        <>
          <p data-testid="normal-text" style={abs(96, 220, { fontSize: 56, fontWeight: 700 })}>Resumen semanal</p>
          <div data-qa-decor="">
            <p data-testid="chrome-over" style={abs(140, 245, { fontSize: 56, fontWeight: 700, color: '#2b4a8c' })}>Panel lateral</p>
          </div>
        </>
      );
      break;
    case 73:
    case 74:
      body = (
        <div data-qa-decor={f === 74 ? 'main' : ''}>
          <p data-testid="chrome-offscreen" style={abs(1120, 300, { fontSize: 40, fontWeight: 600 })}>Barra de herramientas</p>
        </div>
      );
      break;
    case 75:
      body = (
        <Card>
          {/* contraste bajo a propósito: es un rótulo de acompañamiento que repite el color de estado (decisión de diseño) */}
          <p data-testid="ignored-contrast" data-qa-ignore="contrast" style={abs(40, 100, { fontSize: 36, color: '#d2d2d2' })}>Estado en gris</p>
        </Card>
      );
      break;
    case 76:
    case 77:
      // contraste bajo, con (77) y sin (76) viñeta: el texto esta en la zona transparente de la viñeta, asi que el hallazgo (y la razon medida) son los mismos
      body = (
        <>
          <div style={{ position: 'absolute', left: 400, top: 240, width: 480, height: 200, background: '#f2f2f2', borderRadius: 16 }}>
            <p data-testid="vig-low" style={abs(32, 70, { fontSize: 36, color: '#d2d2d2' })}>Texto casi invisible</p>
          </div>
          {f === 77 && <Vignette />}
        </>
      );
      break;
    case 78:
    case 79:
      body = (
        <>
          <p data-testid="vig-a" style={abs(400, 260, { fontSize: 48, fontWeight: 700 })}>Ventas del mes</p>
          <p data-testid="vig-b" style={abs(440, 285, { fontSize: 48, fontWeight: 700, color: '#2b4a8c' })}>Costos del mes</p>
          {f === 79 && <Vignette />}
        </>
      );
      break;
    case 80:
    case 81:
      body = (
        <>
          <p data-testid="vig-covered" style={abs(400, 300, { fontSize: 36, fontWeight: 600 })}>Total pendiente</p>
          <div data-testid="vig-pill" style={{ position: 'absolute', left: 430, top: 292, width: 190, height: 56, borderRadius: 28, background: '#d7dbe6' }} />
          {f === 81 && <Vignette />}
        </>
      );
      break;
    case 82:
    case 83:
    case 84:
      // la viñeta cambia de opacidad entre cuadros (0,6 / 0,7 / 0,8) y el texto de abajo esta quieto: no es un velo que cruza, el error se mantiene
      body = (
        <>
          <div style={{ position: 'absolute', left: 400, top: 240, width: 480, height: 200, background: '#f2f2f2', borderRadius: 16 }}>
            <p data-testid="vig-fade-text" style={abs(32, 70, { fontSize: 36, color: '#d2d2d2' })}>Texto casi invisible</p>
          </div>
          <Vignette opacity={0.6 + (f - 82) * 0.1} />
        </>
      );
      break;
    case 85:
    case 86:
    case 87:
    case 88:
    case 89:
    case 90: {
      // como 19-24 pero con el lavado MARCADO `data-qa-ignore="covered"` (el `Wash` del kit): cruza (info en el 86) o queda quieto (error en el 89)
      const veil = f <= 87 ? 0.45 + (f - 85) * 0.1 : 0.55;
      body = (
        <>
          <div style={{ position: 'absolute', left: 96, top: 200, width: 640, height: 200, background: '#2b4a8c', borderRadius: 16 }}>
            <p data-testid="wash-text" style={abs(32, 70, { fontSize: 36, fontWeight: 700, color: '#ffffff' })}>Texto claro sobre acento</p>
          </div>
          <div data-testid="marked-wash" data-qa-veil={veil.toFixed(3)} data-qa-ignore="covered" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', background: '#ffffff', opacity: veil }} />
        </>
      );
      break;
    }
    case 91:
      // lavado liso, marcado y cerrado del todo: lo de abajo no se ve (nada que juzgar), y el resumen lo cuenta
      body = (
        <>
          <p data-testid="closed-a" style={abs(400, 260, { fontSize: 48, fontWeight: 700 })}>Ventas del mes</p>
          <p data-testid="closed-b" style={abs(440, 285, { fontSize: 48, fontWeight: 700, color: '#2b4a8c' })}>Costos del mes</p>
          <p data-testid="closed-low" style={abs(400, 420, { fontSize: 36, color: '#d2d2d2' })}>Texto casi invisible</p>
          <div data-testid="closed-wash" data-qa-ignore="covered" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', background: '#ffffff' }} />
        </>
      );
      break;
    case 92:
      // contrapunto: degradado de cuadro completo con el centro transparente SIN marca; no tapa nada, los rotulos que se pisan se informan
      body = (
        <>
          <p data-testid="grad-a" style={abs(400, 260, { fontSize: 48, fontWeight: 700 })}>Ventas del mes</p>
          <p data-testid="grad-b" style={abs(440, 285, { fontSize: 48, fontWeight: 700, color: '#2b4a8c' })}>Costos del mes</p>
          <div data-testid="plain-gradient" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 45%, rgba(20,30,60,0.22) 100%)' }} />
        </>
      );
      break;
    case 93:
    case 94:
    case 95: {
      // el rotulo de 20 px entra justo en 215 px; con letra x1.25 se corta
      const marca = f === 94 ? {} : { 'data-qa-fixed-scale': '' };
      const tool = (
        <div data-testid="fixed-label" style={{ position: 'absolute', left: f === 95 ? 128 : 32, top: f === 95 ? 240 : 40, width: 215, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 20, ...font }}>
          Presupuesto trimestral
        </div>
      );
      if (f === 95) {
        return (
          <Fill style={{ background: '#eef1f6' }}>
            <div {...marca} style={{ position: 'absolute', inset: 0 }}>{tool}</div>
          </Fill>
        );
      }
      body = (
        <Card>
          <div {...marca}>{tool}</div>
        </Card>
      );
      break;
    }
    default:
      body = (
        <Card>
          <p data-testid="clean-label" style={abs(40, 50, { fontSize: 32, fontWeight: 600 })}>Tareas completadas</p>
          <p data-testid="clean-value" style={abs(40, 110, { fontSize: 72, fontWeight: 700 })}>128</p>
          <p data-testid="clean-note" style={abs(40, 220, { fontSize: 24, color: '#4a5263' })}>Datos ficticios del periodo</p>
        </Card>
      );
  }
  return (
    <Fill style={{ background: '#ffffff' }}>
      <Heading>Informe de ejemplo</Heading>
      {body}
    </Fill>
  );
}
