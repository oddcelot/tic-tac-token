import { describe, expect, it } from "vitest";
import { Typography } from "../schema.ts";
import { isInvalid, isValid } from "./helpers.ts";

const base = {
  fontFamily: "Roboto",
  fontSize: { value: 42, unit: "px" },
  fontWeight: 700,
  letterSpacing: { value: 0.1, unit: "px" },
  lineHeight: 1.2,
} as const;

describe("typography token (DTCG §9.8)", () => {
  it("accepts a full typography $value", () => {
    expect(isValid(Typography({ $type: "typography", $value: base }))).toBe(
      true,
    );
  });

  it("accepts a fontFamily fallback stack inside typography", () => {
    expect(
      isValid(
        Typography({
          $type: "typography",
          $value: { ...base, fontFamily: ["Roboto", "Helvetica", "sans-serif"] },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a fontWeight alias inside typography", () => {
    expect(
      isValid(
        Typography({
          $type: "typography",
          $value: { ...base, fontWeight: "bold" },
        }),
      ),
    ).toBe(true);
  });

  it("accepts curly-brace refs for each sub-value", () => {
    expect(
      isValid(
        Typography({
          $type: "typography",
          $value: {
            fontFamily: "{type.sans}",
            fontSize: "{size.lg}",
            fontWeight: "{weight.bold}",
            letterSpacing: "{tracking.normal}",
            lineHeight: "{leading.body}",
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a curly-brace alias as the whole $value", () => {
    expect(
      isValid(Typography({ $type: "typography", $value: "{text.body}" })),
    ).toBe(true);
  });

  it("rejects an unknown fontWeight alias", () => {
    expect(
      isInvalid(
        Typography({
          $type: "typography",
          $value: { ...base, fontWeight: "heaviest" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a non-dimension fontSize", () => {
    expect(
      isInvalid(
        Typography({
          $type: "typography",
          $value: { ...base, fontSize: 42 },
        }),
      ),
    ).toBe(true);
  });
});
