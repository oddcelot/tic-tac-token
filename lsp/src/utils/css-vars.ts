import type { IndexedToken, WorkspaceIndex } from "../workspace/index.ts";

// Convention A (the Style Dictionary default): a token's dot-path maps to a
// CSS custom property by kebab-casing each path segment and joining the
// segments with `-`, prefixed with `--`.
//
//   color.brand.primary → --color-brand-primary
//   space.itemGap       → --space-item-gap
//
// Mode variants (`<path>@<mode>`) have no CSS-var form — `@` is invalid in a
// custom-property name — so they are excluded.
export function tokenPathToCssVar(path: string): string | undefined {
  if (!path || path.includes("@")) return undefined;
  const segments = path.split(".").map(kebabCase);
  if (segments.some((segment) => segment.length === 0)) return undefined;
  return `--${segments.join("-")}`;
}

// camelCase / PascalCase → kebab-case. `itemGap` → `item-gap`,
// `APIKey` → `api-key`. Already-kebab or lowercase segments pass through.
function kebabCase(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

// Reverse lookup: CSS custom-property name → the token it refers to, across
// the whole workspace. Built by forward-computing each token's CSS-var name
// (kebab-casing isn't losslessly reversible, so we never parse the var name
// back into a path). First writer wins on collision — deterministic given
// the index's own iteration order. Mode variants are excluded.
export function buildCssVarIndex(
  index: WorkspaceIndex,
): Map<string, IndexedToken> {
  const map = new Map<string, IndexedToken>();
  for (const entry of index.allTokens()) {
    const cssVar = tokenPathToCssVar(entry.token.path);
    if (cssVar && !map.has(cssVar)) map.set(cssVar, entry);
  }
  return map;
}
