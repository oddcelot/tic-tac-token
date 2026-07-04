import { describe, expect, it } from "vitest";
import { dtcgColorToLspColor, lspColorToHex } from "../src/utils/color.ts";

describe("dtcgColorToLspColor", () => {
  it("converts hex-only values", () => {
    const color = dtcgColorToLspColor({ hex: "#3366ff" });
    expect(color).toBeDefined();
    expect(color!.red).toBeCloseTo(0x33 / 255, 5);
    expect(color!.green).toBeCloseTo(0x66 / 255, 5);
    expect(color!.blue).toBeCloseTo(0xff / 255, 5);
    expect(color!.alpha).toBe(1);
  });

  it("converts srgb components with alpha", () => {
    const color = dtcgColorToLspColor({
      colorSpace: "srgb",
      components: [1, 0, 0],
      alpha: 0.5,
    });
    expect(color).toEqual({ red: 1, green: 0, blue: 0, alpha: 0.5 });
  });

  it("prefers components over a mismatching hex", () => {
    const color = dtcgColorToLspColor({
      colorSpace: "srgb",
      components: [0, 1, 0],
      hex: "#ff0000",
    });
    expect(color).toEqual({ red: 0, green: 1, blue: 0, alpha: 1 });
  });

  it("falls back to hex when a component is 'none'", () => {
    const color = dtcgColorToLspColor({
      colorSpace: "srgb",
      components: [1, "none", 0],
      hex: "#112233",
    });
    expect(color).toBeDefined();
    expect(color!.red).toBeCloseTo(0x11 / 255, 5);
    expect(color!.green).toBeCloseTo(0x22 / 255, 5);
    expect(color!.blue).toBeCloseTo(0x33 / 255, 5);
  });

  it("returns undefined when a component is 'none' and there is no hex fallback", () => {
    const color = dtcgColorToLspColor({
      colorSpace: "srgb",
      components: [1, "none", 0],
    });
    expect(color).toBeUndefined();
  });

  it("returns undefined for non-object / garbage input", () => {
    expect(dtcgColorToLspColor(null)).toBeUndefined();
    expect(dtcgColorToLspColor(undefined)).toBeUndefined();
    expect(dtcgColorToLspColor("red")).toBeUndefined();
    expect(dtcgColorToLspColor(42)).toBeUndefined();
    expect(dtcgColorToLspColor([1, 0, 0])).toBeUndefined();
    expect(dtcgColorToLspColor({})).toBeUndefined();
  });

  it("converts hsl", () => {
    // hsl(0, 100%, 50%) is pure red.
    const color = dtcgColorToLspColor({
      colorSpace: "hsl",
      components: [0, 100, 50],
    });
    expect(color).toBeDefined();
    expect(color!.red).toBeCloseTo(1, 3);
    expect(color!.green).toBeCloseTo(0, 3);
    expect(color!.blue).toBeCloseTo(0, 3);
  });

  it("converts hwb", () => {
    // hwb(0 0% 0%) is pure red.
    const color = dtcgColorToLspColor({
      colorSpace: "hwb",
      components: [0, 0, 0],
    });
    expect(color).toBeDefined();
    expect(color!.red).toBeCloseTo(1, 3);
    expect(color!.green).toBeCloseTo(0, 3);
    expect(color!.blue).toBeCloseTo(0, 3);
  });

  it("converts display-p3 white to ~white", () => {
    const color = dtcgColorToLspColor({
      colorSpace: "display-p3",
      components: [1, 1, 1],
    });
    expect(color).toBeDefined();
    expect(color!.red).toBeCloseTo(1, 2);
    expect(color!.green).toBeCloseTo(1, 2);
    expect(color!.blue).toBeCloseTo(1, 2);
  });

  it("converts display-p3 red, gamut-clamping into sRGB", () => {
    // display-p3 has a wider red primary than sRGB, so (1,0,0) in P3 is
    // out of the sRGB gamut: red clamps to 1, green/blue stay small but
    // nonzero rather than 0.
    const color = dtcgColorToLspColor({
      colorSpace: "display-p3",
      components: [1, 0, 0],
    });
    expect(color).toBeDefined();
    expect(color!.red).toBeCloseTo(1, 2);
    expect(color!.green).toBeLessThan(0.2);
    expect(color!.blue).toBeLessThan(0.2);
  });

  it("converts oklch for a known reference (pure sRGB red)", () => {
    // Published reference: sRGB red (#ff0000) is oklch(62.8% 0.2577 29.23)
    // per the CSS Color 4 spec / colorjs.io.
    const color = dtcgColorToLspColor({
      colorSpace: "oklch",
      components: [0.6279553606, 0.2576833077, 29.2338851923],
    });
    expect(color).toBeDefined();
    expect(color!.red).toBeCloseTo(1, 2);
    expect(color!.green).toBeCloseTo(0, 2);
    expect(color!.blue).toBeCloseTo(0, 2);
  });

  it("converts lab for a known reference (pure sRGB red)", () => {
    // Published reference: sRGB red (#ff0000) is lab(54.29% 80.82 69.88)
    // (D50-relative CIE Lab, per colorjs.io / CSS Color 4 examples).
    const color = dtcgColorToLspColor({
      colorSpace: "lab",
      components: [54.29, 80.82, 69.88],
    });
    expect(color).toBeDefined();
    expect(color!.red).toBeCloseTo(1, 1);
    expect(color!.green).toBeCloseTo(0, 1);
    expect(color!.blue).toBeCloseTo(0, 1);
  });

  it("converts lab white to ~white", () => {
    const color = dtcgColorToLspColor({
      colorSpace: "lab",
      components: [100, 0, 0],
    });
    expect(color).toBeDefined();
    expect(color!.red).toBeCloseTo(1, 2);
    expect(color!.green).toBeCloseTo(1, 2);
    expect(color!.blue).toBeCloseTo(1, 2);
  });

  it("clamps alpha and defaults missing/non-numeric alpha to 1", () => {
    const noAlpha = dtcgColorToLspColor({ colorSpace: "srgb", components: [0, 0, 0] });
    expect(noAlpha!.alpha).toBe(1);
    const badAlpha = dtcgColorToLspColor({
      colorSpace: "srgb",
      components: [0, 0, 0],
      alpha: "opaque",
    });
    expect(badAlpha!.alpha).toBe(1);
  });
});

describe("lspColorToHex", () => {
  it("round-trips opaque colors without an alpha suffix", () => {
    expect(lspColorToHex({ red: 1, green: 0, blue: 0, alpha: 1 })).toBe("#ff0000");
  });

  it("appends the alpha channel when alpha < 1", () => {
    expect(lspColorToHex({ red: 1, green: 0, blue: 0, alpha: 0.5 })).toBe("#ff000080");
  });
});
