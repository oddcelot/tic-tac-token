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

  it("reports an invalid $value on a token with an inherited $type", () => {
    const result = resolveTokens({
      color: {
        $type: "color",
        brand: {
          $value: {
            colorSpace: "srgb",
            components: ["0.2", 0.4, 1],
            alpha: 1,
            hex: "#3366ff",
          },
        },
      },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe("invalid-value");
    expect(result.errors[0]?.at).toBe("color.brand.$value.components.0");
  });

  it("accepts a valid $value and an alias $value on inherited-type tokens", () => {
    const result = resolveTokens({
      color: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0.2, 0.4, 1] },
        },
        accent: { $value: "{color.primary}" },
      },
    });
    expect(result.errors).toEqual([]);
  });

  it("does not re-validate tokens with an explicit $type", () => {
    // The Token schema owns explicit-type validation; the resolver
    // pass must not double-report the same defect.
    const result = resolveTokens({
      brand: {
        $type: "color",
        $value: { colorSpace: "srgb", components: ["oops", 0, 0] },
      },
    });
    expect(result.errors).toEqual([]);
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
    expect(result.errors[0]?.target).toBe("color.missing");
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

  it("applies $extends via a JSON Pointer $ref form", () => {
    const result = resolveTokens({
      brand: {
        $type: "color",
        primary: color(1, 0, 0, "#ff0000"),
        accent: color(0, 1, 0, "#00ff00"),
      },
      themed: {
        $type: "color",
        $extends: { $ref: "#/brand" },
        accent: color(0, 0, 1, "#0000ff"),
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.byPath.get("themed.primary")?.$value).toMatchObject({
      hex: "#ff0000",
    });
    expect(result.byPath.get("themed.accent")?.$value).toMatchObject({
      hex: "#0000ff",
    });
  });

  it("detects an $extends cycle spanning both reference forms", () => {
    const result = resolveTokens({
      a: {
        $type: "color",
        $extends: { $ref: "#/b" },
        x: color(1, 0, 0, "#ff0000"),
      },
      b: { $type: "color", $extends: "{a}", y: color(0, 1, 0, "#00ff00") },
    });
    expect(result.errors.some((e) => e.kind === "extends-cycle")).toBe(true);
  });

  it("reports a broken $extends target given a dangling $ref", () => {
    const result = resolveTokens({
      themed: { $type: "color", $extends: { $ref: "#/nonexistent" } },
    });
    expect(result.errors.some((e) => e.kind === "broken-extends")).toBe(true);
  });

  it("reports a broken $extends when a $ref resolves to a token", () => {
    const result = resolveTokens({
      brand: { $type: "color", primary: color(1, 0, 0, "#ff0000") },
      themed: { $type: "color", $extends: { $ref: "#/brand/primary" } },
    });
    expect(result.errors.some((e) => e.kind === "broken-extends")).toBe(true);
  });

  it("expands $extensions.tic-tac-token.modes into separate flat tokens", () => {
    const result = resolveTokens({
      color: {
        brand: {
          accent: {
            $type: "color",
            $value: { colorSpace: "srgb", components: [1, 0.4, 0.5], alpha: 1, hex: "#FF6680" },
            $extensions: {
              "tic-tac-token.modes": {
                "dark": { colorSpace: "srgb", components: [1, 0.56, 0.64], alpha: 1, hex: "#FF8FA3" },
              },
            },
          },
        },
      },
    });
    expect(result.errors).toEqual([]);
    const paths = result.tokens.map((t) => t.path);
    expect(paths).toContain("color.brand.accent");
    expect(paths).toContain("color.brand.accent@dark");

    const dark = result.byPath.get("color.brand.accent@dark")!;
    expect(dark.mode).toBe("dark");
    expect((dark.$value as Record<string, unknown>).hex).toBe("#FF8FA3");
  });
});
