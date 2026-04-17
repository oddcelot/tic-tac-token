import { describe, expect, it } from "vitest";
import { Dimension } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

describe("dimension token (DTCG §8.2)", () => {
  it("accepts px", () => {
    expect(
      isValid(Dimension({ $type: "dimension", $value: { value: 16, unit: "px" } })),
    ).toBe(true);
  });

  it("accepts rem", () => {
    expect(
      isValid(
        Dimension({ $type: "dimension", $value: { value: 0.5, unit: "rem" } }),
      ),
    ).toBe(true);
  });

  it("accepts a float value", () => {
    expect(
      isValid(
        Dimension({ $type: "dimension", $value: { value: 1.25, unit: "rem" } }),
      ),
    ).toBe(true);
  });

  it("accepts zero (both value and unit still required)", () => {
    expect(
      isValid(Dimension({ $type: "dimension", $value: { value: 0, unit: "px" } })),
    ).toBe(true);
  });

  it("rejects other units (em, %, pt)", () => {
    expect(
      isInvalid(
        Dimension({ $type: "dimension", $value: { value: 1, unit: "em" } }),
      ),
    ).toBe(true);
    expect(
      isInvalid(
        Dimension({ $type: "dimension", $value: { value: 100, unit: "%" } }),
      ),
    ).toBe(true);
    expect(
      isInvalid(
        Dimension({ $type: "dimension", $value: { value: 12, unit: "pt" } }),
      ),
    ).toBe(true);
  });

  it("rejects a missing unit", () => {
    expect(
      isInvalid(Dimension({ $type: "dimension", $value: { value: 16 } })),
    ).toBe(true);
  });

  it("accepts a curly-brace alias", () => {
    expect(
      isValid(Dimension({ $type: "dimension", $value: "{sizing.base}" })),
    ).toBe(true);
  });
});
