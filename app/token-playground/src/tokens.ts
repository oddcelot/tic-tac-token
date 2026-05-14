import { resolveTokens } from "dtcg-tokens/resolver";
import type { FlatToken, TokenType } from "dtcg-tokens/resolver";

export type { FlatToken, TokenType };

export type TokenMode = "light" | "dark";

// Custom extension namespace for per-scheme token overrides. A token may
// carry a map of mode -> replacement $value under this key, e.g.:
//
//   {
//     "$type": "color",
//     "$value": { ...light... },
//     "$extensions": {
//       "tic-tac-token.modes": {
//         "dark": { ...dark... }
//       }
//     }
//   }
//
// When a mode is active, applyModeToTree() rewrites each matching
// token's $value in the parsed JSON tree BEFORE the core resolver runs,
// so any aliases that point at a mode-switched token pick up the
// mode-specific value during alias resolution.
//
// Non-spec — DTCG 2025.10 has no native color-scheme mechanism; this is
// a playground-local convention.
export const MODES_EXTENSION = "tic-tac-token.modes";

function applyModeToTree(node: unknown, mode: TokenMode): unknown {
  if (Array.isArray(node)) return node.map((item) => applyModeToTree(item, mode));
  if (!node || typeof node !== "object") return node;
  const rec = node as Record<string, unknown>;

  // Token detection: a node with `$value` is a token.
  if ("$value" in rec) {
    const ext = rec.$extensions;
    if (ext && typeof ext === "object") {
      const modes = (ext as Record<string, unknown>)[MODES_EXTENSION];
      if (modes && typeof modes === "object" && mode in (modes as object)) {
        return {
          ...rec,
          $value: (modes as Record<string, unknown>)[mode],
        };
      }
    }
    return rec;
  }

  // Group — recurse into children.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = applyModeToTree(v, mode);
  }
  return out;
}

export function parseTokens(
  raw: string,
  mode: TokenMode = "light",
): FlatToken[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const preprocessed = mode === "light" ? parsed : applyModeToTree(parsed, mode);
  const { tokens } = resolveTokens(preprocessed);
  return tokens;
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

export function durationToCss(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { value?: unknown; unit?: unknown };
  if (typeof v.value !== "number") return null;
  if (v.unit !== "ms" && v.unit !== "s") return null;
  return `${v.value}${v.unit}`;
}

export function bezierToCss(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  return `cubic-bezier(${value.join(", ")})`;
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
  if (typeof value === "string" && value in FONT_WEIGHT_MAP)
    return FONT_WEIGHT_MAP[value];
  return null;
}

export function shadowToCss(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const x = dimensionToCss(v.offsetX);
  const y = dimensionToCss(v.offsetY);
  const blur = dimensionToCss(v.blur);
  const spread = dimensionToCss(v.spread);
  const color =
    typeof v.color === "object" && v.color && "$value" in (v.color as object)
      ? colorToCss((v.color as { $value: unknown }).$value)
      : colorToCss(v.color);
  if (!x || !y || !blur || !spread || !color) return null;
  return `${x} ${y} ${blur} ${spread} ${color}`;
}
