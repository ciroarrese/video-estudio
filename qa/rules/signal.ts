import type { Finding, Rule } from '../types';

/**
 * La señal de la escena contra la del design system. No mira texto: mira las piezas que señalan algo (`data-ve-signal`, kit/signal.ts).
 * - aviso: un garabato de flecha o círculo (`DoodleArrow`, `DoodleCircle`) o `MarkerDraw` (trazo a mano) bajo un tema cuya señal resuelta no es
 *   `hand`: es una señal "por costumbre" que ese design system no usaría (usá `Callout`, que dibuja la del tema).
 * - info: un `Callout` con `variant` forzada distinta de la del tema (la excepción tiene que llevar su comentario en la escena).
 * Los garabatos que el tema apaga (`decor.doodles: false`) no se dibujan, así que no llegan acá.
 */
const HAND_PIECES = new Set(['DoodleArrow', 'DoodleCircle', 'MarkerDraw']);

export const signalRule: Rule = {
  id: 'signal',
  description: 'Señal a mano o forzada que el design system no usaría (usá Callout)',
  check(ctx) {
    const out: Finding[] = [];
    const seen = new Set<string>();
    for (const s of ctx.signals ?? []) {
      const handPiece = HAND_PIECES.has(s.piece) && s.mark !== 'hand';
      const forced = s.kind === 'callout' && s.forced;
      if (!handPiece && !forced) continue;
      const key = `${s.piece}|${s.mark}|${forced}|${Math.round(s.rect.x / 40)}|${Math.round(s.rect.y / 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // con `data-qa-ignore="signal"` (propio o de un ancestro) el aviso baja a info y lo dice: callar tiene que verse
      const muted = (s.ignore ?? []).includes('signal');
      out.push({
        rule: 'signal', severity: handPiece && !muted ? 'warn' : 'info', frame: ctx.frame,
        message: muted ? `${s.piece} con la señal del tema "${s.mark}" (data-qa-ignore="signal": el guion o el comentario de la marca justifica el trazo)` : handPiece
          ? `${s.piece} dibuja un trazo a mano y la señal de este design system es "${s.mark}": señalá con Callout (dibuja la del tema) o dejá que el guion justifique el trazo`
          : `Callout con variant forzada (el tema usa "${s.mark}"): la excepción tiene que decir en un comentario por qué`,
        element: { tag: s.tag, testid: null, text: `${s.piece} (señal del tema: ${s.mark})`, rect: s.rect },
        data: { piece: s.piece, mark: s.mark, forced: s.forced },
      });
    }
    return out;
  },
};
