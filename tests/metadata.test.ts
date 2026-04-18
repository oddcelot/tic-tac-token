import { describe, expect, it } from "vitest";
import * as schema from "../src/index.ts";
import { isValid } from "./helpers.ts";

describe("Token reserved-key strictness (DTCG §5.1 + format/token.json additionalProperties:false)", () => {
  it("rejects an unknown $-prefixed property on a token", () => {
    const out = schema.Token({
      $type: "number",
      $value: 1,
      $unknown: "should be rejected",
    });
    expect(isValid(out)).toBe(false);
  });

  it("rejects an unknown non-$-prefixed property on a token", () => {
    const out = schema.Token({
      $type: "number",
      $value: 1,
      notes: "this is not a reserved key",
    });
    expect(isValid(out)).toBe(false);
  });
});

describe("DTCG format features — $deprecated shape (spec: boolean | string)", () => {
  it("accepts $deprecated: true", () => {
    const out = schema.Token({
      $type: "number",
      $value: 1,
      $deprecated: true,
    });
    expect(isValid(out)).toBe(true);
  });

  it("accepts $deprecated: false", () => {
    const out = schema.Token({
      $type: "number",
      $value: 1,
      $deprecated: false,
    });
    expect(isValid(out)).toBe(true);
  });

  it("accepts $deprecated: an explanation string", () => {
    const out = schema.Token({
      $type: "number",
      $value: 1,
      $deprecated: "use {new.token} instead",
    });
    expect(isValid(out)).toBe(true);
  });
});
