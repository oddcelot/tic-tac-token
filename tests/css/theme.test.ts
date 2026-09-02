import { describe, expect, it } from "vitest";
import { resolverDocumentToCssTheme, tokensToCssTheme } from "../../src/css.ts";
import { resolveTokens } from "../../src/resolver/index.ts";

const color = (hex: string) => ({
  $type: "color" as const,
  $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex },
});
const dim = (value: number) => ({
  $type: "dimension" as const,
  $value: { value, unit: "px" as const },
});
const alias = (target: string) => ({ $type: "color" as const, $value: `{${target}}` });

/** One `theme` modifier, two contexts. */
const oneAxis = {
  version: "2025.10",
  sets: { base: { sources: [{ size: { md: dim(16) } }] } },
  modifiers: {
    theme: {
      default: "light",
      contexts: {
        light: [{ color: { bg: color("#ffffff") } }],
        dark: [{ color: { bg: color("#000000") } }],
      },
    },
  },
  resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }],
};

describe("resolverDocumentToCssTheme", () => {
  it("emits the base under :root and one scoped block per deviating context", () => {
    const sheet = resolverDocumentToCssTheme(oneAxis);

    expect(sheet.documentErrors).toEqual([]);
    expect(sheet.diagnostics).toEqual([]);
    expect(sheet.css).toContain(":root {");
    expect(sheet.css).toContain("--color-bg: #ffffff;");
    expect(sheet.css).toContain('[data-theme="dark"] {');
    expect(sheet.css).toContain("--color-bg: #000000;");
  });

  it("keeps invariant tokens out of the delta block", () => {
    const sheet = resolverDocumentToCssTheme(oneAxis);
    const dark = sheet.blocks.find((b) => b.selector.includes("dark"))!;
    expect(dark.declarations.map((d) => d.property)).toEqual(["--color-bg"]);
    // …but the base still carries them.
    const base = sheet.blocks[0]!;
    expect(base.declarations.map((d) => d.property).sort()).toEqual(["--color-bg", "--size-md"]);
  });

  it("exposes a role index and a per-permutation matrix", () => {
    const sheet = resolverDocumentToCssTheme(oneAxis);
    expect(sheet.roles["color.bg"]).toEqual({ cssVar: "--color-bg", value: "#ffffff" });
    expect(sheet.matrix.get("--color-bg")).toEqual(
      new Map([
        ["theme=light", "#ffffff"],
        ["theme=dark", "#000000"],
      ]),
    );
  });

  it("emits no compound block for orthogonal modifiers", () => {
    const doc = {
      version: "2025.10",
      modifiers: {
        theme: {
          default: "light",
          contexts: {
            light: [{ color: { bg: color("#ffffff") } }],
            dark: [{ color: { bg: color("#000000") } }],
          },
        },
        density: {
          default: "cozy",
          contexts: { cozy: [{ size: { gap: dim(16) } }], compact: [{ size: { gap: dim(8) } }] },
        },
      },
      resolutionOrder: [{ $ref: "#/modifiers/theme" }, { $ref: "#/modifiers/density" }],
    };
    const sheet = resolverDocumentToCssTheme(doc);
    expect(sheet.blocks.filter((b) => b.conditions.length === 2)).toEqual([]);
    expect(sheet.blocks).toHaveLength(3); // :root + 2 single-axis
  });

  it("stays orthogonal when two modifiers write disjoint tokens", () => {
    // Merge order alone cannot create an interaction: whichever modifier comes
    // later in resolutionOrder simply wins on any token both touch. Genuine
    // combination-dependence needs an alias that crosses modifiers — see the
    // flattened case below.
    const doc = {
      version: "2025.10",
      modifiers: {
        theme: {
          default: "light",
          contexts: {
            light: [{ color: { bg: color("#ffffff") }, size: { gap: dim(16) } }],
            dark: [{ color: { bg: color("#000000") }, size: { gap: dim(16) } }],
          },
        },
        density: {
          default: "cozy",
          contexts: { cozy: [{}], compact: [{ size: { gap: dim(8) } }] },
        },
      },
      resolutionOrder: [{ $ref: "#/modifiers/theme" }, { $ref: "#/modifiers/density" }],
    };
    const sheet = resolverDocumentToCssTheme(doc);
    expect(sheet.blocks.filter((b) => b.conditions.length === 2)).toEqual([]);
  });

  describe("alias handling — the deduplication payoff", () => {
    // `theme` contributes palette literals; `colorScheme` contributes only
    // semantic aliases into that palette. The scheme files never mention a
    // theme, and only work because the merge precedes alias resolution.
    const layered = {
      version: "2025.10",
      modifiers: {
        theme: {
          default: "astro",
          contexts: {
            astro: [
              { palette: { surface: { subtle: color("#f7faf9"), deep: color("#0f1f1d") } } },
            ],
            cosmos: [
              { palette: { surface: { subtle: color("#faf7ff"), deep: color("#1a1030") } } },
            ],
          },
        },
        colorScheme: {
          default: "light",
          contexts: {
            light: [{ color: { background: alias("palette.surface.subtle") } }],
            dark: [{ color: { background: alias("palette.surface.deep") } }],
          },
        },
      },
      resolutionOrder: [{ $ref: "#/modifiers/theme" }, { $ref: "#/modifiers/colorScheme" }],
    };

    it("keeps a whole-value alias as var(), so the scheme block is theme-independent", () => {
      const sheet = resolverDocumentToCssTheme(layered);

      const schemeBlocks = sheet.blocks.filter((b) =>
        b.conditions.some((c) => c.axis === "colorScheme"),
      );
      expect(schemeBlocks).toHaveLength(1);
      expect(schemeBlocks[0]?.declarations).toEqual([
        { property: "--color-background", value: "var(--palette-surface-deep)" },
      ]);

      // No compound block: the cascade composes theme × scheme on its own.
      expect(sheet.blocks.filter((b) => b.conditions.length === 2)).toEqual([]);
    });

    it("flattening the same document forces a compound block per combination", () => {
      const sheet = resolverDocumentToCssTheme(layered, { aliases: "flatten" });

      const compound = sheet.blocks.filter((b) => b.conditions.length === 2);
      expect(compound.length).toBeGreaterThan(0);
      expect(compound.flatMap((b) => b.declarations.map((d) => d.property))).toContain(
        "--color-background",
      );
    });

    it("emits fewer declarations with var() than with flattened literals", () => {
      const withVars = resolverDocumentToCssTheme(layered);
      const flattened = resolverDocumentToCssTheme(layered, { aliases: "flatten" });
      const count = (s: typeof withVars) =>
        s.blocks.reduce((n, b) => n + b.declarations.length, 0);
      expect(count(withVars)).toBeLessThan(count(flattened));
    });

    it("still resolves the var chain to the right literal at every point", () => {
      const sheet = resolverDocumentToCssTheme(layered);
      // The palette literal each theme×scheme combination ultimately lands on.
      expect(sheet.matrix.get("--palette-surface-deep")).toEqual(
        new Map([
          ["theme=astro&colorScheme=light", "#0f1f1d"],
          ["theme=cosmos&colorScheme=light", "#1a1030"],
          ["theme=astro&colorScheme=dark", "#0f1f1d"],
          ["theme=cosmos&colorScheme=dark", "#1a1030"],
        ]),
      );
    });
  });

  describe("selectors", () => {
    const withExtension = {
      ...oneAxis,
      modifiers: {
        theme: {
          ...oneAxis.modifiers.theme,
          $extensions: {
            "tic-tac-token.css": {
              dark: [
                { kind: "media", query: "(prefers-color-scheme: dark)" },
                { kind: "attribute", attribute: "data-theme", value: "dark" },
              ],
            },
          },
        },
      },
    };

    it("reads the mapping out of the document's $extensions", () => {
      const sheet = resolverDocumentToCssTheme(withExtension);
      expect(sheet.css).toContain("@media (prefers-color-scheme: dark) {");
      expect(sheet.css).toContain('[data-theme="dark"] {');
    });

    it("emits the media variant before the unconditional one", () => {
      const sheet = resolverDocumentToCssTheme(withExtension);
      expect(sheet.css.indexOf("@media")).toBeLessThan(
        sheet.css.indexOf(':root[data-theme="dark"]'),
      );
    });

    it("lets the emitter option override the document", () => {
      const sheet = resolverDocumentToCssTheme(withExtension, {
        selectors: { theme: { kind: "class", className: "dark" } },
      });
      expect(sheet.css).not.toContain("@media");
      expect(sheet.css).toContain(":root.dark {");
    });

    it("ignores the document when useDocumentSelectors is false", () => {
      const sheet = resolverDocumentToCssTheme(withExtension, { useDocumentSelectors: false });
      expect(sheet.css).not.toContain("@media");
      expect(sheet.css).toContain(':root[data-theme="dark"] {');
    });

    it("honours a custom root selector", () => {
      const sheet = resolverDocumentToCssTheme(oneAxis, { rootSelector: "html" });
      expect(sheet.css).toContain("html {");
      expect(sheet.css).toContain('html[data-theme="dark"] {');
    });
  });

  it("emits typography sub-properties in a delta block", () => {
    const doc = {
      version: "2025.10",
      modifiers: {
        density: {
          default: "cozy",
          contexts: {
            cozy: [{ type: { body: typography(16, 1.5) } }],
            compact: [{ type: { body: typography(14, 1.3) } }],
          },
        },
      },
      resolutionOrder: [{ $ref: "#/modifiers/density" }],
    };
    const sheet = resolverDocumentToCssTheme(doc);
    expect(sheet.blocks[0]?.declarations.map((d) => d.property)).toEqual([
      "--type-body-font-family",
      "--type-body-font-size",
      "--type-body-font-weight",
      "--type-body-letter-spacing",
      "--type-body-line-height",
    ]);
    const compact = sheet.blocks.find((b) => b.selector.includes("compact"))!;
    expect(compact.declarations.map((d) => d.property)).toEqual([
      "--type-body-font-size",
      "--type-body-line-height",
    ]);
  });

  it("reports a var-collision rather than silently dropping a token", () => {
    const doc = {
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [{ color: { brandPrimary: color("#111111"), brand: { primary: color("#222222") } } }],
        },
      ],
    };
    const sheet = resolverDocumentToCssTheme(doc);
    const collision = sheet.diagnostics.find((d) => d.kind === "var-collision");
    expect(collision).toBeDefined();
    expect(collision?.message).toContain("--color-brand-primary");
  });

  it("warns that interactions went unchecked when the product is truncated", () => {
    const doc = {
      version: "2025.10",
      modifiers: {
        a: { default: "x", contexts: { x: [{ size: { a: dim(1) } }], y: [{ size: { a: dim(2) } }] } },
        b: { default: "x", contexts: { x: [{ size: { b: dim(1) } }], y: [{ size: { b: dim(2) } }] } },
        c: { default: "x", contexts: { x: [{ size: { c: dim(1) } }], y: [{ size: { c: dim(2) } }] } },
      },
      resolutionOrder: [
        { $ref: "#/modifiers/a" },
        { $ref: "#/modifiers/b" },
        { $ref: "#/modifiers/c" },
      ],
    };
    const sheet = resolverDocumentToCssTheme(doc, { maxPermutations: 4 });
    expect(sheet.diagnostics.map((d) => d.kind)).toContain("permutation-limit");
    expect(sheet.diagnostics.map((d) => d.kind)).toContain("assumed-orthogonal");
    expect(sheet.blocks.filter((b) => b.conditions.length > 1)).toEqual([]);
  });

  it("returns an empty sheet with diagnostics for an invalid document", () => {
    const sheet = resolverDocumentToCssTheme({ version: "2024.1", resolutionOrder: [] });
    expect(sheet.documentErrors.length).toBeGreaterThan(0);
    expect(sheet.blocks[0]?.declarations).toEqual([]);
  });
});

describe("tokensToCssTheme (legacy tic-tac-token.modes)", () => {
  const resolved = resolveTokens({
    color: {
      primary: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0], alpha: 1, hex: "#ff0000" },
        $extensions: {
          "tic-tac-token.modes": {
            dark: { colorSpace: "srgb", components: [0, 0, 1], alpha: 1, hex: "#0000ff" },
          },
        },
      },
      stable: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: "#000000" },
      },
    },
  });

  it("lowers each mode into a scoped block instead of flattening by array order", () => {
    const sheet = tokensToCssTheme(resolved);
    expect(sheet.css).toContain(":root {");
    expect(sheet.css).toContain("--color-primary: #ff0000;");
    expect(sheet.css).toContain('[data-mode="dark"] {');
    expect(sheet.css).toContain("--color-primary: #0000ff;");
  });

  it("keeps a token with no mode variant out of the mode block", () => {
    const sheet = tokensToCssTheme(resolved);
    const dark = sheet.blocks.find((b) => b.selector.includes("dark"))!;
    expect(dark.declarations.map((d) => d.property)).toEqual(["--color-primary"]);
  });

  it("accepts a custom axis name", () => {
    const sheet = tokensToCssTheme(resolved, { modeAxis: "colorScheme" });
    expect(sheet.css).toContain('[data-color-scheme="dark"] {');
  });

  it("emits only a root block when no modes are declared", () => {
    const plain = resolveTokens({ color: { a: color("#ffffff") } });
    const sheet = tokensToCssTheme(plain);
    expect(sheet.blocks).toHaveLength(1);
    expect(sheet.axes).toEqual([]);
    expect(sheet.css).toContain("--color-a: #ffffff;");
  });
});

function typography(fontSize: number, lineHeight: number) {
  return {
    $type: "typography" as const,
    $value: {
      fontFamily: ["Inter"],
      fontSize: { value: fontSize, unit: "px" },
      fontWeight: "regular",
      letterSpacing: { value: 0, unit: "px" },
      lineHeight,
    },
  };
}
