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

describe("resolveTokens (full pipeline)", () => {
  it("flattens a simple document", () => {
    const result = resolveTokens({
      space: { md: dim(16) },
    });
    expect(result.errors).toEqual([]);
    expect(result.tokens.map((t) => t.path)).toEqual(["space.md"]);
    expect(result.byPath.get("space.md")?.$value).toEqual({ value: 16, unit: "px" });
  });

  it("inherits $type from an ancestor group", () => {
    const result = resolveTokens({
      colors: {
        $type: "color",
        primary: {
          $value: {
            colorSpace: "srgb",
            components: [0, 0, 1],
            alpha: 1,
            hex: "#0000ff",
          },
        },
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.byPath.get("colors.primary")?.$type).toBe("color");
  });

  it("reports an error when no $type is resolvable", () => {
    const result = resolveTokens({
      mystery: { $value: 42 },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe("type-mismatch");
  });

  it("resolves a curly-brace alias to the target value", () => {
    const result = resolveTokens({
      color: {
        primary: color(1, 0, 0, "#ff0000"),
        accent: { $type: "color", $value: "{color.primary}" },
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.byPath.get("color.accent")?.$value).toEqual({
      colorSpace: "srgb",
      components: [1, 0, 0],
      alpha: 1,
      hex: "#ff0000",
    });
  });

  it("reports a broken alias", () => {
    const result = resolveTokens({
      color: {
        accent: { $type: "color", $value: "{color.missing}" },
      },
    });
    expect(result.errors.some((e) => e.kind === "broken-alias")).toBe(true);
  });

  it("detects an alias cycle", () => {
    const result = resolveTokens({
      a: { $type: "color", $value: "{b}" },
      b: { $type: "color", $value: "{a}" },
    });
    expect(result.errors.some((e) => e.kind === "alias-cycle")).toBe(true);
  });

  it("populates the reverse-reference graph", () => {
    const result = resolveTokens({
      color: {
        primary: color(1, 0, 0, "#ff0000"),
        accent: { $type: "color", $value: "{color.primary}" },
        border: { $type: "color", $value: "{color.primary}" },
      },
    });
    expect(result.references.get("color.primary")).toEqual(
      new Set(["color.accent", "color.border"]),
    );
  });

  it("resolves a nested $ref inside a composite value", () => {
    const result = resolveTokens({
      space: { md: dim(16) },
      layout: {
        $type: "dimension",
        gap: { $value: { value: { $ref: "#/space/md/$value/value" }, unit: "rem" } },
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.byPath.get("layout.gap")?.$value).toEqual({ value: 16, unit: "rem" });
  });

  it("reports a broken token-root $ref", () => {
    const result = resolveTokens({
      color: {
        $type: "color",
        ref: { $type: "color", $ref: "#/color/missing/$value" },
      },
    });
    expect(result.errors.some((e) => e.kind === "broken-ref")).toBe(true);
  });

  it("reports a broken nested $ref inside a composite value", () => {
    const result = resolveTokens({
      space: {
        $type: "dimension",
        gap: {
          $value: { value: { $ref: "#/space/nonexistent/$value/value" }, unit: "rem" },
        },
      },
    });
    expect(result.errors.some((e) => e.kind === "broken-ref")).toBe(true);
  });

  it("detects a $ref cycle", () => {
    const result = resolveTokens({
      a: { $type: "color", $ref: "#/b" },
      b: { $type: "color", $ref: "#/a" },
    });
    expect(result.errors.some((e) => e.kind === "ref-cycle")).toBe(true);
  });

  it("resolves a token-root $ref", () => {
    const result = resolveTokens({
      color: {
        primary: color(1, 0, 0, "#ff0000"),
        accent: { $type: "color", $ref: "#/color/primary/$value" },
      },
    });
    expect(result.byPath.get("color.accent")?.$value).toEqual({
      colorSpace: "srgb",
      components: [1, 0, 0],
      alpha: 1,
      hex: "#ff0000",
    });
  });

  it("clamps out-of-range gradient positions to [0, 1]", () => {
    const result = resolveTokens({
      gradients: {
        rainbow: {
          $type: "gradient",
          $value: [
            { color: { colorSpace: "srgb", components: [1, 0, 0] }, position: -0.5 },
            { color: { colorSpace: "srgb", components: [0, 0, 1] }, position: 1.5 },
          ],
        },
      },
    });
    const stops = result.byPath.get("gradients.rainbow")?.$value as Array<{
      position: number;
    }>;
    expect(stops[0]?.position).toBe(0);
    expect(stops[1]?.position).toBe(1);
  });

  it("applies $extends deep-merge inheritance", () => {
    const result = resolveTokens({
      brand: {
        $type: "color",
        primary: color(1, 0, 0, "#ff0000"),
        accent: color(0, 1, 0, "#00ff00"),
      },
      themed: {
        $type: "color",
        $extends: "{brand}",
        accent: color(0, 0, 1, "#0000ff"),
      },
    });
    expect(result.errors).toEqual([]);
    // Inherited token survives
    expect(result.byPath.get("themed.primary")?.$value).toMatchObject({
      hex: "#ff0000",
    });
    // Local override wins
    expect(result.byPath.get("themed.accent")?.$value).toMatchObject({
      hex: "#0000ff",
    });
  });

  it("detects an $extends cycle", () => {
    const result = resolveTokens({
      a: { $type: "color", $extends: "{b}", x: color(1, 0, 0, "#ff0000") },
      b: { $type: "color", $extends: "{a}", y: color(0, 1, 0, "#00ff00") },
    });
    expect(result.errors.some((e) => e.kind === "extends-cycle")).toBe(true);
  });

  it("reports a broken $extends target", () => {
    const result = resolveTokens({
      themed: { $type: "color", $extends: "{nonexistent}" },
    });
    expect(result.errors.some((e) => e.kind === "broken-extends")).toBe(true);
  });
});
