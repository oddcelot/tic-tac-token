import { describe, expect, it } from "vitest";
import { FontWeight } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

describe("fontWeight token (DTCG §8.4)", () => {
  it("accepts a numeric weight in [1, 1000]", () => {
    expect(isValid(FontWeight({ $type: "fontWeight", $value: 1 }))).toBe(true);
    expect(isValid(FontWeight({ $type: "fontWeight", $value: 400 }))).toBe(true);
    expect(isValid(FontWeight({ $type: "fontWeight", $value: 1000 }))).toBe(
      true,
    );
  });

  it("accepts a fractional numeric weight (spec allows floats)", () => {
    expect(isValid(FontWeight({ $type: "fontWeight", $value: 350 }))).toBe(
      true,
    );
  });

  it("rejects numeric weights outside [1, 1000]", () => {
    expect(isInvalid(FontWeight({ $type: "fontWeight", $value: 0 }))).toBe(
      true,
    );
    expect(isInvalid(FontWeight({ $type: "fontWeight", $value: 1001 }))).toBe(
      true,
    );
    expect(isInvalid(FontWeight({ $type: "fontWeight", $value: 2000 }))).toBe(
      true,
    );
  });

  const validAliases = [
    "thin",
    "hairline",
    "extra-light",
    "ultra-light",
    "light",
    "normal",
    "regular",
    "book",
    "medium",
    "semi-bold",
    "demi-bold",
    "bold",
    "extra-bold",
    "ultra-bold",
    "black",
    "heavy",
    "extra-black",
    "ultra-black",
  ];

  it.each(validAliases)("accepts the alias %s", (alias) => {
    expect(isValid(FontWeight({ $type: "fontWeight", $value: alias }))).toBe(
      true,
    );
  });

  it("rejects unknown alias strings", () => {
    expect(isInvalid(FontWeight({ $type: "fontWeight", $value: "ultra" }))).toBe(
      true,
    );
    expect(
      isInvalid(FontWeight({ $type: "fontWeight", $value: "Bold" })),
    ).toBe(true);
  });

  it("accepts a curly-brace alias", () => {
    expect(
      isValid(FontWeight({ $type: "fontWeight", $value: "{weight.bold}" })),
    ).toBe(true);
  });
});
