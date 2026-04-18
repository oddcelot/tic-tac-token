import { describe, expect, it } from "vitest";
import { FontFamily } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

describe("fontFamily token (DTCG §8.3)", () => {
  it("accepts a single family string", () => {
    expect(
      isValid(FontFamily({ $type: "fontFamily", $value: "Comic Sans MS" })),
    ).toBe(true);
  });

  it("accepts an ordered fallback stack", () => {
    expect(
      isValid(
        FontFamily({
          $type: "fontFamily",
          $value: ["Helvetica", "Arial", "sans-serif"],
        }),
      ),
    ).toBe(true);
  });

  it("accepts a curly-brace alias", () => {
    expect(
      isValid(FontFamily({ $type: "fontFamily", $value: "{type.sans}" })),
    ).toBe(true);
  });

  it("rejects an array containing non-strings", () => {
    expect(
      isInvalid(
        FontFamily({ $type: "fontFamily", $value: ["Helvetica", 42] }),
      ),
    ).toBe(true);
  });

  it("rejects an empty fallback-stack array (spec: minItems 1)", () => {
    expect(
      isInvalid(FontFamily({ $type: "fontFamily", $value: [] })),
    ).toBe(true);
  });
});
