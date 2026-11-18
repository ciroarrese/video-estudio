import type { CSSProperties, ReactNode } from 'react';
import { Fill, useFrame } from '../../engine';

/**
 * Escena de prueba de las marcas de interfaz recreada bajo una cámara (`data-qa-world`, `data-qa-overlay`, `data-qa-target`, `data-qa-settled`; ver qa/world.ts y qa/salto.ts).
 * Cada caso ocupa TRES cuadros (A, B, C; el caso c va de 3c a 3c+2) y el control se mira en el B (3c+1): los vecinos son del mismo caso, así el movimiento entre cuadros es el del caso.
 * Salvo los casos de `salto`, los tres cuadros son idénticos. Todos los nombres son inventados.
 *
 *  0 zoomCut          mundo acercado x2: una etiqueta que el borde corta (info `offscreen`) junto a otra entera (nada).
 *  1 zoomOne          el mismo corte con el mundo a escala 1 (plano general): error `offscreen` (la excepción es solo del mundo acercado).
 *  2 targetCut        el objetivo asentado cortado por el borde con el mundo acercado: error `offscreen` (el objetivo nunca se exceptúa).
 *  3 coveredCut       etiqueta cortada por el borde y además tapada por una tarjeta del mundo: `covered` baja a info (deriva del corte).
 *  4 coveredWhole     la misma tarjeta sobre una etiqueta entera: error `covered`.
 *  5 targetCovered    una tarjeta del mundo sobre el objetivo asentado: error `covered`.
 *  6 overlayOverWorld una capa fija (`data-qa-overlay`) opaca sobre texto del mundo: nada.
 *  7 overlayOverTarget la misma capa sobre el objetivo: error `covered`.
 *  8 overlayClip      el texto propio de una capa, cortado: error `clip` (el texto de la capa se juzga con todas las reglas).
 *  9 overlayContrast  texto del mundo de bajo contraste bajo una capa translúcida: `contrast` baja a info.
 * 10 contrastNoMark   el mismo texto con la capa sin marcar: error `contrast`.
 * 11 chicoOther       texto chico del mundo que no es el objetivo, con la cámara asentada: nada (`texto-chico` solo juzga el objetivo).
 * 12 chicoTarget      el mismo texto como objetivo asentado: aviso `texto-chico`.
 * 13 chicoUnsettled   el objetivo chico con la cámara viajando (sin `data-qa-settled`): nada.
 * 14 saltoJump        una etiqueta del mundo que se corre 100 px de golpe (0, +100, +100): aviso `salto`.
 * 15 saltoContinuous  la misma etiqueta que avanza 50 px por cuadro (continuo): nada.
 * 16 saltoCamera      todo el mundo viaja 60 px por cuadro con sus textos: nada (lo explica la cámara).
 * 17 saltoEntry       la etiqueta entra con un fundido (la opacidad sube) mientras se corre: nada (una entrada no es un salto).
 * 18 sideFlip         una capa fija que pasa de la derecha a la izquierda de su objetivo en un cuadro: aviso `salto` (cambio de lado).
 * 19 overlayGlued     la capa fija sigue al objetivo mientras la cámara viaja 40 px por cuadro: nada.
 * 20 overlayJump      la capa fija se corre 60 px respecto del objetivo en un cuadro, sin cambiar de lado: aviso `salto`.
 * 21 focoCenter       objetivo asentado en el centro: nada.   22 foco70  centro a 70 % del eje: aviso `foco-centro`.   23 foco95  a 95 %: error.
 * 24 focoTraveling    el mismo objetivo del foco70 pero sin `data-qa-settled`: nada.   25 focoOutside  objetivo fuera del cuadro: error.
 * 26 sinObjetivo     un mundo sin objetivo ni asentado (como el `World` de un video que no es tutorial) con un salto y un texto chico: corrido SOLO (la corrida no es de tutorial)
 *                    `salto` no juzga y `texto-chico` avisa como siempre; corrido junto con los demás casos (la corrida sí es de tutorial) el texto del mundo no se juzga.
 * Los casos 14 a 17 llevan un objetivo vacío fuera del texto (`Ancla`): la corrida de uno solo de ellos cuenta como tutorial.
 */
export const QA_MUNDO = {
  zoomCut: 1, zoomOne: 4, targetCut: 7, coveredCut: 10, coveredWhole: 13, targetCovered: 16, overlayOverWorld: 19, overlayOverTarget: 22, overlayClip: 25, overlayContrast: 28, contrastNoMark: 31,
  chicoOther: 34, chicoTarget: 37, chicoUnsettled: 40, saltoJump: 43, saltoContinuous: 46, saltoCamera: 49, saltoEntry: 52, sideFlip: 55, overlayGlued: 58, overlayJump: 61,
  focoCenter: 64, foco70: 67, foco95: 70, focoTraveling: 73, focoOutside: 76, sinObjetivo: 79,
} as const;

const font: CSSProperties = { fontFamily: 'Arial, Helvetica, sans-serif', color: '#1b1f2a' };
const abs = (left: number, top: number, extra: CSSProperties = {}): CSSProperties => ({ position: 'absolute', left, top, margin: 0, whiteSpace: 'nowrap', ...font, ...extra });

type Cam = { s: number; tx: number; ty: number };

/** El mundo: lo que la cámara transforma (escala y traslado desde la esquina). `settled`: la cámara está asentada sobre una señal. */
function World({ cam, settled, children }: { cam: Cam; settled?: boolean; children: ReactNode }) {
  return (
    <div
      data-testid="mundo"
      data-qa-world=""
      {...(settled ? { 'data-qa-settled': '' } : {})}
      style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`, background: '#ffffff' }}
    >
      {children}
    </div>
  );
}

const Label = ({ x, y, text, id, size = 28, style }: { x: number; y: number; text: string; id: string; size?: number; style?: CSSProperties }) => (
  <p data-testid={id} style={abs(x, y, { fontSize: size, fontWeight: 600, ...style })}>{text}</p>
);

/** Capa fija en espacio de pantalla: una etiqueta con fondo. */
const Overlay = ({ left, top, text = 'Revisá este dato', w = 260, extra }: { left: number; top: number; text?: string; w?: number; extra?: CSSProperties }) => (
  <div data-testid="etiqueta" data-qa-overlay="" style={{ position: 'absolute', left, top, width: w, height: 56, borderRadius: 12, background: '#e3ebff', border: '1px solid #9db3e8', ...extra }}>
    <p style={abs(14, 14, { fontSize: 22, fontWeight: 600 })}>{text}</p>
  </div>
);

const Target = ({ children, x, y, w, h }: { children?: ReactNode; x: number; y: number; w: number; h: number }) => (
  <div data-testid="objetivo" data-qa-target="" style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>{children}</div>
);

/** Objetivo vacío y fuera de todo texto: hace que la corrida cuente como tutorial (hay un `data-qa-target`) sin cambiar lo que mide el caso. */
const Ancla = () => <Target x={1200} y={680} w={40} h={20} />;

export function QaMundo() {
  const f = useFrame();
  const c = Math.floor(f / 3);
  const ph = f % 3; // A, B, C
  const zoom: Cam = { s: 2, tx: -300, ty: -100 };
  const flat: Cam = { s: 1, tx: 0, ty: 0 };
  let body: ReactNode;
  switch (c) {
    case 0: // etiqueta cortada por el borde con el mundo acercado + una entera
      body = (<World cam={zoom}><Label id="corte" x={720} y={200} text="Saldo de la cuenta" /><Label id="entera" x={400} y={200} text="Resumen" /></World>);
      break;
    case 1: // el mismo corte a escala 1: es un desborde
      body = (<World cam={flat}><Label id="corte" x={1100} y={300} text="Saldo de la cuenta" /><Label id="entera" x={200} y={300} text="Resumen" /></World>);
      break;
    case 2: // el objetivo asentado, cortado
      body = (<World cam={zoom} settled><Target x={720} y={200} w={260} h={40}><Label id="corte" x={0} y={0} text="Saldo de la cuenta" /></Target><Label id="entera" x={400} y={200} text="Resumen" /></World>);
      break;
    case 3: // cortada y además tapada por una tarjeta del mundo
      body = (<World cam={zoom}><Label id="corte" x={720} y={200} text="Saldo de la cuenta" /><div data-testid="tarjeta" style={{ position: 'absolute', left: 700, top: 180, width: 300, height: 60, background: '#d7dbe6' }} /></World>);
      break;
    case 4: // entera y tapada
      body = (<World cam={zoom}><Label id="entera" x={400} y={200} text="Resumen" /><div data-testid="tarjeta" style={{ position: 'absolute', left: 380, top: 180, width: 140, height: 60, background: '#d7dbe6' }} /></World>);
      break;
    case 5: // el objetivo tapado
      body = (<World cam={zoom} settled><Target x={400} y={200} w={140} h={40}><Label id="resumen" x={0} y={0} text="Resumen" /></Target><div data-testid="tarjeta" style={{ position: 'absolute', left: 380, top: 180, width: 140, height: 60, background: '#d7dbe6' }} /></World>);
      break;
    case 6: // capa fija sobre texto del mundo
      body = (<><World cam={flat}><Label id="saldo" x={200} y={300} text="Saldo disponible" /></World><Overlay left={180} top={290} w={320} text="Etiqueta" extra={{ textAlign: 'right' }} /></>);
      break;
    case 7: // la misma capa sobre el objetivo
      body = (<><World cam={flat} settled><Target x={200} y={300} w={260} h={40}><Label id="saldo" x={0} y={0} text="Saldo disponible" /></Target></World><Overlay left={180} top={290} w={320} text="Etiqueta" /></>);
      break;
    case 8: // texto propio de la capa, cortado
      body = (<><World cam={flat}><Label id="saldo" x={200} y={400} text="Saldo disponible" /></World><Overlay left={500} top={150} w={150} text="Revisá este dato con atención" extra={{ overflow: 'hidden' }} /></>);
      break;
    case 9: // texto del mundo de bajo contraste bajo una capa translúcida
    case 10: // el mismo texto, con la capa sin marcar
      body = (
        <>
          <World cam={flat}><Label id="tenue" x={200} y={300} text="Texto casi invisible" style={{ color: '#d6d6d6' }} /></World>
          <div data-testid="velo-panel" {...(c === 9 ? { 'data-qa-overlay': '' } : {})} style={{ position: 'absolute', left: 150, top: 280, width: 420, height: 90, background: 'rgba(255,255,255,0.15)' }} />
        </>
      );
      break;
    case 11: // texto chico del mundo que no es el objetivo
      body = (<World cam={flat} settled><Label id="chico" x={200} y={300} text="Nota al pie de la tabla" size={12} /></World>);
      break;
    case 12: // el mismo texto como objetivo asentado
      body = (<World cam={flat} settled><Target x={200} y={300} w={220} h={20}><Label id="chico" x={0} y={0} text="Nota al pie de la tabla" size={12} /></Target></World>);
      break;
    case 13: // objetivo chico con la cámara viajando
      body = (<World cam={flat}><Target x={200} y={300} w={220} h={20}><Label id="chico" x={0} y={0} text="Nota al pie de la tabla" size={12} /></Target></World>);
      break;
    case 14: // salto: 0, +100, +100
      body = (<World cam={flat}><Label id="etiqueta-mundo" x={[100, 200, 200][ph]!} y={300} text="Total del período" /><Ancla /></World>);
      break;
    case 15: // continuo: +50 por cuadro
      body = (<World cam={flat}><Label id="etiqueta-mundo" x={100 + ph * 50} y={300} text="Total del período" /><Ancla /></World>);
      break;
    case 16: // la cámara viaja con todo el mundo
      body = (<World cam={{ s: 1, tx: -60 * ph, ty: 0 }}><Label id="etiqueta-mundo" x={400} y={300} text="Total del período" /><Ancla /></World>);
      break;
    case 17: // entrada con fundido
      body = (<World cam={flat}><Label id="etiqueta-mundo" x={[100, 200, 200][ph]!} y={300} text="Total del período" style={{ opacity: [0.2, 0.6, 1][ph] }} /><Ancla /></World>);
      break;
    case 18: // capa fija: de la derecha a la izquierda del objetivo
      body = (<><World cam={flat}><Target x={500} y={300} w={200} h={40}><Label id="meta" x={0} y={0} text="Importe" /></Target></World><Overlay left={ph === 0 ? 730 : 240} top={292} w={220} text="Revisá este dato" /></>);
      break;
    case 19: // capa fija pegada al objetivo mientras la cámara viaja
      body = (<><World cam={{ s: 1, tx: -40 * ph, ty: 0 }}><Target x={500} y={300} w={200} h={40}><Label id="meta" x={0} y={0} text="Importe" /></Target></World><Overlay left={730 - 40 * ph} top={292} w={220} text="Revisá este dato" /></>);
      break;
    case 20: // capa fija: se corre 60 px respecto del objetivo, del mismo lado
      body = (<><World cam={flat}><Target x={500} y={300} w={200} h={40}><Label id="meta" x={0} y={0} text="Importe" /></Target></World><Overlay left={[730, 790, 790][ph]!} top={292} w={220} text="Revisá este dato" /></>);
      break;
    case 21: // foco centrado
      body = (<World cam={flat} settled><Target x={610} y={340} w={60} h={40}><Label id="meta" x={0} y={0} text="Ok" /></Target></World>);
      break;
    case 22: // centro a 70 % del eje
      body = (<World cam={flat} settled><Target x={1058} y={340} w={60} h={40}><Label id="meta" x={0} y={0} text="Ok" /></Target></World>);
      break;
    case 23: // centro a 95 %
      body = (<World cam={flat} settled><Target x={1218} y={340} w={60} h={40}><Label id="meta" x={0} y={0} text="Ok" /></Target></World>);
      break;
    case 24: // esquina, sin asentar
      body = (<World cam={flat}><Target x={1058} y={340} w={60} h={40}><Label id="meta" x={0} y={0} text="Ok" /></Target></World>);
      break;
    case 25: // fuera del cuadro
      body = (<World cam={flat} settled><Target x={1400} y={340} w={60} h={40}><Label id="meta" x={0} y={0} text="Ok" /></Target></World>);
      break;
    default: // mundo SIN objetivo ni asentado (como el `World` de un video que no es tutorial): sin la bandera de tutorial
      body = (<World cam={flat}><Label id="etiqueta-mundo" x={[100, 200, 200][ph]!} y={300} text="Total del período" /><Label id="chico" x={200} y={500} text="Nota al pie de la tabla" size={12.5} /></World>);
  }
  return <Fill style={{ background: '#ffffff' }}>{body}</Fill>;
}
