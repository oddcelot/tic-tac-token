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
