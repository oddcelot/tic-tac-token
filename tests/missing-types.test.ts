import { describe, expect, it } from "vitest";
import * as schema from "../schema.ts";
import { isValid } from "./helpers.ts";

// Each of these pins a token type that the DTCG spec defines but schema.ts
// has not yet implemented. Failing (= passing via `it.fails`) means the gap
// is still open; once a type is added, the corresponding test will start
// passing as a regular `it` and this file should be pruned.

describe("DTCG composite types missing from schema.ts", () => {
  it.fails("gap: `Border` export missing (DTCG §9.4)", () => {
    expect("Border" in schema).toBe(true);
  });

  it.fails("gap: `Transition` export missing (DTCG §9.5)", () => {
    expect("Transition" in schema).toBe(true);
  });

  it.fails("gap: `Gradient` export missing (DTCG §9.7)", () => {
    expect("Gradient" in schema).toBe(true);
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
