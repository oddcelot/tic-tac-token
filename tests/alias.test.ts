import { describe, expect, it } from "vitest";
import { Color } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

// The ValueAlias regex is /^{([^{}]+?)}$/ (src/tokens/shared.ts). We
// exercise it via any of the token schemas that compose it — Color is fine.
const aliased = (value: string) => Color({ $type: "color", $value: value });

describe("curly-brace alias regex (DTCG §7.1)", () => {
  it("accepts a simple token reference", () => {
    expect(isValid(aliased("{colors.primary}"))).toBe(true);
  });

  it("accepts a deep path reference", () => {
    expect(isValid(aliased("{brand.colors.primary.base}"))).toBe(true);
  });

  it("accepts a single-segment reference", () => {
    expect(isValid(aliased("{accent}"))).toBe(true);
  });

  it("rejects a string that does not start and end with braces", () => {
    expect(isInvalid(aliased("colors.primary"))).toBe(true);
    expect(isInvalid(aliased("{colors.primary"))).toBe(true);
    expect(isInvalid(aliased("colors.primary}"))).toBe(true);
  });

  it("rejects nested braces inside the reference body", () => {
    expect(isInvalid(aliased("{outer.{inner}}"))).toBe(true);
  });

  it("rejects empty alias body", () => {
    expect(isInvalid(aliased("{}"))).toBe(true);
  });
});
