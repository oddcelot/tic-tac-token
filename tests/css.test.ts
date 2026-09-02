import { describe, expect, it } from "vitest";
import { resolveTokens } from "../src/resolver/index.ts";
import {
  colorToCss,
  dimensionToCss,
  fontFamilyToCss,
  fontWeightToCss,
  pathToCssVar,
  toCssValue,
  tokensToCssVars,
  type CssVarBundle,
} from "../src/css.ts";
import type { FlatToken } from "../src/resolver/types.ts";

const colorHex = (hex: string) => ({
  $type: "color" as const,
  $value: {
    colorSpace: "srgb",
    components: [0, 0, 0],
    alpha: 1,
    hex,
  },
});

const token = (path: string, t: Omit<FlatToken, "path" | "typeInherited">): FlatToken =>
  ({ ...t, path, typeInherited: false });

describe("pathToCssVar", () => {
  it("namespaces a flat path", () => {
    expect(pathToCssVar("color.primary")).toBe("--color-primary");
    expect(pathToCssVar("color.blue")).toBe("--color-blue");
    expect(pathToCssVar("spacing.card")).toBe("--spacing-card");
    expect(pathToCssVar("font.family.sans")).toBe("--font-family-sans");
  });
});

describe("per-type converters", () => {
  it("colorToCss accepts hex", () => {
    expect(colorToCss({ hex: "#0D998C" })).toBe("#0D998C");
  });
  it("colorToCss accepts sRGB components", () => {
    expect(colorToCss({ colorSpace: "srgb", components: [0.05, 0.6, 0.55], alpha: 1 })).toBe(
      "color(srgb 0.05 0.6 0.55)",
    );
  });
  it("colorToCss rejects unknown shapes", () => {
    expect(colorToCss({ notColor: true })).toBeNull();
    expect(colorToCss(42)).toBeNull();
  });
  it("dimensionToCss formats px/rem", () => {
    expect(dimensionToCss({ value: 16, unit: "px" })).toBe("16px");
    expect(dimensionToCss({ value: 1, unit: "rem" })).toBe("1rem");
    expect(dimensionToCss({ value: 3, unit: "vh" })).toBeNull();
  });
  it("fontFamilyToCss quotes names with spaces", () => {
    expect(fontFamilyToCss(["Inter", "Segoe UI"])).toBe('Inter, "Segoe UI"');
  });
  it("fontWeightToCss maps named weights", () => {
    expect(fontWeightToCss("bold")).toBe(700);
    expect(fontWeightToCss(900)).toBe(900);
    expect(fontWeightToCss("foo")).toBeNull();
  });
});

describe("toCssValue", () => {
  it("returns the css value for supported types", () => {
    expect(toCssValue(token("color.blue", colorHex("#0D998C")))).toBe("#0D998C");
    expect(toCssValue(token("font.family.sans", { $type: "fontFamily", $value: ["Inter"] }))).toBe("Inter");
    expect(toCssValue(token("font.weight.bold", { $type: "fontWeight", $value: "bold" }))).toBe("700");
    expect(toCssValue(token("space.md", { $type: "dimension", $value: { value: 16, unit: "px" } }))).toBe("16px");
  });
  it("returns null for a malformed value", () => {
    expect(toCssValue(token("effect.shadow", { $type: "shadow", $value: {} }))).toBeNull();
  });
  it("returns null for typography, which has no lossless shorthand", () => {
    expect(
      toCssValue(
        token("type.body", {
          $type: "typography",
          $value: {
            fontFamily: ["Inter"],
            fontSize: { value: 16, unit: "px" },
            fontWeight: "regular",
            letterSpacing: { value: 0, unit: "px" },
            lineHeight: 1.5,
          },
        }),
      ),
    ).toBeNull();
  });
});

describe("tokensToCssVars (A2 role model)", () => {
  it("emits one var per resolved token, role name = path", () => {
    const result = resolveTokens({
      color: {
        blue: colorHex("#2E6FDB"),
        primary: { $type: "color", $value: "{color.blue}" },
      },
    });
    expect(result.errors).toEqual([]);

    const bundle = tokensToCssVars(result.tokens);
    expect(bundle.css).toContain("--color-blue: #2E6FDB;");
    expect(bundle.css).toContain("--color-primary: #2E6FDB;");
    expect(bundle.roles["color.primary"]).toEqual({
      cssVar: "--color-primary",
      value: "#2E6FDB",
    });
  });

  it("for() returns the requested roles as cssVar:value", () => {
    const result = resolveTokens({
      color: {
        blue: colorHex("#2E6FDB"),
        primary: { $type: "color", $value: "{color.blue}" },
      },
      space: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } },
    });
    const bundle = tokensToCssVars(result.tokens);
    expect(bundle.for("color.primary", "space.md")).toEqual({
      "--color-primary": "#2E6FDB",
      "--space-md": "16px",
    });
    expect(bundle.for("color.missing")).toEqual({});
  });

  it("skips tokens whose values cannot serialize", () => {
    const bundle: CssVarBundle = tokensToCssVars([
      token("effect.shadow", { $type: "shadow", $value: {} }),
      token("color.blue", colorHex("#0D998C")),
    ]);
    expect(bundle.roles["effect.shadow"]).toBeUndefined();
    expect(bundle.roles["color.blue"]).toBeDefined();
    expect(bundle.css).toBe("--color-blue: #0D998C;");
  });

  it("reflects an alias role value across two different themes", () => {
    const astro = resolveTokens({
      color: {
        palette: { teal: colorHex("#0D998C") },
        primary: { $type: "color", $value: "{color.palette.teal}" },
      },
    });
    const cosmos = resolveTokens({
      color: {
        palette: { indigo: colorHex("#525CE6") },
        primary: { $type: "color", $value: "{color.palette.indigo}" },
      },
    });

    const a = tokensToCssVars(astro.tokens);
    const c = tokensToCssVars(cosmos.tokens);

    // Role var is stable across themes; its value changes with the theme.
    expect(a.for("color.primary")).toEqual({ "--color-primary": "#0D998C" });
    expect(c.for("color.primary")).toEqual({ "--color-primary": "#525CE6" });
  });

  it("keeps role var names stable across color schemes (mode variants)", () => {
    const result = resolveTokens({
      color: {
        primary: {
          $type: "color",
          $value: { colorSpace: "srgb", components: [1, 0, 0], alpha: 1, hex: "#ff0000" },
          $extensions: {
            "tic-tac-token.modes": { dark: { colorSpace: "srgb", components: [0, 0, 1], alpha: 1, hex: "#0000ff" } },
          },
        },
      },
    });
    expect(result.errors).toEqual([]);

    const light = tokensToCssVars(result.tokens.filter((t) => !t.mode));
    const dark = tokensToCssVars(result.tokens.filter((t) => t.mode === "dark"));

    expect(light.for("color.primary")).toEqual({ "--color-primary": "#ff0000" });
    // Same var name in dark mode, different value.
    expect(dark.for("color.primary")).toEqual({ "--color-primary": "#0000ff" });
    expect(dark.css).toContain("--color-primary: #0000ff;");
    expect(dark.css).not.toContain("--color-primary-dark");
  });
});