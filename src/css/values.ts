// Serialising resolved token values to CSS.
//
// Input is the concrete flat token list produced by the resolver — aliases are
// already dereferenced, including aliases embedded in composite sub-values —
// so nothing here resolves anything. Each function maps one `$value` shape to
// CSS text, or null when the shape isn't one CSS can express.
//
// Uniform rule across the 13 DTCG types: a token contributes one *shorthand*
// custom property when a lossless single-value mapping exists, plus the full
// set of *sub-property* properties for composites. Two types contribute
// sub-properties only — see `tokenToCssDeclarations`.
import type { FlatToken } from "../resolver/types.ts";

export type CssValueOptions = {
  /**
   * How a gradient serialises. `"stops"` (the default) emits the bare stop
   * list, which composes into any gradient function. `"linear"` wraps it in
   * `linear-gradient(...)`.
   */
  gradient?: "stops" | "linear";
  /** Emit sub-property custom properties for composite types. Default true. */
  subProperties?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** A color `$value` → CSS `<color>`. Null when the shape isn't supported. */
export function colorToCss(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.hex === "string") return value.hex;
  if (Array.isArray(value.components) && typeof value.colorSpace === "string") {
    const comps = value.components
      .map((c) => (c === "none" ? "none" : String(c)))
      .join(" ");
    const alpha =
      typeof value.alpha === "number" && value.alpha !== 1 ? ` / ${value.alpha}` : "";
    return `color(${value.colorSpace} ${comps}${alpha})`;
  }
  return null;
}

/** A dimension `$value` → CSS length. Null when the shape isn't supported. */
export function dimensionToCss(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.value !== "number") return null;
  if (value.unit !== "px" && value.unit !== "rem") return null;
  return `${value.value}${value.unit}`;
}

/** A font-family `$value` → CSS font-family list. */
export function fontFamilyToCss(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((v) => (/\s/.test(String(v)) ? `"${v}"` : String(v))).join(", ");
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
  if (typeof value === "string") return FONT_WEIGHT_MAP[value] ?? null;
  return null;
}

/** A duration `$value` → CSS `<time>`. */
export function durationToCss(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.value !== "number") return null;
  if (value.unit !== "ms" && value.unit !== "s") return null;
  return `${value.value}${value.unit}`;
}

/** A number `$value` → a bare CSS number. */
export function numberToCss(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

/** A cubicBezier `$value` → CSS `cubic-bezier()`. */
export function cubicBezierToCss(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  if (!value.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return `cubic-bezier(${value.join(", ")})`;
}

/**
 * A strokeStyle `$value` → CSS `<line-style>`.
 *
 * Only the enum form has a single-value mapping — all eight DTCG keywords are
 * valid CSS line styles. The `{dashArray, lineCap}` form describes a dash
 * pattern rather than a border style and has no CSS shorthand; it is emitted
 * as sub-properties instead.
 */
export function strokeStyleToCss(value: unknown): string | null {
  return typeof value === "string" && value in STROKE_STYLE_KEYWORDS ? value : null;
}

const STROKE_STYLE_KEYWORDS: Record<string, true> = {
  solid: true,
  dashed: true,
  dotted: true,
  double: true,
  groove: true,
  ridge: true,
  outset: true,
  inset: true,
};

/** A border `$value` → the CSS `border` shorthand (`width style color`). */
export function borderToCss(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const width = dimensionToCss(value.width);
  const style = strokeStyleToCss(value.style);
  const color = colorToCss(value.color);
  // The object form of `style` has no keyword to put in the shorthand.
  if (width === null || style === null || color === null) return null;
  return `${width} ${style} ${color}`;
}

/**
 * A transition `$value` → the time-and-easing part of a CSS `transition`.
 *
 * Ordered `duration timing-function delay`: CSS reads the first `<time>` as the
 * duration and the second as the delay, so the result drops into a transition
 * declaration as `transition: color var(--motion-fade)`.
 */
export function transitionToCss(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const duration = durationToCss(value.duration);
  const delay = durationToCss(value.delay);
  const timing = cubicBezierToCss(value.timingFunction);
  if (duration === null || delay === null || timing === null) return null;
  return `${duration} ${timing} ${delay}`;
}

/** One shadow layer → `[inset ]<x> <y> <blur> <spread> <color>`. */
function singleShadowToCss(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const offsetX = dimensionToCss(value.offsetX);
  const offsetY = dimensionToCss(value.offsetY);
  const blur = dimensionToCss(value.blur);
  const spread = dimensionToCss(value.spread);
  const color = colorToCss(value.color);
  if (offsetX === null || offsetY === null || blur === null || spread === null || color === null) {
    return null;
  }
  const inset = value.inset === true ? "inset " : "";
  return `${inset}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
}

/**
 * A shadow `$value` → a CSS `box-shadow` value. The array form becomes
 * comma-joined layers, in declaration order (first layer painted on top).
 */
export function shadowToCss(value: unknown): string | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const layers = value.map(singleShadowToCss);
    return layers.some((l) => l === null) ? null : layers.join(", ");
  }
  return singleShadowToCss(value);
}

/**
 * A gradient `$value` → CSS color stops.
 *
 * A DTCG gradient is a stop list and nothing else: it declares no gradient
 * type and no direction. Emitting `linear-gradient(to bottom, …)` would invent
 * a direction the token never stated and make the property unusable for a
 * radial or conic gradient, so the default is the bare stop list — which drops
 * straight into any gradient function:
 *
 * ```css
 * background: linear-gradient(to right, var(--brand-fade));
 * ```
 */
export function gradientToCss(value: unknown, options: CssValueOptions = {}): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const stops: string[] = [];
  for (const stop of value) {
    if (!isRecord(stop)) return null;
    const color = colorToCss(stop.color);
    if (color === null || typeof stop.position !== "number") return null;
    stops.push(`${color} ${stop.position * 100}%`);
  }
  const list = stops.join(", ");
  return options.gradient === "linear" ? `linear-gradient(${list})` : list;
}

/** A typography sub-value → CSS, per field. Null for an unknown field. */
function typographyField(field: string, value: unknown): string | null {
  switch (field) {
    case "fontFamily":
      return fontFamilyToCss(value);
    case "fontSize":
    case "letterSpacing":
      return dimensionToCss(value);
    case "fontWeight": {
      const weight = fontWeightToCss(value);
      return weight === null ? null : String(weight);
    }
    case "lineHeight":
      return numberToCss(value);
    default:
      return null;
  }
}

const TYPOGRAPHY_FIELDS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
] as const;

/**
 * Resolve a supported token `$value` to a single CSS value string.
 *
 * Null for the two types with no lossless single-value mapping:
 *
 * - `typography` — the CSS `font` shorthand cannot express `letterSpacing` at
 *   all and resets `font-variant` / `font-stretch` / `font-feature-settings`.
 *   Silently dropping a declared field is worse than emitting five properties.
 * - `strokeStyle` in its `{dashArray, lineCap}` form — a dash pattern, not a
 *   line style.
 *
 * Both are covered by `tokenToCssDeclarations`.
 */
export function toCssValue(t: FlatToken, options: CssValueOptions = {}): string | null {
  switch (t.$type) {
    case "color":
      return colorToCss(t.$value);
    case "dimension":
      return dimensionToCss(t.$value);
    case "fontFamily":
      return fontFamilyToCss(t.$value);
    case "fontWeight": {
      const weight = fontWeightToCss(t.$value);
      return weight === null ? null : String(weight);
    }
    case "duration":
      return durationToCss(t.$value);
    case "number":
      return numberToCss(t.$value);
    case "cubicBezier":
      return cubicBezierToCss(t.$value);
    case "strokeStyle":
      return strokeStyleToCss(t.$value);
    case "border":
      return borderToCss(t.$value);
    case "transition":
      return transitionToCss(t.$value);
    case "shadow":
      return shadowToCss(t.$value);
    case "gradient":
      return gradientToCss(t.$value, options);
    case "typography":
      return null;
    default:
      return null;
  }
}

/**
 * One custom property a token contributes. `suffix` is `""` for the shorthand
 * and a sub-property name (`"color"`, `"fontSize"`) otherwise; the emitter
 * turns it into `--name` or `--name-color`.
 */
export type CssDeclaration = { suffix: string; value: string };

/**
 * Every custom property a token contributes: the shorthand when one exists,
 * plus a property per sub-value for the composite types.
 *
 * Composites emit both so a consumer can either take the whole thing
 * (`border: var(--border-focus)`) or reach a part of it
 * (`outline-color: var(--border-focus-color)`).
 */
export function tokenToCssDeclarations(
  t: FlatToken,
  options: CssValueOptions = {},
): CssDeclaration[] {
  const out: CssDeclaration[] = [];
  const shorthand = toCssValue(t, options);
  if (shorthand !== null) out.push({ suffix: "", value: shorthand });

  if (options.subProperties === false) return out;

  const value = t.$value;
  switch (t.$type) {
    case "border": {
      if (!isRecord(value)) break;
      push(out, "width", dimensionToCss(value.width));
      push(out, "style", strokeStyleToCss(value.style));
      push(out, "color", colorToCss(value.color));
      break;
    }
    case "transition": {
      if (!isRecord(value)) break;
      push(out, "duration", durationToCss(value.duration));
      push(out, "delay", durationToCss(value.delay));
      push(out, "timingFunction", cubicBezierToCss(value.timingFunction));
      break;
    }
    case "typography": {
      if (!isRecord(value)) break;
      for (const field of TYPOGRAPHY_FIELDS) {
        push(out, field, typographyField(field, value[field]));
      }
      break;
    }
    case "strokeStyle": {
      // Only the object form has parts; the enum form is the shorthand.
      if (!isRecord(value)) break;
      if (Array.isArray(value.dashArray)) {
        const dashes = value.dashArray.map(dimensionToCss);
        push(
          out,
          "dashArray",
          dashes.some((d) => d === null) ? null : dashes.join(" "),
        );
      }
      push(out, "lineCap", typeof value.lineCap === "string" ? value.lineCap : null);
      break;
    }
    default:
      break;
  }

  return out;
}

function push(out: CssDeclaration[], suffix: string, value: string | null): void {
  if (value !== null) out.push({ suffix, value });
}
