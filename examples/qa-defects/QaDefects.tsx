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
 * Frame 18 builds a term and an e-mail out of one span per letter / per part: only the privacy check cares (block-level scan).
 */
export const QA_DEFECT_FRAMES = { clean: 0, clip: 1, offscreen: 2, overlap: 3, tiny: 4, contrast: 5, covered: 6, privacy: 7, wash: 8, flyingA: 9, flyingB: 10, faint: 11, leavingA: 12, leavingB: 13, leavingC: 14, stillFaint: 15, sideCover: 16, hiddenStatic: 17, split: 18, veilCrossA: 19, veilCrossB: 20, veilCrossC: 21, veilStaticA: 22, veilStaticB: 23, veilStaticC: 24 } as const;

const font: CSSProperties = { fontFamily: 'Arial, Helvetica, sans-serif', color: '#1b1f2a' };
const abs = (left: number, top: number, extra: CSSProperties = {}): CSSProperties => ({ position: 'absolute', left, top, margin: 0, whiteSpace: 'nowrap', ...font, ...extra });

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
