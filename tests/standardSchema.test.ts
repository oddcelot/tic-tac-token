import { describe, expect, it } from "vitest";
import { Color, Token, TokensFile } from "../src/index.ts";

// arktype 2.x exposes the Standard Schema interface on every Type via the
// `~standard` property. This test pins that exposure so consumers can
// rely on `<Validator>['~standard']` without depending on arktype types
// directly.
//
// Per the Standard Schema spec, `validate()` may return a Result or a
// Promise<Result>. arktype is synchronous in practice, but we `await`
// to demonstrate the correct cross-vendor pattern.

describe("Standard Schema interface", () => {
  it("Token exposes ~standard with arktype vendor", () => {
    expect(Token["~standard"].vendor).toBe("arktype");
    expect(Token["~standard"].version).toBe(1);
  });

  it("Token['~standard'].validate accepts a valid token", async () => {
    const result = await Token["~standard"].validate({
      $type: "color",
      $value: {
        colorSpace: "srgb",
        components: [1, 0, 0],
        alpha: 1,
        hex: "#ff0000",
      },
    });
    expect(result.issues).toBeUndefined();
    expect("value" in result).toBe(true);
  });

  it("Token['~standard'].validate reports issues for an invalid token", async () => {
    const result = await Token["~standard"].validate({
      $type: "color",
      $value: "not-a-color-object",
    });
    expect(result.issues).toBeDefined();
    expect(result.issues?.length).toBeGreaterThan(0);
  });

  it("TokensFile validates a nested document via ~standard", async () => {
    const result = await TokensFile["~standard"].validate({
      colors: {
        $type: "color",
        primary: {
          $value: {
            colorSpace: "srgb",
            components: [0, 0.5, 1],
            alpha: 1,
            hex: "#0080ff",
          },
        },
      },
    });
    expect(result.issues).toBeUndefined();
    expect("value" in result).toBe(true);
  });

  it("per-type validators (Color) expose ~standard", async () => {
    const result = await Color["~standard"].validate({
      $type: "color",
      $value: {
        colorSpace: "oklch",
        components: [0.7, 0.2, 30],
      },
    });
    expect(result.issues).toBeUndefined();
  });
});
