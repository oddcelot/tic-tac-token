import { describe, expect, it } from "vitest";
import { Shadow } from "../schema.ts";
import { isInvalid, isValid } from "./helpers.ts";

const black = {
  $type: "color",
  $value: {
    colorSpace: "srgb",
    components: [0, 0, 0],
    alpha: 0.5,
    hex: "#000000",
  },
} as const;

const singleShadow = {
  color: black,
  offsetX: { value: 2, unit: "px" },
  offsetY: { value: 2, unit: "px" },
  blur: { value: 4, unit: "px" },
  spread: { value: 0, unit: "px" },
} as const;

describe("shadow token (DTCG §9.6)", () => {
  it("accepts a single shadow object", () => {
    expect(isValid(Shadow({ $type: "shadow", $value: singleShadow }))).toBe(
      true,
    );
  });

  it("rejects a shadow missing a required property", () => {
    const { spread: _spread, ...incomplete } = singleShadow;
    expect(
      isInvalid(Shadow({ $type: "shadow", $value: incomplete })),
    ).toBe(true);
  });

  it("accepts a layered (array) shadow value", () => {
    expect(
      isValid(Shadow({ $type: "shadow", $value: [singleShadow, singleShadow] })),
    ).toBe(true);
  });

  it("accepts a single shadow with inset: true", () => {
    expect(
      isValid(
        Shadow({
          $type: "shadow",
          $value: { ...singleShadow, inset: true },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a non-boolean inset value", () => {
    expect(
      isInvalid(
        Shadow({
          $type: "shadow",
          $value: { ...singleShadow, inset: "yes-please" },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a curly-brace alias", () => {
    expect(
      isValid(Shadow({ $type: "shadow", $value: "{elevation.low}" })),
    ).toBe(true);
  });
});
