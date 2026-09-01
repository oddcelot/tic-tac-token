import { describe, expect, it } from "vitest";
import { resolveTokens } from "../../src/resolver/index.ts";

const dim = (value: number, unit: "px" | "rem" = "px") => ({
  $type: "dimension" as const,
  $value: { value, unit },
});

const color = (r: number, g: number, b: number, hex: string) => ({
  $type: "color" as const,
  $value: {
    colorSpace: "srgb",
    components: [r, g, b],
    alpha: 1,
    hex,
  },
});

// DTCG 2025.10 format §7.4.5/§7.5.3 and resolver §6.3: an alias must point
// at a token of the referencing token's $type.
describe("alias type mismatches", () => {
  it("reports a mismatch when an alias targets a different $type", () => {
    const result = resolveTokens({
      size: dim(16),
      accent: { $type: "color", $value: "{size}" },
    });
    const mismatches = result.errors.filter((e) => e.kind === "type-mismatch");
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.at).toBe("accent");
    expect(mismatches[0]?.target).toBe("size");
  });

  it("accepts a same-type alias chain", () => {
    const result = resolveTokens({
      base: dim(16),
      middle: { $type: "dimension", $value: "{base}" },
      leaf: { $type: "dimension", $value: "{middle}" },
    });
    expect(result.errors).toEqual([]);
    expect(result.byPath.get("leaf")?.$value).toEqual({
      value: 16,
      unit: "px",
    });
  });

  it("reports the first diverging hop in a transitive chain", () => {
    const result = resolveTokens({
      c: color(1, 0, 0, "#ff0000"),
      b: { $type: "dimension", $value: "{c}" },
      a: { $type: "color", $value: "{b}" },
    });
    const mismatches = result.errors.filter((e) => e.kind === "type-mismatch");
    expect(mismatches.map((e) => e.at).sort()).toEqual(["a", "b"]);
  });

  it("does not flag an alias embedded in a composite sub-value", () => {
    const result = resolveTokens({
      brand: color(1, 0, 0, "#ff0000"),
      fade: {
        $type: "gradient",
        $value: [
          { color: "{brand}", position: 0 },
          { color: "{brand}", position: 1 },
        ],
      },
    });
    expect(result.errors).toEqual([]);
  });

  it("checks mode-expanded tokens against their own $type", () => {
    const result = resolveTokens({
      size: dim(16),
      accent: {
        ...color(1, 0, 0, "#ff0000"),
        $extensions: { "tic-tac-token.modes": { dark: "{size}" } },
      },
    });
    const mismatches = result.errors.filter((e) => e.kind === "type-mismatch");
    expect(mismatches.map((e) => e.at)).toEqual(["accent@dark"]);
  });

  it("reports every call site referencing the same mismatched target", () => {
    const result = resolveTokens({
      size: dim(16),
      one: { $type: "color", $value: "{size}" },
      two: { $type: "color", $value: "{size}" },
    });
    const mismatches = result.errors.filter((e) => e.kind === "type-mismatch");
    expect(mismatches.map((e) => e.at).sort()).toEqual(["one", "two"]);
  });

  it("still resolves the value alongside the mismatch error", () => {
    const result = resolveTokens({
      size: dim(16),
      accent: { $type: "color", $value: "{size}" },
    });
    expect(result.byPath.get("accent")?.$value).toEqual({
      value: 16,
      unit: "px",
    });
  });

  it("reports a mismatch against a $root target", () => {
    const result = resolveTokens({
      space: { $root: dim(16) },
      accent: { $type: "color", $value: "{space.$root}" },
    });
    const mismatches = result.errors.filter((e) => e.kind === "type-mismatch");
    expect(mismatches.map((e) => e.at)).toEqual(["accent"]);
  });
});
