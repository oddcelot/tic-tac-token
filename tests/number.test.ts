import { describe, expect, it } from "vitest";
import { Number as NumberToken } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

describe("number token (DTCG §8.7)", () => {
  it("accepts an integer", () => {
    expect(isValid(NumberToken({ $type: "number", $value: 42 }))).toBe(true);
  });

  it("accepts a float", () => {
    expect(isValid(NumberToken({ $type: "number", $value: 1.2 }))).toBe(true);
  });

  it("accepts zero and negative values", () => {
    expect(isValid(NumberToken({ $type: "number", $value: 0 }))).toBe(true);
    expect(isValid(NumberToken({ $type: "number", $value: -3.14 }))).toBe(true);
  });

  it("rejects non-numbers", () => {
    expect(isInvalid(NumberToken({ $type: "number", $value: "42" }))).toBe(
      true,
    );
  });

  it("accepts a curly-brace alias", () => {
    expect(
      isValid(NumberToken({ $type: "number", $value: "{line.height.base}" })),
    ).toBe(true);
  });
});
