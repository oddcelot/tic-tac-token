import { describe, expect, it } from "vitest";
import {
  CSS_EXTENSION,
  defaultSelector,
  isColorSchemeAxis,
  renderConditions,
  selectorStrategies,
  selectorStrategyFromExtensions,
  type SelectorAxis,
  type SelectorDiagnostic,
  type SelectorStrategy,
} from "../../src/css/selectors.ts";

const theme: SelectorAxis = { name: "theme", contexts: ["light", "dark"], base: "light" };
const density: SelectorAxis = { name: "density", contexts: ["cozy", "compact"], base: "cozy" };
const colorScheme: SelectorAxis = {
  name: "colorScheme",
  contexts: ["light", "dark"],
  base: "light",
};

const strategies = (m: Record<string, SelectorStrategy | undefined> = {}) =>
  new Map(Object.entries(m));

const render = (
  conditions: { axis: string; context: string }[],
  axes: SelectorAxis[],
  m: Record<string, SelectorStrategy | undefined> = {},
  root = ":root",
) => renderConditions(conditions, axes, strategies(m), root);

describe("defaultSelector", () => {
  it("is one kebab-cased data attribute per axis", () => {
    expect(defaultSelector(theme, "dark")).toEqual({
      kind: "attribute",
      attribute: "data-theme",
      value: "dark",
    });
    expect(defaultSelector(colorScheme, "dark")).toEqual({
      kind: "attribute",
      attribute: "data-color-scheme",
      value: "dark",
    });
  });
});

describe("renderConditions", () => {
  it("renders the base as the root selector alone", () => {
    expect(render([], [theme])).toEqual([{ selector: ":root", atRules: [] }]);
  });

  it("falls back to the data-attribute convention with no configuration", () => {
    expect(render([{ axis: "theme", context: "dark" }], [theme])).toEqual([
      { selector: ':root[data-theme="dark"]', atRules: [] },
    ]);
  });

  it("renders each selector kind", () => {
    const cases: [SelectorStrategy, string][] = [
      [{ kind: "root" }, ":root"],
      [{ kind: "attribute", attribute: "data-x", value: "y" }, ':root[data-x="y"]'],
      [{ kind: "class", className: "dark" }, ":root.dark"],
      [{ kind: "selector", selector: ' [data-mode="dark"]' }, ':root [data-mode="dark"]'],
    ];
    for (const [strategy, expected] of cases) {
      expect(render([{ axis: "theme", context: "dark" }], [theme], { theme: strategy })[0]).toEqual(
        { selector: expected, atRules: [] },
      );
    }
  });

  it("puts media and supports in at-rules, leaving the selector at the root", () => {
    expect(
      render([{ axis: "theme", context: "dark" }], [theme], {
        theme: { kind: "media", query: "(prefers-color-scheme: dark)" },
      }),
    ).toEqual([{ selector: ":root", atRules: ["@media (prefers-color-scheme: dark)"] }]);

    expect(
      render([{ axis: "theme", context: "dark" }], [theme], {
        theme: { kind: "supports", condition: "(color: color(display-p3 0 0 0))" },
      }),
    ).toEqual([{ selector: ":root", atRules: ["@supports (color: color(display-p3 0 0 0))"] }]);
  });

  it("accepts a per-context map", () => {
    const strategy = {
      dark: { kind: "media", query: "(prefers-color-scheme: dark)" },
    } satisfies SelectorStrategy;
    expect(render([{ axis: "theme", context: "dark" }], [theme], { theme: strategy })[0]).toEqual({
      selector: ":root",
      atRules: ["@media (prefers-color-scheme: dark)"],
    });
    // A context the map doesn't mention falls back to the convention.
    expect(render([{ axis: "theme", context: "light" }], [theme], { theme: strategy })[0]).toEqual({
      selector: ':root[data-theme="light"]',
      atRules: [],
    });
  });

  it("accepts a function strategy", () => {
    const out = render([{ axis: "theme", context: "dark" }], [theme], {
      theme: (axis, context) => ({ kind: "class", className: `${axis.name}-${context}` }),
    });
    expect(out).toEqual([{ selector: ":root.theme-dark", atRules: [] }]);
  });

  it("compounds several coordinates into one selector", () => {
    expect(
      render(
        [
          { axis: "theme", context: "dark" },
          { axis: "density", context: "compact" },
        ],
        [theme, density],
      ),
    ).toEqual([
      { selector: ':root[data-theme="dark"][data-density="compact"]', atRules: [] },
    ]);
  });

  it("merges several media conditions into one conjunction", () => {
    const out = render(
      [
        { axis: "theme", context: "dark" },
        { axis: "density", context: "compact" },
      ],
      [theme, density],
      {
        theme: { kind: "media", query: "(prefers-color-scheme: dark)" },
        density: { kind: "media", query: "(max-width: 600px)" },
      },
    );
    expect(out).toEqual([
      {
        selector: ":root",
        atRules: ["@media (prefers-color-scheme: dark) and (max-width: 600px)"],
      },
    ]);
  });

  it("mixes an at-rule axis with a selector axis", () => {
    expect(
      render(
        [
          { axis: "theme", context: "dark" },
          { axis: "density", context: "compact" },
        ],
        [theme, density],
        { theme: { kind: "media", query: "(prefers-color-scheme: dark)" } },
      ),
    ).toEqual([
      {
        selector: ':root[data-density="compact"]',
        atRules: ["@media (prefers-color-scheme: dark)"],
      },
    ]);
  });

  describe("the array form", () => {
    const systemThenManual: SelectorStrategy = {
      dark: [
        { kind: "media", query: "(prefers-color-scheme: dark)" },
        { kind: "attribute", attribute: "data-theme", value: "dark" },
      ],
    };

    it("emits one rendered condition per alternative", () => {
      const out = render([{ axis: "theme", context: "dark" }], [theme], {
        theme: systemThenManual,
      });
      expect(out).toHaveLength(2);
    });

    it("orders the unconditional variant LAST so a manual choice beats the OS preference", () => {
      const out = render([{ axis: "theme", context: "dark" }], [theme], {
        theme: systemThenManual,
      });
      expect(out[0]?.atRules).toEqual(["@media (prefers-color-scheme: dark)"]);
      expect(out[1]).toEqual({ selector: ':root[data-theme="dark"]', atRules: [] });
    });

    it("takes the cross-product across compounded axes", () => {
      const out = render(
        [
          { axis: "theme", context: "dark" },
          { axis: "density", context: "compact" },
        ],
        [theme, density],
        { theme: systemThenManual },
      );
      expect(out).toHaveLength(2);
      expect(out.map((r) => r.selector)).toEqual([
        ':root[data-density="compact"]',
        ':root[data-theme="dark"][data-density="compact"]',
      ]);
    });
  });

  it("escapes quotes and backslashes in attribute values", () => {
    const out = render([{ axis: "theme", context: 'a"b\\c' }], [theme], {
      theme: { kind: "attribute", attribute: "data-theme", value: 'a"b\\c' },
    });
    expect(out[0]?.selector).toBe(':root[data-theme="a\\"b\\\\c"]');
  });

  it("honours a custom root selector", () => {
    expect(render([{ axis: "theme", context: "dark" }], [theme], {}, "html")[0]?.selector).toBe(
      'html[data-theme="dark"]',
    );
  });
});

describe("selectorStrategyFromExtensions", () => {
  const withExt = (ext: unknown): SelectorAxis => ({
    ...theme,
    $extensions: { [CSS_EXTENSION]: ext },
  });

  it("returns undefined when the extension is absent", () => {
    const diagnostics: SelectorDiagnostic[] = [];
    expect(selectorStrategyFromExtensions(theme, diagnostics)).toBeUndefined();
    expect(diagnostics).toEqual([]);
  });

  it("reads a single selector applied to every context", () => {
    const diagnostics: SelectorDiagnostic[] = [];
    const axis = withExt({ kind: "class" });
    expect(selectorStrategyFromExtensions(axis, diagnostics)).toEqual({ kind: "class" });
    expect(diagnostics).toEqual([]);
  });

  it("reads a per-context map and ignores non-context metadata keys", () => {
    const diagnostics: SelectorDiagnostic[] = [];
    const axis = withExt({
      colorScheme: true,
      dark: { kind: "media", query: "(prefers-color-scheme: dark)" },
    });
    expect(selectorStrategyFromExtensions(axis, diagnostics)).toEqual({
      dark: { kind: "media", query: "(prefers-color-scheme: dark)" },
    });
    expect(diagnostics).toEqual([]);
  });

  it("reads the array form", () => {
    const diagnostics: SelectorDiagnostic[] = [];
    const axis = withExt({
      dark: [
        { kind: "media", query: "(prefers-color-scheme: dark)" },
        { kind: "attribute", attribute: "data-theme", value: "dark" },
      ],
    });
    expect(selectorStrategyFromExtensions(axis, diagnostics)).toMatchObject({
      dark: [{ kind: "media" }, { kind: "attribute" }],
    });
    expect(diagnostics).toEqual([]);
  });

  it("diagnoses a non-object extension and falls back", () => {
    const diagnostics: SelectorDiagnostic[] = [];
    expect(selectorStrategyFromExtensions(withExt("dark"), diagnostics)).toBeUndefined();
    expect(diagnostics[0]?.kind).toBe("invalid-selector-extension");
    expect(diagnostics[0]?.at).toContain("modifiers.theme");
  });

  it("diagnoses a malformed per-context entry without dropping the valid ones", () => {
    const diagnostics: SelectorDiagnostic[] = [];
    const strategy = selectorStrategyFromExtensions(
      withExt({ dark: { kind: "nope" }, light: { kind: "class", className: "l" } }),
      diagnostics,
    );
    expect(strategy).toEqual({ light: { kind: "class", className: "l" } });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.at).toContain(".dark");
  });

  it("never throws on hostile input", () => {
    const diagnostics: SelectorDiagnostic[] = [];
    for (const ext of [null, 42, [], [1, 2], { dark: [] }, { dark: null }]) {
      expect(() => selectorStrategyFromExtensions(withExt(ext), diagnostics)).not.toThrow();
    }
  });
});

describe("selectorStrategies", () => {
  const axis = { ...theme, $extensions: { [CSS_EXTENSION]: { dark: { kind: "class" } } } };

  it("prefers the emitter option over the document extension", () => {
    const diagnostics: SelectorDiagnostic[] = [];
    const map = selectorStrategies(
      [axis],
      { selectors: { theme: { kind: "media", query: "(x)" } } },
      diagnostics,
    );
    expect(map.get("theme")).toEqual({ kind: "media", query: "(x)" });
  });

  it("uses the document extension when no option is given", () => {
    const map = selectorStrategies([axis], {}, []);
    expect(map.get("theme")).toEqual({ dark: { kind: "class" } });
  });

  it("ignores the document entirely when useDocumentSelectors is false", () => {
    const map = selectorStrategies([axis], { useDocumentSelectors: false }, []);
    expect(map.get("theme")).toBeUndefined();
  });
});

describe("isColorSchemeAxis", () => {
  it("is true only for the explicit marker", () => {
    expect(
      isColorSchemeAxis({ ...colorScheme, $extensions: { [CSS_EXTENSION]: { colorScheme: true } } }),
    ).toBe(true);
    expect(isColorSchemeAxis(colorScheme)).toBe(false);
    expect(
      isColorSchemeAxis({ ...colorScheme, $extensions: { [CSS_EXTENSION]: { colorScheme: 1 } } }),
    ).toBe(false);
  });
});
