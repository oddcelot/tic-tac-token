import { describe, expect, it } from "vitest";
import { Color } from "../schema.ts";

describe("vitest toolchain smoke test", () => {
  it("imports the arktype-based Color schema", () => {
    expect(typeof Color).toBe("function");
  });
});
