import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";
import { buildCssVarIndex, tokenPathToCssVar } from "../src/utils/css-vars.ts";
import { WorkspaceIndex } from "../src/workspace/index.ts";

describe("tokenPathToCssVar", () => {
  it("kebab-joins path segments with a -- prefix", () => {
    expect(tokenPathToCssVar("color.brand.primary")).toBe("--color-brand-primary");
    expect(tokenPathToCssVar("space")).toBe("--space");
  });

  it("kebab-cases camelCase segments", () => {
    expect(tokenPathToCssVar("space.itemGap")).toBe("--space-item-gap");
    expect(tokenPathToCssVar("color.brandPrimary.hover")).toBe("--color-brand-primary-hover");
  });

  it("excludes mode variants (@ is invalid in a var name)", () => {
    expect(tokenPathToCssVar("color.brand.primary@dark")).toBeUndefined();
  });

  it("rejects empty / malformed paths", () => {
    expect(tokenPathToCssVar("")).toBeUndefined();
    expect(tokenPathToCssVar("color..primary")).toBeUndefined();
  });
});

describe("buildCssVarIndex", () => {
  it("maps every non-mode token's css var to its indexed token", async () => {
    const text = JSON.stringify({
      color: {
        $type: "color",
        brand: {
          primary: {
            $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
            $extensions: {
              "tic-tac-token.modes": {
                dark: { colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" },
              },
            },
          },
        },
      },
    });
    const index = new WorkspaceIndex();
    index.upsert("file:///base.tokens.json", await analyze(text));

    const map = buildCssVarIndex(index);
    expect(map.get("--color-brand-primary")?.token.path).toBe("color.brand.primary");
    // the @dark mode variant must not produce a css var
    expect([...map.keys()].some((k) => k.includes("dark"))).toBe(false);
  });

  it("first writer wins on collision across files", async () => {
    const a = await analyze(
      JSON.stringify({ color: { $type: "color", x: { $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" } } } }),
    );
    const b = await analyze(
      JSON.stringify({ color: { $type: "color", x: { $value: { colorSpace: "srgb", components: [0, 0, 1], hex: "#0000ff" } } } }),
    );
    const index = new WorkspaceIndex();
    index.upsert("file:///a.tokens.json", a);
    index.upsert("file:///b.tokens.json", b);
    const map = buildCssVarIndex(index);
    // a.tokens.json sorts first → its token wins deterministically
    expect(map.get("--color-x")?.uri).toBe("file:///a.tokens.json");
  });
});
