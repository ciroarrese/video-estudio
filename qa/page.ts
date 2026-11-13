import { readFileSync } from 'node:fs';
import type { PageData, TextRun } from './types';
import type { VideoPage } from './session';

const collectSrc = readFileSync(new URL('./collect.inpage.js', import.meta.url), 'utf8');
const sampleSrc = readFileSync(new URL('./sample.inpage.js', import.meta.url), 'utf8');

// Page.evaluate accepts a string expression at runtime; the shared type only declares functions.
const evalStr = <R>(vp: VideoPage, expr: string) => (vp.page.evaluate as unknown as (e: string) => Promise<R>)(expr);

const HIDE_TEXT = `*,*::before,*::after{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important;text-decoration-color:transparent !important;caret-color:transparent !important}svg text{fill:transparent !important;stroke:transparent !important}`;

export async function collectRuns(vp: VideoPage, width: number, height: number, elemKeys: string[] = []): Promise<PageData> {
  const d = await evalStr<Omit<PageData, 'frame'>>(vp, `${collectSrc}(${JSON.stringify({ width, height, elemKeys })})`);
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

/** Every string the page renders: text nodes plus alt/title/aria-label/placeholder/value attributes. */
export async function collectAllText(vp: VideoPage): Promise<string[]> {
  return evalStr<string[]>(
    vp,
    `(()=>{const root=document.getElementById('stage')||document.body;const out=[];
      const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
      while((n=w.nextNode())){const t=n.data.trim();if(t)out.push(t);}
      root.querySelectorAll('[alt],[title],[aria-label],[placeholder],[value]').forEach(e=>{for(const a of ['alt','title','aria-label','placeholder','value']){const v=e.getAttribute(a);if(v&&v.trim())out.push(v.trim());}});
      return out;})()`,
  );
}
