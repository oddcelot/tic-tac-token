// Token resolution + CSS conversion for the addon's showcase elements.
// Resolution delegates to the core resolver; the conversion helpers are
// framework-free pure functions shared by every token-type component.
import { resolveTokens } from "@oddsquad/tic-tac-token/resolver";
import type { FlatToken, TokenType } from "@oddsquad/tic-tac-token/resolver";
import {
  colorToCss,
  dimensionToCss,
  fontFamilyToCss,
  fontWeightToCss,
} from "@oddsquad/tic-tac-token/css";

export type { FlatToken, TokenType };
// The value→CSS converters live in the core package (`@oddsquad/tic-tac-token/css`);
// this addon re-exports them for its showcase elements without reimplementing.
export {
  pathToCssVar,
  toCssValue,
  tokensToCssVars,
  colorToCss,
  dimensionToCss,
  fontFamilyToCss,
  fontWeightToCss,
} from "@oddsquad/tic-tac-token/css";
export type { CssVarBundle } from "@oddsquad/tic-tac-token/css";

export type TokenMode = "light" | "dark";

/**
 * Global parameter key under which a project supplies its raw DTCG token
 * documents for the auto-injected showcase stories. Set it in `.storybook/preview.*`:
 *
 * ```ts
 * import astro from "../tokens/themes/astro.json?raw";
 * import cosmos from "../tokens/themes/cosmos.json?raw";
 *
 * export default {
 *   globals: { theme: "astro" },
 *   parameters: { [PARAM_KEY]: { documents: { astro, cosmos } } },
 * };
 * ```
 *
 * The pre-built showcase stories read from here, selecting the document for the
 * current `theme` global (falling back to the addon's bundled default token
 * document when the project doesn't supply one).
 */
export const PARAM_KEY = "ticTacToken";

/** Story render context fields the token document source reads. */
export type TokenRenderContext = {
  parameters?: Record<string, unknown>;
  globals?: Record<string, unknown>;
};

/** A map of theme name → raw DTCG token document. */
type TokenDocuments = Record<string, string>;

/**
 * The project's raw DTCG token document, selected for the active `theme`
 * global. Accepts either `{ documents: { theme: raw, … } }` (multi-theme) or
 * a single `{ raw }` document. Falls back to the first theme when the active
 * one is unknown.
 */
export function tokenDocumentFromParameters(
  context: TokenRenderContext,
): string | undefined {
  const v = context?.parameters?.[PARAM_KEY];
  if (typeof v === "string") return v;
  if (!v || typeof v !== "object") return undefined;
  const entry = v as { raw?: unknown; documents?: unknown };
  if (typeof entry.raw === "string") return entry.raw;
  const documents = entry.documents as TokenDocuments | undefined;
  if (!documents) return undefined;
  const theme = context?.globals?.["theme"];
  if (theme && typeof theme === "string" && documents[theme]) {
    return documents[theme];
  }
  return Object.values(documents)[0];
}

/** Parse a DTCG tokens document and filter to the active mode. */
export function parseTokens(raw: string, mode: TokenMode = "light"): FlatToken[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const { tokens } = resolveTokens(parsed);
  if (mode === "light") return tokens.filter((t) => !t.mode);
  // For dark mode, replace defaults that have a matching mode variant.
  const modePaths = new Set(
    tokens.filter((t) => t.mode === mode).map((t) => t.path.replace(/@\w+$/, "")),
  );
  return tokens.filter(
    (t) => t.mode === mode || (!t.mode && !modePaths.has(t.path)),
  );
}

export function tokensOfType(tokens: FlatToken[], type: TokenType): FlatToken[] {
  return tokens.filter((t) => t.$type === type);
}

/** Human-readable representation of a token's $value (for labels). */
export function formatTokenValue(t: FlatToken): string {
  switch (t.$type) {
    case "color":
      return colorToCss(t.$value) ?? JSON.stringify(t.$value);
    case "fontFamily":
      return fontFamilyToCss(t.$value) ?? JSON.stringify(t.$value);
    case "fontWeight":
      return String(fontWeightToCss(t.$value) ?? t.$value);
    case "dimension":
      return dimensionToCss(t.$value) ?? JSON.stringify(t.$value);
    default:
      return typeof t.$value === "object"
        ? JSON.stringify(t.$value)
        : String(t.$value);
  }
}