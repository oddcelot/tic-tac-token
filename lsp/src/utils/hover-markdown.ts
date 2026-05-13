import type { FlatToken } from "dtcg-tokens/resolver";

// Render a token's resolved value as fenced JSON for hover display.
function renderValue(value: unknown): string {
  try {
    return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
  } catch {
    return "```\n[unrenderable]\n```";
  }
}

// Convert a resolved color $value to a CSS color string for swatch
// preview. Prefers `hex` when present; falls back to `color()` notation.
function colorToCss(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
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

// Markdown hover body for a resolved token. Includes the path, type,
// description (if present), the *literal* $value (pre-resolution) and
// the *resolved* $value (post-resolution). For color tokens, embeds a
// small swatch via the official VS Code "color box" markdown trick — a
// fenced block with a CSS color value renders as a swatch in many
// clients.
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

  lines.push("", "**Value**", renderValue(literal.$value));

  if (isAliased && resolved) {
    lines.push("", "**Resolved**", renderValue(resolved.$value));
  }

  if (literal.$deprecated) {
    const reason =
      typeof literal.$deprecated === "string" ? `: ${literal.$deprecated}` : "";
    lines.push("", `⚠ **Deprecated**${reason}`);
  }

  return lines.join("\n");
}
