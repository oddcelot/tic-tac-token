import { describe, expect, it } from "vitest";
import * as schema from "../src/index.ts";
import { isValid } from "./helpers.ts";

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
