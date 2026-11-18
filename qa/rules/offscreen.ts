import { describe, hiddenFraction, ignored, intersect, isHuge, protrusion, visibleLine } from '../geometry';
import type { Finding, Rule } from '../types';
import { isWorldText, worldZoomed } from '../world';

/**
 * Text partly outside the frame. The decision, spelled out in every message:
 *  - info:  the text is moving between neighbouring frames (camera pan/zoom or a flying card): it is on its way in or out.
 *  - info:  a sliver (<= `sliverPx`) under a camera/zoom that is moving (the text shifts more than `cameraPx` between neighbouring
 *           frames): the framing settles by itself. The same sliver with a still camera stays an error.
 *  - error: not under a camera/zoom (it spills over the frame edge), or a small sliver (<= `slipPct` %) under a camera, or it
 *           APPEARS/fades while cropped (the camera is still: the viewer sees text pop in already cut).
 *  - warn:  under a camera/zoom, still and steady, cropped more than `slipPct` %: framing (the camera holds on a part of a larger layout).
 * Fully outside, huge or nearly transparent text is exempt.
 * Interfaz recreada bajo una cámara (`data-qa-world`, ver `qa/world.ts`): con el mundo ACERCADO, el texto de la interfaz que el borde del cuadro corta baja a `info` (es el encuadre).
 * El objetivo de la señal activa (`data-qa-target`) nunca se exceptúa: cortado es error, salvo mientras la cámara todavía viaja hacia él (se mueve y el mundo no está asentado).
 */
const FADING = 0.02;

export const offscreenRule: Rule = {
  id: 'offscreen',
  description: 'Texto visible que se sale parcialmente del cuadro',
  check({ frame, width, height, runs, thresholds }) {
    const t = thresholds.offscreen;
    const box = { x: 0, y: 0, w: width, h: height };
    const out: Finding[] = [];
    const seen = new Set<number>();
    for (const r of runs) {
      if (r.opacity < t.minOpacity || ignored(r, 'offscreen') || (r.decor && !r.decorMain) || seen.has(r.elId) || isHuge(r.rect, width, height, t.maxFrames)) continue;
      for (const full of r.lines) {
        const line = visibleLine(full, r.clips, width, height); // la parte que recorta un ancestro con overflow oculto no se dibuja
        if (!line) continue;
        if (!intersect(line, box)) continue; // fully outside: leaving on purpose
        const px = protrusion(line, box);
        if (px <= t.tolerancePx) continue;
        seen.add(r.elId);
        const pct = Math.round(hiddenFraction(line, box) * 100);
        const moving = (r.motion ?? 0) > thresholds.motion.px;
        const fading = (r.fade ?? 0) > FADING;
        const big = pct > t.slipPct;
        let severity: Finding['severity'];
        let why: string;
        if (isWorldText(r) && worldZoomed(r)) {
          severity = 'info';
          why = `info porque el mundo (data-qa-world) esta acercado (x${r.world!.zoom.toFixed(2)}) y el borde del cuadro corta la interfaz a proposito; se juzga lo que queda entero dentro del encuadre`;
        } else if (r.target && (!moving || r.world?.settled)) {
          severity = 'error';
          why = `error porque es el objetivo de la señal activa (data-qa-target) y el borde del cuadro lo corta${r.world?.settled ? ' con la camara ya asentada' : ''}: el objetivo nunca se exceptua. Arreglo: centrar el objetivo o acercar menos`;
        } else if (moving) {
          severity = 'info';
          why = 'info porque el texto se mueve entre cuadros (camara o transicion): entra o sale del cuadro';
        } else if (r.transformed && px <= t.sliverPx && (r.motion ?? 0) > t.cameraPx) {
          severity = 'info';
          why = `info porque es una rebaba de ${Math.round(px)}px (<= ${t.sliverPx}px) y la camara se mueve (el texto se desplaza ${(r.motion ?? 0).toFixed(1)}px entre cuadros): el encuadre se acomoda solo. Con la camara quieta seria un error`;
        } else if (!r.transformed) {
          severity = 'error';
          why = 'error porque no hay camara/zoom que lo explique: el texto desborda el borde del cuadro. Arreglo: moverlo adentro (o achicarlo o acortarlo)';
        } else if (!big) {
          severity = 'error';
          why = `error porque, aun bajo zoom, solo se recorta ${pct}% (<= ${t.slipPct}%): es una rebaba de encuadre, no un paneo. Arreglo: correr el texto unos px hacia adentro o ajustar la camara`;
        } else if (fading) {
          severity = 'error';
          why = `error porque la camara esta quieta en este cuadro y el texto aparece (fundido) ya recortado ${pct}%: la persona lo ve entrar cortado. Arreglo: moverlo dentro del cuadro, o hacerlo aparecer despues, cuando la camara ya se alejo`;
        } else {
          severity = 'warn';
          why = `aviso porque, bajo zoom, esta quieto y estable y recortado ${pct}% (> ${t.slipPct}%): parece un encuadre a proposito. Si no lo es, moverlo adentro; si lo es, data-qa-ignore="offscreen"`;
        }
        out.push({
          rule: 'offscreen', severity, frame,
          message: `texto parcialmente fuera del cuadro (${pct}% de una linea, sobresale ${Math.round(px)}px); ${why}`,
          element: describe(r), data: { hiddenPct: pct, protrusionPx: Math.round(px) },
        });
        break;
      }
    }
    return out;
  },
};
