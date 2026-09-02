import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveForContext } from "../src/preview/resolve.ts";
import { PARAM_KEY, parseTokens } from "../src/preview/tokens.ts";

const color = (hex: string) => ({
  $type: "color" as const,
  $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex },
});
const alias = (target: string) => ({ $type: "color" as const, $value: `{${target}}` });

/**
 * Themes carry palette ramps; schemes carry only semantic aliases into them.
 * The scheme contexts never mention a theme — they work because the Resolver
 * Module merges every source before it resolves any alias.
 */
const resolver = {
  version: "2025.10",
  modifiers: {
    theme: {
      default: "astro",
      contexts: {
        astro: [{ palette: { subtle: color("#f7faf9"), deep: color("#0f1f1d") } }],
        cosmos: [{ palette: { subtle: color("#faf7ff"), deep: color("#1a1030") } }],
      },
    },
    colorScheme: {
      default: "light",
      contexts: {
        light: [{ color: { background: alias("palette.subtle") } }],
        dark: [{ color: { background: alias("palette.deep") } }],
      },
    },
  },
  resolutionOrder: [{ $ref: "#/modifiers/theme" }, { $ref: "#/modifiers/colorScheme" }],
};

const ctx = (globals: Record<string, string> = {}, document: unknown = resolver) => ({
  parameters: { [PARAM_KEY]: { resolver: document } },
  globals,
});

const bg = (globals: Record<string, string> = {}) =>
  (resolveForContext(ctx(globals)).byPath.get("color.background")?.$value as { hex: string })?.hex;

describe("resolveForContext — resolver documents", () => {
  it("resolves at the declared defaults when no globals are set", () => {
    const result = resolveForContext(ctx());
    expect(result.documentErrors).toEqual([]);
    expect(result.inputs).toEqual({ theme: "astro", colorScheme: "light" });
    expect(bg()).toBe("#f7faf9");
  });

  it("varies with the colorScheme global", () => {
    expect(bg({ colorScheme: "dark" })).toBe("#0f1f1d");
  });

  it("varies with the theme global", () => {
    expect(bg({ theme: "cosmos" })).toBe("#faf7ff");
  });

  it("composes both — proving the merge precedes alias resolution", () => {
    // `scheme/dark` says only `{palette.deep}`; which literal that is depends
    // entirely on the theme merged alongside it.
    expect(bg({ theme: "cosmos", colorScheme: "dark" })).toBe("#1a1030");
    expect(bg({ theme: "astro", colorScheme: "dark" })).toBe("#0f1f1d");
  });

  it("emits custom-property declarations for the active combination", () => {
    const result = resolveForContext(ctx({ colorScheme: "dark" }));
    expect(result.css).toContain("--color-background: #0f1f1d;");
    expect(result.css).not.toContain("{");
  });

  it("memoises per document identity and inputs", () => {
    const a = resolveForContext(ctx({ theme: "cosmos" }));
    const b = resolveForContext(ctx({ theme: "cosmos" }));
    expect(a).toBe(b);

    const c = resolveForContext(ctx({ theme: "astro" }));
    expect(c).not.toBe(a);
  });

  it("does not share a cache between two distinct documents", () => {
    const clone = structuredClone(resolver);
    expect(resolveForContext(ctx({}, clone))).not.toBe(resolveForContext(ctx({})));
  });

  it("surfaces document errors rather than throwing", () => {
    const result = resolveForContext(ctx({}, { version: "2024.1", resolutionOrder: [] }));
    expect(result.documentErrors.length).toBeGreaterThan(0);
    expect(result.tokens).toEqual([]);
  });

  it("returns an empty resolution when no parameters are supplied", () => {
    expect(resolveForContext({}).tokens).toEqual([]);
    expect(resolveForContext({ parameters: {} }).tokens).toEqual([]);
  });
});

describe("resolveForContext — legacy tic-tac-token.modes", () => {
  const withModes = {
    version: "2025.10",
    resolutionOrder: [
      {
        name: "base",
        type: "set",
        sources: [
          {
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
            },
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("drops mode variants so a @dark value cannot clobber its own base", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolveForContext(ctx({}, withModes));
    expect(result.tokens.every((t) => t.mode === undefined)).toBe(true);
    expect(result.byPath.get("color.primary")?.$value).toMatchObject({ hex: "#ff0000" });
    expect(result.css).toContain("--color-primary: #ff0000;");
    expect(result.css).not.toContain("#0000ff");
  });

  it("warns once per document, pointing at the modifier that replaces it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fresh = structuredClone(withModes);
    resolveForContext(ctx({}, fresh));
    resolveForContext(ctx({ theme: "x" }, fresh));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("colorScheme modifier");
  });
});

describe("resolveForContext — legacy raw documents", () => {
  const raw = JSON.stringify({
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
    },
  });

  it("matches parseTokens exactly for the { raw } shape", () => {
    const result = resolveForContext({ parameters: { [PARAM_KEY]: { raw } }, globals: {} });
    expect(result.tokens).toEqual(parseTokens(raw, "light"));
  });

  it("still honours the colorScheme global on the legacy path", () => {
    const result = resolveForContext({
      parameters: { [PARAM_KEY]: { raw } },
      globals: { colorScheme: "dark" },
    });
    expect(result.tokens).toEqual(parseTokens(raw, "dark"));
    expect(result.css).toContain("--color-primary: #0000ff;");
  });

  it("selects by theme for the { documents } shape", () => {
    const other = JSON.stringify({
      color: {
        primary: {
          $type: "color",
          $value: { colorSpace: "srgb", components: [0, 1, 0], alpha: 1, hex: "#00ff00" },
        },
      },
    });
    const result = resolveForContext({
      parameters: { [PARAM_KEY]: { documents: { a: raw, b: other } } },
      globals: { theme: "b" },
    });
    expect(result.css).toContain("--color-primary: #00ff00;");
  });

  it("prefers a resolver document over the legacy shapes", () => {
    const result = resolveForContext({
      parameters: { [PARAM_KEY]: { resolver, raw, documents: { a: raw } } },
      globals: {},
    });
    expect(result.inputs).toEqual({ theme: "astro", colorScheme: "light" });
  });
});
