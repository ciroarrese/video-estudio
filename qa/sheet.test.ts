import { describe, expect, it } from 'vitest';
import { sheetLayout, timecode } from './sheet';

describe('sheet layout', () => {
  const o = { cols: 4, cellW: 480, cellH: 270, labelH: 28, gap: 8, pad: 8 };
  it('places cells in a grid and sizes the canvas', () => {
    const l = sheetLayout(Array.from({ length: 6 }, (_, i) => i * 10), o);
    expect(l.cols).toBe(4);
    expect(l.rows).toBe(2);
    expect(l.width).toBe(8 * 2 + 4 * 480 + 3 * 8);
    expect(l.height).toBe(8 * 2 + 2 * (270 + 28 + 8) - 8);
    expect(l.cells[0]).toMatchObject({ frame: 0, x: 8, y: 8, labelY: 278 });
    expect(l.cells[5]).toMatchObject({ frame: 50, x: 8 + 488, y: 8 + 306 });
  });
  it('shrinks columns when there are fewer frames', () => {
    const l = sheetLayout([0, 1], o);
    expect(l.cols).toBe(2);
    expect(l.rows).toBe(1);
  });
  it('formats timecodes', () => {
    expect(timecode(0, 30)).toBe('0:00.00');
    expect(timecode(75, 30)).toBe('0:02.15');
    expect(timecode(30 * 61 + 3, 30)).toBe('1:01.03');
  });
});
