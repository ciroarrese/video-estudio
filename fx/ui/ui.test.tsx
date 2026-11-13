import { describe, expect, it } from "vitest";
import { wipeInset, wipePosition } from "./BeforeAfter";
import { filterItems } from "./CommandPalette";
import { fanPose } from "./CardFan";
import { scrollState } from "./PhoneScroll";
import { stackOffsets } from "./NotificationStack";
import { chatSchedule } from "./ChatThread";
import { tilePlan } from "./TileGrid";

describe("ui maths", () => {
  it("wipe geometry", () => {
    expect(wipePosition(0)).toBeCloseTo(0.04);
    expect(wipePosition(1, 0.5)).toBeCloseTo(0.5);
    expect(wipeInset(0.25)).toBe(75);
    for (let t = 0; t <= 1; t += 0.05) expect(wipePosition(t)).toBeGreaterThanOrEqual(0);
  });
  it("filterItems ignores accents and case", () => {
    const items = [{ label: "Nuevo documento" }, { label: "Exportar" }, { label: "Ñandú" }];
    expect(filterItems(items, "NUE")).toHaveLength(1);
    expect(filterItems(items, "")).toHaveLength(3);
    expect(filterItems(items, "nandu")).toHaveLength(1);
  });
  it("fanPose is symmetric", () => {
    expect(fanPose(0, 5, 60, 50).angle).toBe(-30);
    expect(fanPose(4, 5, 60, 50).angle).toBe(30);
    expect(fanPose(2, 5, 60, 50).angle).toBe(0);
  });
  it("scrollState reaches the end and the thumb stays inside", () => {
    expect(scrollState(0, 1500, 700).offset).toBe(0);
    const e = scrollState(1, 1500, 700);
    expect(e.offset).toBe(800);
    expect(e.thumbY + e.thumbH).toBeLessThanOrEqual(700);
  });
  it("stackOffsets pushes older cards down", () => {
    expect(stackOffsets([1, 1, 1], 100)).toEqual([200, 100, 0]);
    expect(stackOffsets([1, 0.5], 100)).toEqual([50, 0]);
  });
  it("chat schedule is increasing and ends before the duration", () => {
    const s = chatSchedule([{ from: "them", text: "a" }, { from: "me", text: "b" }], 60);
    expect(s[0]!.typingAt).toBe(0);
    expect(s[1]!.popAt).toBeGreaterThan(s[0]!.popAt);
    expect(s[1]!.popAt + 12).toBeLessThanOrEqual(60);
  });
  it("tilePlan is deterministic", () => {
    expect(tilePlan(3, "s", 0.3, 0.6)).toEqual(tilePlan(3, "s", 0.3, 0.6));
    expect(tilePlan(3, "s", 0.3, 0.6).delay).toBeLessThan(0.6);
  });
});
