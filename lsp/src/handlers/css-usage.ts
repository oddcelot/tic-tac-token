import type {
  Color,
  ColorInformation,
  ColorPresentation,
  Hover,
  Position,
} from "vscode-languageserver";
import { MarkupKind } from "vscode-languageserver";
import { dtcgColorToLspColor, lspColorToHex } from "../utils/color.ts";
import { buildCssVarIndex } from "../utils/css-vars.ts";
import { renderTokenHover } from "../utils/hover-markdown.ts";
import { makeOffsetToPosition, positionToOffset } from "../utils/positions.ts";
import type { WorkspaceIndex } from "../workspace/index.ts";

// Locate `var(--custom-prop)` usages (the reference site, not the
// `--x: value` definition). Fallbacks like `var(--x, #fff)` are matched on
// the custom-property name only. `#` / `.` etc. can't appear in the name.
const VAR_USAGE = /var\(\s*(--[A-Za-z0-9_-]+)/g;

type VarUsage = { name: string; start: number; end: number };

function scanVarUsages(text: string): VarUsage[] {
  const usages: VarUsage[] = [];
  VAR_USAGE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VAR_USAGE.exec(text)) !== null) {
    const name = match[1]!;
    // Range covers just the `--name` identifier, not the whole `var(`.
    const start = match.index + match[0].length - name.length;
    usages.push({ name, start, end: start + name.length });
  }
  return usages;
}

// `textDocument/documentColor` for a CSS-like document: a swatch on every
// `var(--…)` whose custom property maps (via convention A) to a color token
// somewhere in the workspace token index.
export function cssVarColors(
  text: string,
  index: WorkspaceIndex,
): ColorInformation[] {
  const varIndex = buildCssVarIndex(index);
  if (varIndex.size === 0) return [];
  const toPosition = makeOffsetToPosition(text);
  const out: ColorInformation[] = [];
  for (const usage of scanVarUsages(text)) {
    const entry = varIndex.get(usage.name);
    if (!entry || entry.token.$type !== "color") continue;
    const color = dtcgColorToLspColor(entry.token.$value);
    if (!color) continue;
    out.push({
      range: { start: toPosition(usage.start), end: toPosition(usage.end) },
      color,
    });
  }
  return out;
}

// `textDocument/hover` for a CSS-like document: when the cursor is on a
// `var(--…)` that resolves to a token, show the token's path, type, value,
// a color swatch (for color tokens), and the source file.
export function cssVarHover(
  text: string,
  position: Position,
  index: WorkspaceIndex,
): Hover | undefined {
  const offset = positionToOffset(text, position);
  const usage = scanVarUsages(text).find(
    (u) => offset >= u.start && offset <= u.end,
  );
  if (!usage) return undefined;
  const entry = buildCssVarIndex(index).get(usage.name);
  if (!entry) return undefined;
  const toPosition = makeOffsetToPosition(text);
  const body = renderTokenHover(entry.token, entry.token, {
    resolvedFrom: basename(entry.uri),
  });
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `\`${usage.name}\` →\n\n${body}`,
    },
    range: { start: toPosition(usage.start), end: toPosition(usage.end) },
  };
}

// Presentation for a CSS-var color: label-only hex (no text edit — the range
// is a `var(--…)` reference, and replacing it with a bare hex would strip the
// token indirection the author wants).
export function cssVarColorPresentations(color: Color): ColorPresentation[] {
  return [{ label: lspColorToHex(color) }];
}

// Last path segment of a URI, for a human-readable source label.
function basename(uri: string): string {
  const clean = uri.split(/[?#]/)[0] ?? uri;
  const parts = clean.split("/");
  return decodeURIComponent(parts[parts.length - 1] || clean);
}
