import { describe, expect, it } from "vitest";
import { CubicBezier } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

describe("cubicBezier token (DTCG §8.6)", () => {
  it("accepts a standard ease-out", () => {
    expect(
      isValid(CubicBezier({ $type: "cubicBezier", $value: [0, 0, 0.58, 1] })),
    ).toBe(true);
  });

  it("accepts negative y values (P1y, P2y are unbounded)", () => {
    expect(
      isValid(
        CubicBezier({ $type: "cubicBezier", $value: [0.5, -0.5, 0.5, 1.5] }),
      ),
    ).toBe(true);
  });

  it("rejects P1x outside [0, 1]", () => {
    expect(
      isInvalid(
        CubicBezier({ $type: "cubicBezier", $value: [1.5, 0, 1, 1] }),
      ),
    ).toBe(true);
  });

  it("rejects P2x outside [0, 1]", () => {
    expect(
      isInvalid(
        CubicBezier({ $type: "cubicBezier", $value: [0, 0, -0.1, 1] }),
      ),
    ).toBe(true);
  });

  it("rejects arrays not of length 4", () => {
    expect(
      isInvalid(CubicBezier({ $type: "cubicBezier", $value: [0, 0, 1] })),
    ).toBe(true);
    expect(
      isInvalid(
        CubicBezier({ $type: "cubicBezier", $value: [0, 0, 1, 1, 0] }),
      ),
    ).toBe(true);
  });

  it("accepts a curly-brace alias", () => {
    expect(
      isValid(CubicBezier({ $type: "cubicBezier", $value: "{easing.linear}" })),
    ).toBe(true);
  });
});
