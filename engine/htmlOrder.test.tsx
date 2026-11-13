import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { checkDeterminism, createStage, useFrame, type Stage } from './index';
import { normalizeHtml, normalizeStyle } from './htmlDiff';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});

const stages: Stage[] = [];
afterEach(() => {
  stages.splice(0).forEach((s) => s.destroy());
});
const mk = (component: () => JSX.Element) => {
  const s = createStage(document.createElement('div'), { id: 'o', component, fps: 30, width: 10, height: 10, durationInFrames: 30 });
  stages.push(s);
  return s;
};

describe('normalizeStyle', () => {
  it('ordena propiedades sueltas por nombre', () => {
    expect(normalizeStyle('transform: scale(2); font-size: 3px')).toBe(normalizeStyle('font-size: 3px; transform: scale(2)'));
  });
  it('no toca el orden de las funciones dentro de un valor', () => {
    expect(normalizeStyle('transform: scale(2) rotate(1deg)')).not.toBe(normalizeStyle('transform: rotate(1deg) scale(2)'));
  });
  it('conserva el orden entre atajo y componente (es una diferencia real)', () => {
    expect(normalizeStyle('margin: 1px; margin-left: 2px')).not.toBe(normalizeStyle('margin-left: 2px; margin: 1px'));
    expect(normalizeStyle('transition: all 1s; transition-delay: 2s')).not.toBe(normalizeStyle('transition-delay: 2s; transition: all 1s'));
    expect(normalizeStyle('color: red; color: blue')).not.toBe(normalizeStyle('color: blue; color: red'));
  });
  it('un grupo en conflicto se mueve entero sin perder su orden interno', () => {
    expect(normalizeStyle('z-index: 1; margin: 1px; margin-left: 2px; a-b: 1')).toBe('a-b: 1; margin: 1px; margin-left: 2px; z-index: 1;');
  });
  it('longhands sin relación (padding-top y padding-left) sí se ordenan', () => {
    expect(normalizeStyle('padding-top: 1px; padding-left: 2px')).toBe(normalizeStyle('padding-left: 2px; padding-top: 1px'));
  });
  it('no corta en ; dentro de url() ni de comillas', () => {
    expect(normalizeStyle('background-image: url(data:image/png;base64,AAA); a: 1')).toBe('a: 1; background-image: url(data:image/png;base64,AAA);');
  });
});

describe('normalizeHtml', () => {
  it('ignora el orden de atributos y de clases, pero no los valores ni los hijos', () => {
    expect(normalizeHtml('<p id="a" class="y x" title="t">hola</p>')).toBe(normalizeHtml('<p title="t" class="x y" id="a">hola</p>'));
    expect(normalizeHtml('<p id="a">x</p>')).not.toBe(normalizeHtml('<p id="b">x</p>'));
    expect(normalizeHtml('<i></i><b></b>')).not.toBe(normalizeHtml('<b></b><i></i>'));
  });
});

describe('checkDeterminism con orden de estilos', () => {
  // `transform` va primero en el objeto pero solo existe entre los cuadros 10 y 19; `fontSize` y `data-b` existen siempre
  // desde el 5. Tras el cuadro 29 (sin transform) el cuadro 15 agrega `transform` al final; tras el 0 lo agrega primero.
  const Late = () => {
    const f = useFrame();
    const on = f >= 10 && f < 20;
    return <div style={{ ...(on ? { transform: 'scale(1.5)' } : {}), ...(f >= 5 ? { fontSize: 12 } : {}) }} {...(on ? { 'aria-label': 'x' } : {})} {...(f >= 5 ? { 'data-b': '1' } : {})} />;
  };
  it('el mismo cuadro con otro orden de propiedades y atributos es ok', async () => {
    const stage = mk(Late);
    // Con las dos historias el HTML crudo difiere de orden.
    stage.render(0);
    stage.render(15);
    const a = stage.html();
    stage.render(29);
    stage.render(15);
    stage.render(0);
    stage.render(15);
    const res = await checkDeterminism(stage, [0, 10, 15, 19, 25, 29]);
    expect(res.every((r) => r.ok)).toBe(true);
    expect(a).toContain('transform');
    // antes del cambio esto fallaba: el HTML crudo sale en otro orden según la historia
    expect(res.some((r) => r.reordered)).toBe(true);
  });
  it('un valor distinto sigue fallando', async () => {
    let n = 0;
    const Bad = () => <div style={{ fontSize: 12, transform: `scale(${1 + (n += 1) / 100})` }} />;
    const res = await checkDeterminism(mk(Bad), [5]);
    expect(res[0]!.ok).toBe(false);
    expect(res[0]!.diffs![0]).toMatch(/style cambia/);
  });
  it('un reordenamiento atajo/componente en el HTML es diferencia real', () => {
    expect(normalizeHtml('<div style="margin: 1px; margin-left: 2px;"></div>')).not.toBe(normalizeHtml('<div style="margin-left: 2px; margin: 1px;"></div>'));
  });
});
