export type TokenType =
  | "color"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "fontSize"
  | "duration"
  | "cubicBezier"
  | "number"
  | "shadow"
  | "stroke"
  | "strokeStyle";

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
// When a mode is active, applyMode() substitutes the matching override
// into the token's $value. Non-spec — DTCG 2025.10 has no native color-
// scheme mechanism; this is a playground-local convention.
export const MODES_EXTENSION = "tic-tac-token.modes";

export type FlatToken = {
  path: string;
  $type: TokenType;
  $value: unknown;
  $description?: string;
  $extensions?: Record<string, unknown>;
};

const ALIAS_RE = /^\{([^{}]+)\}$/;

export function flattenTokens(
  obj: unknown,
  prefix: string[] = [],
): FlatToken[] {
  if (!obj || typeof obj !== "object") return [];
  const rec = obj as Record<string, unknown>;
  if ("$type" in rec && "$value" in rec) {
    return [
      {
        path: prefix.join("."),
        $type: rec.$type as TokenType,
        $value: rec.$value,
        $description:
          typeof rec.$description === "string" ? rec.$description : undefined,
        $extensions:
          rec.$extensions && typeof rec.$extensions === "object"
            ? (rec.$extensions as Record<string, unknown>)
            : undefined,
      },
    ];
  }
  const out: FlatToken[] = [];
  for (const [k, v] of Object.entries(rec)) {
    if (k.startsWith("$")) continue;
    out.push(...flattenTokens(v, [...prefix, k]));
  }
  return out;
}

export function resolveAliases(tokens: FlatToken[]): FlatToken[] {
  const byPath = new Map(tokens.map((t) => [t.path, t]));
  const seen = new WeakMap<FlatToken, boolean>();

  function resolve(token: FlatToken, stack: Set<string>): FlatToken {
    if (seen.get(token)) return token;
    const match =
      typeof token.$value === "string" ? token.$value.match(ALIAS_RE) : null;
    if (!match) {
      seen.set(token, true);
      return token;
    }
    const target = byPath.get(match[1]);
    if (!target || stack.has(match[1])) {
      seen.set(token, true);
      return token;
    }
    stack.add(match[1]);
    const resolved = resolve(target, stack);
    token.$value = resolved.$value;
    seen.set(token, true);
    return token;
  }

  return tokens.map((t) => resolve({ ...t }, new Set([t.path])));
}

// Replace each token's $value with the override for the given mode, if one
// is declared under $extensions["tic-tac-token.modes"][mode]. Runs BEFORE
// alias resolution so aliases pointing at a mode-switched token pick up
// the mode-specific value.
export function applyMode(
  tokens: FlatToken[],
  mode: TokenMode,
): FlatToken[] {
  if (mode === "light") return tokens;
  return tokens.map((t) => {
    const modes = t.$extensions?.[MODES_EXTENSION];
    if (modes && typeof modes === "object" && mode in (modes as object)) {
      return { ...t, $value: (modes as Record<string, unknown>)[mode] };
    }
    return t;
  });
}

export function parseTokens(
  raw: string,
  mode: TokenMode = "light",
): FlatToken[] {
  try {
    const parsed = JSON.parse(raw);
    return resolveAliases(applyMode(flattenTokens(parsed), mode));
  } catch {
    return [];
  }
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

export function fontSizeToCss(value: unknown): string | null {
  if (typeof value === "number") return `${value}px`;
  if (typeof value === "string") return value;
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
