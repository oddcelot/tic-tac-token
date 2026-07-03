import type { FlatToken } from "@oddsquad/tic-tac-token/resolver";

// Pretty-print a token value, preferring a friendly one-line CSS-like
// form (e.g. `32px`, `#ff0000`, `cubic-bezier(0.4, 0, 0.2, 1)`) over
// raw JSON. Falls back to a fenced JSON block for shapes we can't
// reduce to a single line — composite typography, gradients, etc.

function renderValueBlock($type: string, value: unknown): string {
  // Alias strings (`"{color.primary}"`) and JSON Pointer strings
  // (`"#/color/primary/$value"`) are always one-liners.
  if (typeof value === "string") {
    return "`" + value + "`";
  }
  const flat = formatFlat($type, value);
  if (flat !== undefined) return "`" + flat + "`";
  return jsonBlock(value);
}

function jsonBlock(value: unknown): string {
  try {
    return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
  } catch {
    return "```\n[unrenderable]\n```";
  }
}

// Return a flat CSS-like representation if the value matches the
// shape expected for `$type`; otherwise undefined (caller falls back
// to JSON).
function formatFlat($type: string, value: unknown): string | undefined {
  switch ($type) {
    case "color":
      return colorToCss(value);
    case "dimension":
    case "duration":
      return formatScalar(value);
    case "cubicBezier":
      return formatCubicBezier(value);
    case "fontFamily":
      return formatFontFamily(value);
    case "fontWeight":
    case "number":
      if (typeof value === "number" || typeof value === "string") return String(value);
      return undefined;
    case "strokeStyle":
      if (typeof value === "string") return value;
      return undefined;
    case "border":
      return formatBorder(value);
    case "transition":
      return formatTransition(value);
    case "shadow":
      return formatShadow(value);
    default:
      return undefined;
  }
}

// Color → `#hex` if known, else `color(space comps[ / alpha])`.
function colorToCss(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.hex === "string") return v.hex;
  if (Array.isArray(v.components) && typeof v.colorSpace === "string") {
    const comps = v.components
      .map((c) => (c === "none" ? "none" : typeof c === "number" ? String(c) : ""))
      .filter(Boolean)
      .join(" ");
    const alpha =
      typeof v.alpha === "number" && v.alpha !== 1 ? ` / ${v.alpha}` : "";
    return `color(${v.colorSpace} ${comps}${alpha})`;
  }
  return undefined;
}

// `{ value: 32, unit: "px" }` → `32px`. Used for dimensions + durations.
function formatScalar(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as { value?: unknown; unit?: unknown };
  if (typeof v.value !== "number" || typeof v.unit !== "string") return undefined;
  return `${v.value}${v.unit}`;
}

function formatCubicBezier(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  if (!value.every((n) => typeof n === "number")) return undefined;
  return `cubic-bezier(${value.join(", ")})`;
}

function formatFontFamily(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (
    Array.isArray(value) &&
    value.every((v) => typeof v === "string")
  ) {
    return (value as string[])
      .map((v) => (/\s/.test(v) ? `"${v}"` : v))
      .join(", ");
  }
  return undefined;
}

function formatBorder(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const w = formatFlat("dimension", v.width);
  const s = formatFlat("strokeStyle", v.style);
  const c = formatFlat("color", v.color);
  if (!w || !s || !c) return undefined;
  return `${w} ${s} ${c}`;
}

function formatTransition(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const d = formatFlat("duration", v.duration);
  const tf = formatFlat("cubicBezier", v.timingFunction);
  if (!d || !tf) return undefined;
  const delay = v.delay !== undefined ? ` ${formatFlat("duration", v.delay) ?? ""}` : "";
  return `${d} ${tf}${delay}`.trimEnd();
}

function formatShadow(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const parts = value.map(formatSingleShadow);
    if (parts.some((p) => p === undefined)) return undefined;
    return parts.join(", ");
  }
  return formatSingleShadow(value);
}

function formatSingleShadow(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const x = formatFlat("dimension", v.offsetX);
  const y = formatFlat("dimension", v.offsetY);
  const blur = formatFlat("dimension", v.blur);
  const spread = formatFlat("dimension", v.spread);
  const color = formatFlat("color", v.color);
  if (!x || !y || !blur || !spread || !color) return undefined;
  const inset = v.inset === true ? "inset " : "";
  return `${inset}${x} ${y} ${blur} ${spread} ${color}`;
}

// Markdown hover body for a resolved token. Includes the path, type,
// description (if present), the *literal* $value (pre-resolution) and
// the *resolved* $value (post-resolution). For color tokens, embeds a
// small swatch via the VS Code "color box" markdown trick — a fenced
// block with a CSS color value renders as a swatch in many clients.
export function renderTokenHover(
  literal: FlatToken,
  resolved: FlatToken | undefined,
): string {
  const lines: string[] = [];
  lines.push(`**\`${literal.path || "(root)"}\`** — \`${literal.$type}\``);
  if (literal.$description) lines.push("", literal.$description);

  const literalEq = JSON.stringify(literal.$value);
  const resolvedEq = resolved ? JSON.stringify(resolved.$value) : undefined;
  const isAliased = resolvedEq !== undefined && resolvedEq !== literalEq;

  if (literal.$type === "color") {
    const cssColor = colorToCss(resolved?.$value ?? literal.$value);
    if (cssColor) {
      // Renders as a swatch in editors that honor the VS Code color
      // preview convention inside markdown.
      lines.push("", "```css", `color: ${cssColor};`, "```");
    }
  }

  lines.push("", "**Value**", renderValueBlock(literal.$type, literal.$value));

  if (isAliased && resolved) {
    lines.push("", "**Resolved**", renderValueBlock(resolved.$type, resolved.$value));
  }

  if (literal.$deprecated) {
    const reason =
      typeof literal.$deprecated === "string" ? `: ${literal.$deprecated}` : "";
    lines.push("", `⚠ **Deprecated**${reason}`);
  }

  return lines.join("\n");
}
