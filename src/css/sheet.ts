// Deriving a flat custom-property sheet from one resolved token list.
//
// This is the single-permutation path: one token list in, one block of
// declarations out. Emitting a *themed* sheet — several context-scoped blocks
// factored against a base — is `./theme.ts`.
import type { FlatToken } from "../resolver/types.ts";
import { basePath, pathToCssVar } from "./names.ts";
import { toCssValue, type CssValueOptions } from "./values.ts";

/**
 * The result of deriving CSS custom properties from a resolved token list.
 * `css` is the declaration block; `roles` indexes the stable var name per
 * token path; `for()` pulls exactly the roles a component needs. All names are
 * derived from token paths, never hardcoded.
 */
export type CssVarBundle = {
  /** Declaration list, one `--name: value;` line per token. No selector. */
  css: string;
  /** Role name (token path) → the emitted CSS var plus its value. */
  roles: Record<string, { cssVar: string; value: string }>;
  /** Returns `{ [cssVar]: value }` for the given role names. */
  for(...roleNames: string[]): Record<string, string>;
  /** `css` wrapped in a selector, e.g. `rule(":root")`. */
  rule(selector: string): string;
};

export type CssVarOptions = CssValueOptions & {
  /** When set, `css` is also exposed wrapped in this selector as `cssRule`. */
  selector?: string;
  /** Indent for wrapped rules. Defaults to two spaces. */
  indent?: string;
};

/**
 * Derive a CSS custom-property block (and role index) from resolved tokens.
 *
 * Each token contributes one var named after its path (`color.primary` →
 * `--color-primary`). Mode-variant tokens (`color.primary@dark`) map to the
 * *same* var as their base, so a role name stays stable across color schemes
 * and only the value changes.
 *
 * That collapse means the caller owns the choice of mode: pass a list filtered
 * to one mode, as `parseTokens` does. Handing in a list that mixes a base
 * token and its own mode variant is ambiguous — the later one wins — because
 * both claim the same custom property. Use `tokensToCssTheme` to emit several
 * modes as separate scoped blocks instead.
 */
export function tokensToCssVars(
  tokens: FlatToken[],
  options: CssVarOptions = {},
): CssVarBundle {
  const lines: string[] = [];
  const roles: CssVarBundle["roles"] = {};

  for (const token of tokens) {
    const value = toCssValue(token, options);
    if (value === null) continue;
    const role = basePath(token.path);
    const cssVar = pathToCssVar(role);
    lines.push(`${cssVar}: ${value};`);
    roles[role] = { cssVar, value };
  }

  const css = lines.join("\n");
  const indent = options.indent ?? "  ";

  return {
    css,
    roles,
    for(...roleNames: string[]) {
      const out: Record<string, string> = {};
      for (const name of roleNames) {
        const entry = roles[name];
        if (entry) out[entry.cssVar] = entry.value;
      }
      return out;
    },
    rule(selector: string) {
      if (lines.length === 0) return `${selector} {}`;
      return `${selector} {\n${lines.map((l) => indent + l).join("\n")}\n}`;
    },
  };
}
