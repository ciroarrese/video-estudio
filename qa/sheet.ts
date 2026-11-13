import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { sampleFrames, type SampleSpec } from './sampling';
import { openSession, sceneFrames } from './session';
import type { FormatName } from '../engine';

export type Cell = { frame: number; x: number; y: number; w: number; h: number; labelY: number };
export type Layout = { width: number; height: number; cols: number; rows: number; labelH: number; cells: Cell[] };

export const timecode = (frame: number, fps: number): string => {
  const total = Math.floor(frame / fps);
  const ff = frame - total * fps;
  const s = total % 60;
  const m = Math.floor(total / 60);
  return `${m}:${String(s).padStart(2, '0')}.${String(ff).padStart(2, '0')}`;
};

/** Pure layout of the contact sheet: grid of `cols` cells, each `cellW x cellH` plus `labelH` under it. */
export function sheetLayout(frames: number[], o: { cols: number; cellW: number; cellH: number; labelH: number; gap: number; pad: number }): Layout {
  const cols = Math.max(1, Math.min(o.cols, frames.length || 1));
  const rows = Math.ceil(frames.length / cols);
  const rowH = o.cellH + o.labelH + o.gap;
  const cells = frames.map((frame, i) => {
    const x = o.pad + (i % cols) * (o.cellW + o.gap);
    const y = o.pad + Math.floor(i / cols) * rowH;
    return { frame, x, y, w: o.cellW, h: o.cellH, labelY: y + o.cellH };
  });
  return {
    cols, rows, cells, labelH: o.labelH,
    width: o.pad * 2 + cols * o.cellW + (cols - 1) * o.gap,
    height: o.pad * 2 + rows * rowH - o.gap,
  };
}

export type SheetOptions = SampleSpec & {
  videoId: string;
  props?: Record<string, unknown>;
  format?: FormatName;
  /** Solo esta escena (id/nombre o índice desde 0). */
  scene?: string;
  cols?: number;
  /** Size of every thumbnail relative to the frame (default 0.25). */
  scale?: number;
  out?: string;
  labels?: boolean;
  log?: (m: string) => void;
};
export type SheetResult = { out: string; frames: number[]; width: number; height: number };

const composeSrc = `(async function(layout, thumbs, labels, fontPx){
  const cv = document.createElement('canvas'); cv.width = layout.width; cv.height = layout.height;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#1b1d22'; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.imageSmoothingQuality = 'high'; ctx.font = '600 ' + fontPx + 'px ui-monospace, Menlo, Consolas, monospace'; ctx.textBaseline = 'middle';
  for (let i = 0; i < layout.cells.length; i++) {
    const c = layout.cells[i]; const img = new Image(); img.src = thumbs[i]; await img.decode();
    ctx.drawImage(img, c.x, c.y, c.w, c.h);
    ctx.strokeStyle = '#3a3e47'; ctx.lineWidth = 1; ctx.strokeRect(c.x - 0.5, c.y - 0.5, c.w + 1, c.h + 1);
    if (labels) { ctx.fillStyle = '#e6e8ee'; ctx.fillText(labels[i], c.x + 2, c.labelY + (layout.labelH / 2) + 1); }
  }
  return cv.toDataURL('image/png');
})`;

export async function makeSheet(o: SheetOptions): Promise<SheetResult> {
  const session = await openSession({ videoId: o.videoId, props: o.props, format: o.format, log: o.log });
  try {
    const { meta } = session;
    const frames = sampleFrames(o, meta.durationInFrames, 12, await sceneFrames(session, o.scene));
    const scale = o.scale ?? 0.25;
    if (!(scale > 0 && scale <= 1)) throw new Error('--scale debe estar entre 0 y 1');
    const cellW = Math.max(1, Math.round(meta.width * scale));
    const cellH = Math.max(1, Math.round(meta.height * scale));
    const showLabels = o.labels ?? true;
    const fontPx = Math.max(11, Math.min(18, Math.round(cellW / 22)));
    const layout = sheetLayout(frames, { cols: o.cols ?? 4, cellW, cellH, labelH: showLabels ? fontPx + 10 : 0, gap: 8, pad: 8 });
    const vp = await session.openPage();
    const thumbs: string[] = [];
    for (const f of frames) {
      await vp.setFrame(f);
      thumbs.push(`data:image/png;base64,${(await vp.shot(scale)).toString('base64')}`);
    }
    const labels = showLabels ? frames.map((f) => `#${f}  ${timecode(f, meta.fps)}`) : null;
    // Compose in a blank page of the same browser (canvas), so no image library is needed.
    const ctx = await session.browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
    try {
      const page = await ctx.newPage();
      await page.goto('about:blank');
      const compose = (page.evaluate as unknown as (e: string) => Promise<string>);
      const url = await compose.call(page, `${composeSrc}(${JSON.stringify(layout)},${JSON.stringify(thumbs)},${JSON.stringify(labels)},${fontPx})`);
      const out = resolve(o.out ?? `out/${o.videoId}-sheet.png`);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, Buffer.from(url.split(',')[1]!, 'base64'));
      return { out, frames, width: layout.width, height: layout.height };
    } finally {
      await ctx.close().catch(() => {});
    }
  } finally {
    await session.close();
  }
}
