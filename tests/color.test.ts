import { describe, expect, it } from "vitest";
import { Color } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

const sampleColor = (overrides: Record<string, unknown> = {}) => ({
  $type: "color",
  $value: {
    colorSpace: "srgb",
    components: [1, 0, 0],
    alpha: 1,
    hex: "#ff0000",
    ...overrides,
  },
});

describe("color token (DTCG §8.1 + Color Module)", () => {
  it("accepts a valid srgb color", () => {
    expect(isValid(Color(sampleColor()))).toBe(true);
  });

  it("accepts a curly-brace alias as $value", () => {
    expect(isValid(Color({ $type: "color", $value: "{colors.accent}" }))).toBe(
      true,
    );
  });

  it("accepts a color without hex (hex is optional per spec)", () => {
    expect(
      isValid(
        Color({
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [0.5, 0.5, 0.5],
            alpha: 1,
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a color without alpha (alpha is optional per spec)", () => {
    expect(
      isValid(
        Color({
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [0.5, 0.5, 0.5],
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a bare string that is not a curly-brace alias", () => {
    expect(isInvalid(Color({ $type: "color", $value: "colors.accent" }))).toBe(
      true,
    );
  });

  it("accepts 'none' as a component value (spec: number | 'none')", () => {
    expect(
      isValid(
        Color({
          $type: "color",
          $value: {
            colorSpace: "lab",
            components: ["none", 0, 0],
            alpha: 1,
            hex: "#808080",
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a color with only 2 components", () => {
    expect(
      isInvalid(
        Color({
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [1, 0],
            alpha: 1,
            hex: "#ff0000",
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects an unknown colorSpace", () => {
    expect(
      isInvalid(
        Color({
          $type: "color",
          $value: {
            colorSpace: "cmyk",
            components: [1, 0, 0],
            alpha: 1,
            hex: "#ff0000",
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects alpha outside [0, 1]", () => {
    const low = Color(sampleColor({ alpha: -0.5 }));
    const high = Color(sampleColor({ alpha: 1.5 }));
    expect(isInvalid(low)).toBe(true);
    expect(isInvalid(high)).toBe(true);
  });

  it("accepts the spec colorSpace 'xyz-d65'", () => {
    expect(isValid(Color(sampleColor({ colorSpace: "xyz-d65" })))).toBe(true);
  });

  it("rejects the old typo 'xzy-d65'", () => {
    expect(isInvalid(Color(sampleColor({ colorSpace: "xzy-d65" })))).toBe(true);
  });

  it("rejects 3-digit hex (spec: exactly 6)", () => {
    expect(isInvalid(Color(sampleColor({ hex: "#fff" })))).toBe(true);
  });

  it("rejects 8-digit hex (spec: exactly 6)", () => {
    expect(isInvalid(Color(sampleColor({ hex: "#ff0000ff" })))).toBe(true);
  });
});

describe("color per-colorSpace component ranges (DTCG color module)", () => {
  const validByColorSpace = {
    srgb: [1, 0, 0],
    "srgb-linear": [1, 0, 0],
    "display-p3": [1, 0, 0],
    "a98-rgb": [1, 0, 0],
    "prophoto-rgb": [1, 0, 0],
    rec2020: [1, 0, 0],
    "xyz-d65": [0.5, 0.5, 0.5],
    "xyz-d50": [0.5, 0.5, 0.5],
    hsl: [120, 50, 50],
    hwb: [120, 0, 0],
    lab: [50, 20, -20],
    lch: [50, 30, 120],
    oklab: [0.5, 0.1, -0.1],
    oklch: [0.5, 0.1, 120],
  } as const;

  it.each(Object.entries(validByColorSpace))(
    "accepts in-range components for %s",
    (colorSpace, components) => {
      expect(
        isValid(
          Color({
            $type: "color",
            $value: { colorSpace, components },
          }),
        ),
      ).toBe(true);
    },
  );

  it("rejects RGB components > 1 (srgb)", () => {
    expect(
      isInvalid(
        Color({
          $type: "color",
          $value: { colorSpace: "srgb", components: [1.5, 0, 0] },
        }),
      ),
    ).toBe(true);
  });

  it("rejects HSL hue >= 360 (spec: 0 <= H < 360)", () => {
    expect(
      isInvalid(
        Color({
          $type: "color",
          $value: { colorSpace: "hsl", components: [360, 50, 50] },
        }),
      ),
    ).toBe(true);
  });

  it("rejects HSL saturation > 100", () => {
    expect(
      isInvalid(
        Color({
          $type: "color",
          $value: { colorSpace: "hsl", components: [180, 150, 50] },
        }),
      ),
    ).toBe(true);
  });

  it("rejects LAB lightness > 100", () => {
    expect(
      isInvalid(
        Color({
          $type: "color",
          $value: { colorSpace: "lab", components: [150, 0, 0] },
        }),
      ),
    ).toBe(true);
  });

  it("rejects OKLCH chroma below 0", () => {
    expect(
      isInvalid(
        Color({
          $type: "color",
          $value: { colorSpace: "oklch", components: [0.5, -0.1, 120] },
        }),
      ),
    ).toBe(true);
  });

  it("accepts 'none' as any channel per spec", () => {
    expect(
      isValid(
        Color({
          $type: "color",
          $value: { colorSpace: "lab", components: ["none", 0, 0] },
        }),
      ),
    ).toBe(true);
    expect(
      isValid(
        Color({
          $type: "color",
          $value: { colorSpace: "oklch", components: [0.5, "none", 120] },
        }),
      ),
    ).toBe(true);
  });

  it("rejects an unknown key on a color value object", () => {
    expect(
      isInvalid(
        Color({
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [1, 0, 0],
            sneaky: "extra",
          } as never,
        }),
      ),
    ).toBe(true);
  });
});
