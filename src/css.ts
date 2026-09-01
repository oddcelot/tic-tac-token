// Pure, framework-free derivation of CSS custom properties from resolved
// design tokens. The input is the concrete flat token list produced by the
// resolver (aliases already dereferenced), so each token maps to one CSS var
// with no further resolution here.
//
// Naming rule (A2): a token's stable custom-property name is its full path,
// dots → dashes, prefixed with `--`. So `color.primary` → `--color-primary`,
// `spacing.card` → `--spacing-card`. An alias token such as
// `color.primary = {color.blue}` resolves to the referenced value by the
// time it reaches here, so the var the app consumes is `--color-primary`,
// and its value tracks whichever theme currently binds `primary`.
import type { FlatToken } from "./resolver/types.ts";

/** `"color.primary"` → `"--color-primary"`. */
export function pathToCssVar(path: string): string {
  return `--${path.replace(/\./g, "-")}`;
}

/** A color `$value` → CSS `<color>`. Null when the shape isn't supported. */
export function colorToCss(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.hex === "string") return v.hex;
  if (Array.isArray(v.components) && typeof v.colorSpace === "string") {
    const comps = v.components
      .map((c) => (c === "none" ? "none" : String(c)))
      .join(" ");
    const alpha =
      typeof v.alpha === "number" && v.alpha !== 1 ? ` / ${v.alpha}` : "";
    return `color(${v.colorSpace} ${comps}${alpha})`;
  }
  return null;
}

/** A dimension `$value` → CSS length. Null when the shape isn't supported. */
export function dimensionToCss(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { value?: unknown; unit?: unknown };
  if (typeof v.value !== "number") return null;
  if (v.unit !== "px" && v.unit !== "rem") return null;
  return `${v.value}${v.unit}`;
}

/** A font-family `$value` → CSS font-family list. */
export function fontFamilyToCss(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((v) => (/\s/.test(v) ? `"${v}"` : v)).join(", ");
  return null;
}

const FONT_WEIGHT_MAP: Record<string, number> = {
  thin: 100,
  hairline: 100,
  "extra-light": 200,
  "ultra-light": 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  "semi-bold": 600,
  "demi-bold": 600,
  bold: 700,
  "extra-bold": 800,
  "ultra-bold": 800,
  black: 900,
  heavy: 900,
  "extra-black": 950,
  "ultra-black": 950,
};

/** A font-weight `$value` → CSS weight number. */
export function fontWeightToCss(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const weight = FONT_WEIGHT_MAP[value];
    return weight ?? null;
  }
  return null;
}

/** Resolve a supported token `$value` to a CSS value string. */
export function toCssValue(t: FlatToken): string | null {
  switch (t.$type) {
    case "color":
      return colorToCss(t.$value);
    case "dimension":
      return dimensionToCss(t.$value);
    case "fontFamily":
      return fontFamilyToCss(t.$value);
    case "fontWeight":
      return fontWeightToCss(t.$value) !== null
        ? String(fontWeightToCss(t.$value))
        : null;
    default:
      return null;
  }
}

/**
 * The result of deriving CSS custom properties from a resolved token list.
 * `css` is the full custom-property sheet; `roles` indexes the stable var
 * name per token path; `for()` lets a consumer pull exactly the roles a
 * component needs. All names are derived from token paths, never hardcoded.
 */
export type CssVarBundle = {
  /** Full custom-property sheet, one `--name: value;` line per token. */
  css: string;
  /** Role name (token path) → the emitted CSS var plus its value. */
  roles: Record<string, { cssVar: string; value: string }>;
  /** Returns `{ [cssVar]: value }` for the given role names. */
  for(...roleNames: string[]): Record<string, string>;
};

/**
 * Derive a CSS custom-property sheet (and role index) from resolved tokens.
 * Each token contributes one var named after its path (e.g. `color.primary`
 * → `--color-primary`). Mode-variant tokens (`color.primary@dark`) resolve to
 * the *same* var as their base (`color.primary`), so a role name stays stable
 * across color schemes — only the emitted value changes. Values are already
 * alias-resolved by the resolver.
 */
export function tokensToCssVars(tokens: FlatToken[]): CssVarBundle {
  const lines: string[] = [];
  const roles: CssVarBundle["roles"] = {};

  for (const token of tokens) {
    const value = toCssValue(token);
    if (value === null) continue;
    const basePath = token.path.replace(/@[\w-]+$/, "");
    const cssVar = pathToCssVar(basePath);
    lines.push(`${cssVar}: ${value};`);
    roles[basePath] = { cssVar, value };
  }

  return {
    css: lines.join("\n"),
    roles,
    for(...roleNames: string[]) {
      const out: Record<string, string> = {};
      for (const name of roleNames) {
        const entry = roles[name];
        if (entry) out[entry.cssVar] = entry.value;
      }
      return out;
    },
  };
}