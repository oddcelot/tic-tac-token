import { describe, expect, it } from "vitest";
import { Color } from "../src/index.ts";

describe("vitest toolchain smoke test", () => {
  it("imports the arktype-based Color schema", () => {
    expect(typeof Color).toBe("function");
  });
});
