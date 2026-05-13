import { describe, expect, it } from "vitest";
import { jsonPointerGet } from "../../src/resolver/index.ts";

describe("jsonPointerGet (RFC 6901)", () => {
  const root = {
    a: { b: { c: 42 } },
    arr: [10, 20, 30],
    "weird/key": "slash",
    "weird~tilde": "tilde",
  };

  it("walks object paths", () => {
    expect(jsonPointerGet(root, "#/a/b/c")).toBe(42);
  });

  it("walks array indices", () => {
    expect(jsonPointerGet(root, "#/arr/1")).toBe(20);
  });

  it("decodes ~1 to /", () => {
    expect(jsonPointerGet(root, "#/weird~1key")).toBe("slash");
  });

  it("decodes ~0 to ~", () => {
    expect(jsonPointerGet(root, "#/weird~0tilde")).toBe("tilde");
  });

  it("returns undefined for unknown segments", () => {
    expect(jsonPointerGet(root, "#/a/missing")).toBeUndefined();
  });

  it("returns undefined for malformed prefix", () => {
    expect(jsonPointerGet(root, "/a/b/c")).toBeUndefined();
    expect(jsonPointerGet(root, "http://x")).toBeUndefined();
  });

  it("returns undefined for non-integer array index", () => {
    expect(jsonPointerGet(root, "#/arr/foo")).toBeUndefined();
  });

  it("returns undefined when walking past a primitive", () => {
    expect(jsonPointerGet(root, "#/a/b/c/anything")).toBeUndefined();
  });
});
