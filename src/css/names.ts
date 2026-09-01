// Deriving CSS custom-property names from token paths.
//
// Naming rule: kebab-case each path segment, join with `-`, prefix with `--`.
//
//   color.brand.primary → --color-brand-primary
//   space.itemGap       → --space-item-gap
//
// This is the Style Dictionary convention, and it is the one the language
// server reads back when hovering a `var(--x)` in a CSS file — the two must
// agree or every camelCase-segment token gets a false hover.
//
// The mapping is deliberately not reversible: `color.brandPrimary` and
// `color.brand.primary` both produce `--color-brand-primary`. Emitters detect
// the collision at the point where the whole name set is known, rather than
// trying to parse a var name back into a path.

/** camelCase / PascalCase → kebab-case. `itemGap` → `item-gap`, `APIKey` → `api-key`. */
export function kebabCase(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Strip a mode suffix from a token path: `color.primary@dark` → `color.primary`.
 *
 * Mode variants are alternate values for the *same* role, so they share the
 * base path's custom property; only the emitted value differs.
 */
export function basePath(path: string): string {
  return path.replace(/@[\w-]+$/, "");
}

/**
 * `"space.itemGap"` → `"--space-item-gap"`.
 *
 * A `$root` segment is dropped — `$` is not a valid custom-property character,
 * and `color.accent.$root` *is* the `color.accent` group's own token, so
 * `--color-accent` is the exact name. No sibling can collide, since a node
 * carrying `$value` has no children of its own.
 */
export function pathToCssVar(path: string): string {
  return `--${cssVarSegments(path).join("-")}`;
}

/** The kebab-cased, `$root`-free, mode-free segments of a path. */
export function cssVarSegments(path: string): string[] {
  return basePath(path)
    .split(".")
    .filter((segment) => segment !== "" && segment !== "$root")
    .map(kebabCase);
}

/**
 * Whether a path can produce a custom-property name at all.
 *
 * False for the empty path and for a path that is nothing but `$root` — a
 * document-root `$root` token has no name to derive, and inventing one would
 * be worse than reporting it.
 */
export function isEmittablePath(path: string): boolean {
  return cssVarSegments(path).length > 0;
}

/**
 * Name a composite token's sub-property: `("--border-focus", "color")` →
 * `"--border-focus-color"`.
 */
export function subPropertyVar(cssVar: string, suffix: string): string {
  return `${cssVar}-${kebabCase(suffix)}`;
}
