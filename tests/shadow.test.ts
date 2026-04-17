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

  it.fails(
    "gap: spec allows $value to be an array of shadows (layered); schema.ts:100-109 requires a single object",
    () => {
      expect(
        isValid(Shadow({ $type: "shadow", $value: [singleShadow] })),
      ).toBe(true);
    },
  );

  it.fails(
    "gap: spec allows an optional `inset: boolean` property; schema.ts:100-109 does not declare it",
    () => {
      // arktype currently ignores extras rather than typing `inset`, so a
      // non-boolean slips through. Failing this test pins that behavior.
      expect(
        isInvalid(
          Shadow({
            $type: "shadow",
            $value: { ...singleShadow, inset: "yes-please" },
          }),
        ),
      ).toBe(true);
    },
  );
});
