import { describe, expect, it } from "vitest";
import { Group, Token } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

// The DTCG JSON schema allows a token to omit $type — in that case $value
// is validated against the union of all value shapes ("guess by shape").
// This is the prose/schema contradiction we're matching the schema on.

describe("typeless token (DTCG format/token.json fallback)", () => {
  it("accepts a typeless color-shaped $value", () => {
    expect(
      isValid(
        Token({
          $value: {
            colorSpace: "srgb",
            components: [1, 0, 0],
            alpha: 1,
            hex: "#ff0000",
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a typeless dimension-shaped $value", () => {
    expect(isValid(Token({ $value: { value: 16, unit: "px" } }))).toBe(true);
  });

  it("accepts a typeless number $value", () => {
    expect(isValid(Token({ $value: 1.5 }))).toBe(true);
  });

  it("accepts a typeless fontFamily stack $value", () => {
    expect(isValid(Token({ $value: ["Inter", "sans-serif"] }))).toBe(true);
  });

  it("accepts a typeless curly-brace alias $value", () => {
    expect(isValid(Token({ $value: "{colors.primary}" }))).toBe(true);
  });

  it("accepts a typeless token with only sibling metadata", () => {
    expect(
      isValid(
        Token({
          $value: { value: 1.5, unit: "s" },
          $description: "slow animation",
        }),
      ),
    ).toBe(true);
  });

  it("rejects a typeless $value that matches no known value shape", () => {
    expect(
      isInvalid(Token({ $value: { arbitrary: "nonsense" } })),
    ).toBe(true);
  });

  it("rejects a typeless token with unknown $-sibling", () => {
    expect(
      isInvalid(
        Token({
          $value: 1,
          $mystery: true,
        } as never),
      ),
    ).toBe(true);
  });

  it("accepts a typeless token inside a group that declares a $type", () => {
    // The group-level $type inheritance is conceptual (validators can't
    // enforce it in isolation); this just confirms typeless tokens nest.
    expect(
      isValid(
        Group({
          $type: "color",
          primary: {
            $value: {
              colorSpace: "srgb",
              components: [0, 0, 1],
              alpha: 1,
              hex: "#0000ff",
            },
          },
        }),
      ),
    ).toBe(true);
  });
});
