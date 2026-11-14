import type { ElementInfo, Rect, TextRun } from './types';

export const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h);

export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null;
}

/** Intersection area divided by the area of the smaller rect (0 when either is empty). */
export function overlapRatio(a: Rect, b: Rect): number {
  const i = intersect(a, b);
  const m = Math.min(area(a), area(b));
  return i && m > 0 ? area(i) / m : 0;
}

/** Fraction of `r` that lies outside `box` (1 = entirely outside), considering only the axes in `axes`. */
export function hiddenFraction(r: Rect, box: Rect, axes: { x: boolean; y: boolean } = { x: true, y: true }): number {
  const total = area(r);
  if (total <= 0) return 0;
  const b: Rect = {
    x: axes.x ? box.x : -1e9,
    y: axes.y ? box.y : -1e9,
    w: axes.x ? box.w : 2e9,
    h: axes.y ? box.h : 2e9,
  };
  const i = intersect(r, b);
  return 1 - (i ? area(i) : 0) / total;
}

/** Largest distance (px) by which `r` sticks out of `box`. */
export function protrusion(r: Rect, box: Rect): number {
  return Math.max(box.x - r.x, box.y - r.y, r.x + r.w - (box.x + box.w), r.y + r.h - (box.y + box.h), 0);
}

export const unionRect = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};

const round = (n: number) => Math.round(n);
export const roundRect = (r: Rect): Rect => ({ x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) });

export const excerpt = (s: string, n = 40) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export const pathOfKey = (key: string) => key.split('|')[0] ?? '';

export const describe = (r: TextRun): ElementInfo => ({ tag: r.tag, testid: r.testid, text: excerpt(r.text), rect: roundRect(r.rect), path: pathOfKey(r.key) });

/** `"text" [testid]` or `"text" [div@0.2.1]` (DOM path) when there is no test id. */
export const formatElement = (e: ElementInfo) =>
  `"${e.text}" [${e.testid ?? `${e.tag}${e.path ? `@${e.path}` : ''}`}]`;

/** True when the run (or an ancestor) opted out of `rule` through data-qa-ignore. */
export const ignored = (r: { ignore: string[] }, rule: string) => r.ignore.includes(rule) || r.ignore.includes('all');

/** Text blown up far beyond the frame (zoom-through effects): its geometry says nothing about layout. */
export const isHuge = (r: Rect, width: number, height: number, maxFrames: number) => r.w > width * maxFrames || r.h > height * maxFrames;

/** Vertical shrink around the centre: a line box is taller than the glyph ink, so stacked lines touch less than their boxes do. */
export const ink = (r: Rect, k: number): Rect => ({ x: r.x, y: r.y + (r.h * (1 - k)) / 2, w: r.w, h: r.h * k });

/** Largest edge displacement between two rects (px). */
export const rectShift = (a: Rect, b: Rect) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.x + a.w - (b.x + b.w)), Math.abs(a.y + a.h - (b.y + b.h)));
