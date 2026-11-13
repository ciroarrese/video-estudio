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
