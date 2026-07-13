import { describe, expect, it } from "vitest";
import { roundToDevicePixel } from "./scroll";

describe("virtual scroll positioning", () => {
  it("snaps translated rows to the physical pixel grid", () => {
    expect(roundToDevicePixel(10.4, 1.25)).toBe(10.4);
    expect(roundToDevicePixel(10.5, 1.5)).toBeCloseTo(10.6667, 4);
  });
});
