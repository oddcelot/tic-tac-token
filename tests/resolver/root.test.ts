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

// DTCG 2025.10 §6.2 (root tokens in groups) + §6.7.2 (path construction).
describe("$root tokens (DTCG §6.2)", () => {
  it("flattens a document-level $root token", () => {
    const result = resolveTokens({
      $root: dim(16),
      space: { md: dim(8) },
    });
    expect(result.errors).toEqual([]);
    expect(result.tokens.map((t) => t.path).sort()).toEqual([
      "$root",
      "space.md",
    ]);
    expect(result.byPath.get("$root")?.$value).toEqual({
      value: 16,
      unit: "px",
    });
  });

  it("flattens a nested group's $root token at <group>.$root", () => {
    const result = resolveTokens({
      color: {
        accent: {
          $root: color(1, 0, 0, "#ff0000"),
          hover: color(0, 1, 0, "#00ff00"),
        },
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.byPath.get("color.accent.$root")?.$value).toMatchObject({
      hex: "#ff0000",
    });
    expect(result.byPath.get("color.accent.hover")?.$value).toMatchObject({
      hex: "#00ff00",
    });
  });

  it("inherits $type from the ancestor group for a typeless $root", () => {
    const result = resolveTokens({
      space: {
        $type: "dimension",
        inline: { $root: { $value: { value: 4, unit: "rem" } } },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.byPath.get("space.inline.$root");
    expect(token?.$type).toBe("dimension");
    expect(token?.typeInherited).toBe(true);
  });

  it("expands a $root token's modes extension", () => {
    const result = resolveTokens({
      color: {
        accent: {
          $root: {
            ...color(1, 0, 0, "#ff0000"),
            $extensions: {
              "tic-tac-token.modes": {
                dark: {
                  colorSpace: "srgb",
                  components: [0, 0, 0],
                  alpha: 1,
                  hex: "#000000",
                },
              },
            },
          },
        },
      },
    });
    expect(result.errors).toEqual([]);
    expect(
      result.byPath.get("color.accent.$root@dark")?.$value,
    ).toMatchObject({ hex: "#000000" });
  });

  it("resolves {group.$root} as an alias target", () => {
    const result = resolveTokens({
      color: {
        accent: { $root: color(1, 0, 0, "#ff0000") },
        link: { $type: "color", $value: "{color.accent.$root}" },
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.byPath.get("color.link")?.$value).toMatchObject({
      hex: "#ff0000",
    });
  });

  it("resolves a bare {$root} alias at the document root", () => {
    const result = resolveTokens({
      $root: dim(16),
      alias: { $type: "dimension", $value: "{$root}" },
    });
    expect(result.errors).toEqual([]);
    expect(result.byPath.get("alias")?.$value).toEqual({
      value: 16,
      unit: "px",
    });
  });

  it("replaces an inherited $root wholesale under $extends", () => {
    const result = resolveTokens({
      brand: {
        $type: "color",
        $root: color(1, 0, 0, "#ff0000"),
        accent: color(0, 1, 0, "#00ff00"),
      },
      themed: {
        $type: "color",
        $extends: "{brand}",
        $root: color(0, 0, 1, "#0000ff"),
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.byPath.get("themed.$root")?.$value).toMatchObject({
      hex: "#0000ff",
    });
    expect(result.byPath.get("themed.accent")?.$value).toMatchObject({
      hex: "#00ff00",
    });
  });

  it("skips a malformed $root without crashing", () => {
    const result = resolveTokens({
      color: { accent: { $root: "not-a-token", hover: color(0, 1, 0, "#00ff00") } },
    });
    expect(result.errors).toEqual([]);
    expect(result.byPath.has("color.accent.$root")).toBe(false);
    expect(result.byPath.has("color.accent.hover")).toBe(true);
  });
});
