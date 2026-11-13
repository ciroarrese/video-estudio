// Diferencias entre dos fotos del DOM del escenario (innerHTML): dice QUÉ elementos cambiaron entre dos renders del mismo
// cuadro, para que un `checkDeterminism` fallido no sea una caja negra.

const clip = (s: string, n = 40) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const pathOf = (el: Element): string => {
  const parts: string[] = [];
  for (let cur: Element | null = el; cur && cur.parentElement; cur = cur.parentElement) {
    const same = [...cur.parentElement.children].filter((c) => c.tagName === cur!.tagName);
    parts.unshift(`${cur.tagName.toLowerCase()}${same.length > 1 ? `:nth-of-type(${same.indexOf(cur) + 1})` : ''}`);
  }
  return parts.join(' > ') || el.tagName.toLowerCase();
};

const label = (el: Element) => {
  const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('');
  const text = own.trim() ? ` "${clip(own)}"` : '';
  const data = [...el.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'name').map((a) => `${a.name}="${clip(a.value, 24)}"`).join(' ');
  return `${pathOf(el)}${text}${data ? ` [${data}]` : ''}`;
};

// --- Normalización de orden --------------------------------------------------------------------------------------------
// React agrega al final las propiedades de `style` (y los atributos) que pasan de undefined a un valor, así que el mismo
// cuadro se serializa con otro ORDEN según qué se dibujó antes. Eso no cambia ningún píxel. `normalizeHtml` ordena lo que
// es puro orden; no toca hijos, texto, valores ni el orden de las funciones dentro de un valor (`transform: a b` != `b a`).

/** Parte un `style` en declaraciones por `;` sin cortar dentro de paréntesis ni comillas (`url(data:...;base64,...)`). */
function splitDeclarations(css: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (const ch of css) {
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Atajos (shorthand) que pisan a estas propiedades: si conviven, el orden entre ambas SÍ cambia el resultado. */
const COVERS: Record<string, RegExp> = {
  all: /./,
  inset: /^(top|right|bottom|left|inset-.+)$/,
  'inset-inline': /^(inset-inline-.+|left|right)$/,
  'inset-block': /^(inset-block-.+|top|bottom)$/,
  'margin-inline': /^margin-(left|right)$/,
  'margin-block': /^margin-(top|bottom)$/,
  'padding-inline': /^padding-(left|right)$/,
  'padding-block': /^padding-(top|bottom)$/,
  'border-width': /^border-.+-width$/,
  'border-style': /^border-.+-style$/,
  'border-color': /^border-.+-color$/,
  'border-radius': /^border-.+-radius$/,
  font: /^line-height$/,
  'flex-flow': /^flex-(direction|wrap)$/,
  gap: /^(row|column)-gap$/,
  'place-content': /^(align|justify)-content$/,
  'place-items': /^(align|justify)-items$/,
  'place-self': /^(align|justify)-self$/,
  overflow: /^overflow-.+$/,
};

const baseName = (p: string) => (p.startsWith('--') ? p : p.replace(/^-[a-z]+-/, ''));

/** ¿Dos propiedades se pisan (igual, atajo y componente, o `all`)? Si sí, su orden relativo importa. */
function conflicts(a: string, b: string): boolean {
  if (a.startsWith('--') || b.startsWith('--')) return a === b; // las propiedades custom solo chocan consigo mismas
  const x = baseName(a);
  const y = baseName(b);
  if (x === y) return true;
  const covers = (s: string, l: string) => l.startsWith(`${s}-`) || (COVERS[s]?.test(l) ?? false);
  return covers(x, y) || covers(y, x);
}

/**
 * Ordena las declaraciones de un `style` por nombre de propiedad. Las que se pisan entre sí (duplicadas, atajo + componente
 * como `margin` + `margin-left`, `transition` + `transition-delay`, `all`) forman un grupo que conserva su orden original, de
 * modo que cambiarlo cuenta como diferencia real. Los grupos y las propiedades sueltas se ordenan por el menor nombre.
 */
export function normalizeStyle(css: string): string {
  const decls = splitDeclarations(css).map((text) => {
    const i = text.indexOf(':');
    const prop = (i < 0 ? text : text.slice(0, i)).trim();
    return { prop: prop.startsWith('--') ? prop : prop.toLowerCase(), text: i < 0 ? text : `${prop.startsWith('--') ? prop : prop.toLowerCase()}: ${text.slice(i + 1).trim()}` };
  });
  // Componentes conexos por conflicto (union-find simple).
  const parent = decls.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < decls.length; i++) for (let j = i + 1; j < decls.length; j++) if (conflicts(decls[i]!.prop, decls[j]!.prop)) parent[find(j)] = find(i);
  const groups = new Map<number, typeof decls>();
  decls.forEach((d, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), d]));
  const key = (g: typeof decls) => g.map((d) => d.prop).sort()[0]!;
  return [...groups.values()]
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
    .flatMap((g) => g.map((d) => `${d.text};`))
    .join(' ');
}

/**
 * Devuelve el HTML con los atributos ordenados por nombre, los tokens de `class` ordenados y sin repetir, y las declaraciones
 * de `style` ordenadas (ver `normalizeStyle`). No cambia hijos, texto, valores ni nada que pueda cambiar un píxel.
 */
export function normalizeHtml(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;
  const fix = (el: Element) => {
    const attrs = [...el.attributes].map((a) => [a.name, a.value] as const).sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0));
    for (const [n] of attrs) el.removeAttribute(n);
    for (const [n, v] of attrs) {
      el.setAttribute(n, n === 'style' ? normalizeStyle(v) : n === 'class' ? [...new Set(v.split(/\s+/).filter(Boolean))].sort().join(' ') : v);
    }
    for (const c of el.children) fix(c);
  };
  for (const c of root.children) fix(c);
  return root.innerHTML;
}

/** Hasta `max` diferencias entre dos HTML, en español, con la ruta del elemento (relativa al escenario). */
export function diffHtml(a: string, b: string, max = 3): string[] {
  if (a === b) return [];
  const mk = (html: string) => {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
  };
  const out: string[] = [];
  const walk = (x: Element, y: Element) => {
    if (out.length >= max) return;
    if (x.tagName !== y.tagName) return void out.push(`${label(x)}: es <${x.tagName.toLowerCase()}> en un render y <${y.tagName.toLowerCase()}> en el otro`);
    const names = new Set([...x.getAttributeNames(), ...y.getAttributeNames()]);
    for (const n of names) {
      const va = x.getAttribute(n);
      const vb = y.getAttribute(n);
      if (va !== vb) {
        out.push(`${label(x)}: ${n} cambia (${va === null ? 'sin atributo' : `"${clip(va, 60)}"`} vs ${vb === null ? 'sin atributo' : `"${clip(vb, 60)}"`})`);
        if (out.length >= max) return;
      }
    }
    const ca = [...x.childNodes];
    const cb = [...y.childNodes];
    if (ca.length !== cb.length) return void out.push(`${label(x)}: tiene ${ca.length} hijos en un render y ${cb.length} en el otro`);
    ca.forEach((na, i) => {
      const nb = cb[i]!;
      if (out.length >= max) return;
      if (na.nodeType === 1 && nb.nodeType === 1) walk(na as Element, nb as Element);
      else if (na.nodeType !== nb.nodeType || na.textContent !== nb.textContent) {
        out.push(`${label(x)}: el texto cambia ("${clip(na.textContent ?? '')}" vs "${clip(nb.textContent ?? '')}")`);
      }
    });
  };
  walk(mk(a), mk(b));
  return out;
}

/** Describe los elementos que hay en un punto del escenario (de arriba hacia abajo): etiqueta, texto, ruta y data-*. */
export function describeAtPoint(stage: Element, x: number, y: number, max = 4): string[] {
  const res: string[] = [];
  for (const el of document.elementsFromPoint(x, y)) {
    if (el === stage || !stage.contains(el)) continue;
    res.push(label(el));
    if (res.length >= max) break;
  }
  return res;
}
