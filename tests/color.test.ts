import { describe, expect, it } from "vitest";
import { Color } from "../schema.ts";
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

  it.fails(
    "gap: the spec colorSpace 'xyz-d65' is not accepted (schema.ts:10 has typo 'xzy-d65')",
    () => {
      expect(isValid(Color(sampleColor({ colorSpace: "xyz-d65" })))).toBe(true);
    },
  );

  it.fails(
    "gap: hex must be exactly 6 digits per spec; schema allows 3-digit hex",
    () => {
      expect(isInvalid(Color(sampleColor({ hex: "#fff" })))).toBe(true);
    },
  );

  it.fails(
    "gap: hex must be exactly 6 digits per spec; schema allows 8-digit hex",
    () => {
      expect(isInvalid(Color(sampleColor({ hex: "#ff0000ff" })))).toBe(true);
    },
  );
});
