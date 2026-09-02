import { pathToCssVar } from "@oddsquad/tic-tac-token/css";
import type { IndexedToken, WorkspaceIndex } from "../workspace/index.ts";

// The naming rule itself lives in the core package, alongside the emitter that
// writes the stylesheets this reads back. A second copy here would drift, and
// a drifted copy means every camelCase-segment token gets a false hover.
//
//   color.brand.primary → --color-brand-primary
//   space.itemGap       → --space-item-gap
//
// This wrapper adds the guard the language server needs: a path with no
// derivable var name yields `undefined` rather than a plausible-looking string
// nothing in a stylesheet will ever match. Mode variants (`<path>@<mode>`) are
// among those — `@` is invalid in a custom-property name, and the mode token
// must not shadow its own base in the reverse index.
export function tokenPathToCssVar(path: string): string | undefined {
  if (!path || path.includes("@")) return undefined;
  if (path.split(".").some((segment) => segment.length === 0)) return undefined;
  return pathToCssVar(path);
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
    if (entry.token.mode) continue;
    const cssVar = tokenPathToCssVar(entry.token.path);
    if (cssVar && !map.has(cssVar)) map.set(cssVar, entry);
  }
  return map;
}
