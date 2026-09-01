// Token resolution + CSS conversion for the addon's showcase elements.
// Resolution delegates to the core resolver; the conversion helpers are
// framework-free pure functions shared by every token-type component.
import { resolveTokens } from "@oddsquad/tic-tac-token/resolver";
import type { FlatToken, TokenType } from "@oddsquad/tic-tac-token/resolver";

export type { FlatToken, TokenType };

export type TokenMode = "light" | "dark";

/**
 * Global parameter key under which a project supplies its own raw DTCG token
 * document for the auto-injected showcase stories. Set it in `.storybook/preview.*`:
 *
 * ```ts
 * import raw from "../tokens/tokens.json?raw";
 * export default { parameters: { [PARAM_KEY]: { raw } } };
 * ```
 *
 * The pre-built showcase stories read from here (falling back to the addon's
 * bundled default token document when the project doesn't set it).
 */
export const PARAM_KEY = "ticTacToken";

/** Story render context fields the token document source reads. */
export type TokenRenderContext = {
  parameters?: Record<string, unknown>;
};

/** The project's raw DTCG token document from the global parameter, if any. */
export function tokenDocumentFromParameters(
  context: TokenRenderContext,
): string | undefined {
  const v = context?.parameters?.[PARAM_KEY];
  return typeof v === "string"
    ? v
    : v && typeof (v as { raw?: unknown }).raw === "string"
      ? (v as { raw: string }).raw
      : undefined;
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

export function dimensionToCss(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { value?: unknown; unit?: unknown };
  if (typeof v.value !== "number") return null;
  if (v.unit !== "px" && v.unit !== "rem") return null;
  return `${v.value}${v.unit}`;
}

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

export function fontWeightToCss(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const weight = FONT_WEIGHT_MAP[value];
    return weight ?? null;
  }
  return null;
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