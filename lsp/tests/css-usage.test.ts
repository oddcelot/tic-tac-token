import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";
import {
  cssVarColorPresentations,
  cssVarColors,
  cssVarHover,
} from "../src/handlers/css-usage.ts";
import { WorkspaceIndex } from "../src/workspace/index.ts";

async function indexWith(text: string, uri = "file:///theme.tokens.json") {
  const index = new WorkspaceIndex();
  index.upsert(uri, await analyze(text));
  return index;
}

const TOKENS = JSON.stringify({
  color: {
    $type: "color",
    brand: {
      primary: { $value: { colorSpace: "srgb", components: [0.42, 0.31, 0.9], hex: "#6C4FE5" } },
    },
  },
  space: {
    $type: "dimension",
    itemGap: { $value: { value: 8, unit: "px" } },
  },
});

function lineCharOfCss(css: string, needle: string) {
  const idx = css.indexOf(needle);
  const before = css.slice(0, idx);
  return { line: (before.match(/\n/g) ?? []).length, character: idx - (before.lastIndexOf("\n") + 1) };
}

describe("cssVarColors", () => {
  it("emits a swatch on a var() that maps to a color token", async () => {
    const index = await indexWith(TOKENS);
    const css = `.btn { color: var(--color-brand-primary); }`;
    const colors = cssVarColors(css, index);
    expect(colors).toHaveLength(1);
    expect(colors[0]!.color.red).toBeCloseTo(0.42, 2);
    // range covers the --color-brand-primary identifier
    const start = css.indexOf("--color-brand-primary");
    expect(colors[0]!.range.start.character).toBe(start);
    expect(colors[0]!.range.end.character).toBe(start + "--color-brand-primary".length);
  });

  it("ignores var() mapping to a non-color token", async () => {
    const index = await indexWith(TOKENS);
    const css = `.btn { gap: var(--space-item-gap); }`;
    expect(cssVarColors(css, index)).toHaveLength(0);
  });

  it("ignores unknown var() names", async () => {
    const index = await indexWith(TOKENS);
    const css = `.btn { color: var(--nope-not-a-token); }`;
    expect(cssVarColors(css, index)).toHaveLength(0);
  });

  it("handles var() with a fallback and multiple usages", async () => {
    const index = await indexWith(TOKENS);
    const css = `a { color: var(--color-brand-primary, #000); }\nb { border-color: var( --color-brand-primary ); }`;
    expect(cssVarColors(css, index)).toHaveLength(2);
  });
});

describe("cssVarHover", () => {
  it("resolves a color var to its token, value, and source file", async () => {
    const index = await indexWith(TOKENS);
    const css = `.btn { color: var(--color-brand-primary); }`;
    const hover = cssVarHover(css, lineCharOfCss(css, "color-brand-primary"), index);
    expect(hover).toBeDefined();
    const md = (hover!.contents as { value: string }).value;
    expect(md).toContain("--color-brand-primary");
    expect(md).toContain("color.brand.primary");
    expect(md).toContain("#6C4FE5");
    expect(md).toContain("theme.tokens.json");
  });

  it("resolves a non-color var too (dimension), no swatch needed", async () => {
    const index = await indexWith(TOKENS);
    const css = `.btn { gap: var(--space-item-gap); }`;
    const hover = cssVarHover(css, lineCharOfCss(css, "space-item-gap"), index);
    expect(hover).toBeDefined();
    const md = (hover!.contents as { value: string }).value;
    expect(md).toContain("space.itemGap");
  });

  it("returns undefined when the cursor is not on a var()", async () => {
    const index = await indexWith(TOKENS);
    const css = `.btn { color: red; }`;
    expect(cssVarHover(css, lineCharOfCss(css, "red"), index)).toBeUndefined();
  });
});

describe("cssVarColorPresentations", () => {
  it("returns a hex label with no text edit", () => {
    const pres = cssVarColorPresentations({ red: 1, green: 0, blue: 0, alpha: 1 });
    expect(pres).toEqual([{ label: "#ff0000" }]);
  });
});
