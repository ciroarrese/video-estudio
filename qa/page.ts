import { readFileSync } from 'node:fs';
import type { PageData, TextRun } from './types';
import type { VideoPage } from './session';

const collectSrc = readFileSync(new URL('./collect.inpage.js', import.meta.url), 'utf8');
const sampleSrc = readFileSync(new URL('./sample.inpage.js', import.meta.url), 'utf8');

// Page.evaluate accepts a string expression at runtime; the shared type only declares functions.
const evalStr = <R>(vp: VideoPage, expr: string) => (vp.page.evaluate as unknown as (e: string) => Promise<R>)(expr);

const HIDE_TEXT = `*,*::before,*::after{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important;text-decoration-color:transparent !important;caret-color:transparent !important}svg text{fill:transparent !important;stroke:transparent !important}`;

/** `onlyKeys`: modo liviano, solo mide los textos con esas claves (tamaño en pantalla y opacidad; sin tapados ni recortes). */
export async function collectRuns(vp: VideoPage, width: number, height: number, elemKeys: string[] = [], onlyKeys?: string[]): Promise<PageData> {
  const d = await evalStr<Omit<PageData, 'frame'>>(vp, `${collectSrc}(${JSON.stringify({ width, height, elemKeys, onlyKeys })})`);
  return { ...d, frame: -1 };
}

/** Fills `run.bg` for every run that needs it by screenshotting the frame with all text made transparent. */
export async function sampleBackgrounds(vp: VideoPage, runs: TextRun[]): Promise<void> {
  const need = runs.filter((r) => !r.transparentFill);
  if (!need.length) return;
  await evalStr(vp, `(()=>{const s=document.createElement('style');s.id='__qa_hide';s.textContent=${JSON.stringify(HIDE_TEXT)};document.head.appendChild(s);})()`);
  let png: Buffer;
  try {
    png = await vp.shot(1);
  } finally {
    await evalStr(vp, `document.getElementById('__qa_hide')?.remove()`);
  }
  const rects = need.map((r) => r.rect);
  const res = await evalStr<({ r: number; g: number; b: number; samples: number } | null)[]>(
    vp,
    `${sampleSrc}(${JSON.stringify(`data:image/png;base64,${png.toString('base64')}`)},${JSON.stringify(rects)})`,
  );
  need.forEach((r, i) => (r.bg = res[i] ?? null));
}

export type PageText = {
  /** Un texto por nodo de texto, mas alt/title/aria-label/placeholder/value. */
  nodes: string[];
  /**
   * Textos de bloque (de cada elemento que no es en linea, y de todo el escenario) y `innerText` del escenario, con espacios colapsados.
   * El limite entre bloques (o un `<br>`) es \u0001: no es espacio en blanco y no se cruza al buscar; entre items de un flex/grid es \u0002 (se lee como espacio, pero un termino armado con una letra por item si coincide). Ver `scanJoined`.
   */
  joined: string[];
};

/**
 * Todo lo que la pagina muestra. Ademas de cada nodo suelto devuelve el texto por bloque y el del escenario completo:
 * un termino o un correo armado con spans (letra por letra, palabra por palabra) no aparece en ningun nodo, pero si en el bloque.
 */
export async function collectAllText(vp: VideoPage): Promise<PageText> {
  return evalStr<PageText>(
    vp,
    `(()=>{const root=document.getElementById('stage')||document.body;
      const nodes=[];const joined=new Set();
      const norm=s=>s.replace(/\\s+/g,' ').trim();
      const add=s=>{const t=norm(s||'');if(t)joined.add(t);};
      const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
      while((n=w.nextNode())){const t=n.data.trim();if(t)nodes.push(t);}
      // Texto de un bloque: los elementos en linea (y en linea-bloque) se pegan sin separador, el resto separa con \\u0001 (limite de bloque) o con \\u0002 si es un item de flex/grid (vecinos en la misma linea, p. ej. una letra por span),
      // para no fabricar un correo, un dominio o un termino con el final de un bloque y el inicio del siguiente.
      const flat=e=>{let t='';for(const c of e.childNodes){
        if(c.nodeType===3)t+=c.data;
        else if(c.nodeType===1&&c.tagName==='BR')t+='\\u0001';
        else if(c.nodeType===1&&c.tagName!=='SCRIPT'&&c.tagName!=='STYLE'){const d=getComputedStyle(c).display;if(d==='none')continue;const tight=d==='inline'||d==='contents'||d==='inline-block';const sp=/flex|grid/.test(getComputedStyle(e).display)?'\\u0002':'\\u0001';t+=(tight?'':sp)+flat(c)+(tight?'':sp);}}
        return t;};
      const els=root.querySelectorAll('*');
      els.forEach(e=>{
        for(const a of ['alt','title','aria-label','placeholder','value']){const v=e.getAttribute(a);if(v&&v.trim())nodes.push(v.trim());}
        if(e.tagName==='SCRIPT'||e.tagName==='STYLE')return;
        const d=getComputedStyle(e).display;
        if(d!=='inline'&&d!=='contents'&&d!=='none')add(flat(e));
      });
      add(flat(root));add((root.innerText||'').replace(/\\n+/g,'\\u0001'));
      return {nodes,joined:[...joined]};})()`,
  );
}
