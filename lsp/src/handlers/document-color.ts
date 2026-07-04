import { aliasTarget } from "@oddsquad/tic-tac-token/resolver";
import type { FlatToken } from "@oddsquad/tic-tac-token/resolver";
import { findNodeAtLocation, type Node } from "jsonc-parser";
import type {
  Color,
  ColorInformation,
  ColorPresentation,
  Range,
} from "vscode-languageserver";
import type { AnalysisResult } from "../analyzer.ts";
import { dtcgColorToLspColor, lspColorToHex } from "../utils/color.ts";
import { makeOffsetToPosition } from "../utils/positions.ts";
import type { WorkspaceIndex } from "../workspace/index.ts";

const MODES_KEY = "tic-tac-token.modes";

// Produce `textDocument/documentColor` swatches for a token document.
// Two sources of colors:
//   1. Color-typed tokens whose `$value` is a literal color object — the
//      swatch sits on the `hex` string when present (the most color-like
//      span), else the whole `$value` object node.
//   2. Alias (`{path}`) and `$ref` strings that resolve to a color token,
//      locally or elsewhere in the workspace — the swatch covers the whole
//      reference string.
// Ranges are always whole AST nodes (or the whole `hex` string), never
// sub-string offsets, so JSON escape sequences can never misplace a swatch.
export function documentColors(
  result: AnalysisResult,
  index?: WorkspaceIndex,
  uri?: string,
): ColorInformation[] {
  const ast = result.ast;
  if (!ast) return [];
  const toPosition = makeOffsetToPosition(result.text);
  const rangeOf = (node: Node): Range => ({
    start: toPosition(node.offset),
    end: toPosition(node.offset + node.length),
  });

  const infos: ColorInformation[] = [];

  // Pass 1 — literal color objects on color-typed tokens (incl. mode variants).
  for (const token of result.resolved.tokens) {
    if (token.$type !== "color") continue;
    const valueNode = valueNodeFor(ast, token);
    if (!valueNode || valueNode.type !== "object") continue; // alias strings → pass 2
    const color = dtcgColorToLspColor(token.$value);
    if (!color) continue;
    const hexNode = findNodeAtLocation(valueNode, ["hex"]);
    const target = hexNode && hexNode.type === "string" ? hexNode : valueNode;
    infos.push({ range: rangeOf(target), color });
  }

  // Pass 2 — alias / $ref strings that resolve to a color token.
  visitStrings(ast, (node) => {
    const targetPath = referenceTargetPath(node);
    if (!targetPath) return;
    const resolved = resolveColor(targetPath, result, index, uri);
    if (!resolved) return;
    const color = dtcgColorToLspColor(resolved.$value);
    if (!color) return;
    infos.push({ range: rangeOf(node), color });
  });

  return infos;
}

// Presentation shown when a client asks how to render/apply a picked
// color. Label-only (no textEdit): the range may be an alias string or a
// structured `$value` object, and rewriting either as a bare hex would
// corrupt the token. The hex label is informational.
export function colorPresentations(color: Color): ColorPresentation[] {
  return [{ label: lspColorToHex(color) }];
}

// Locate the AST value node holding a flat token's `$value`. For mode
// variants (`path@mode`) that's the value under
// `$extensions."tic-tac-token.modes".<mode>`; otherwise the `$value` node.
function valueNodeFor(ast: Node, token: FlatToken): Node | undefined {
  if (token.mode) {
    const base = token.path.slice(0, token.path.length - token.mode.length - 1);
    const segments = base.length ? base.split(".") : [];
    return findNodeAtLocation(ast, [
      ...segments,
      "$extensions",
      MODES_KEY,
      token.mode,
    ]);
  }
  const segments = token.path.length ? token.path.split(".") : [];
  return findNodeAtLocation(ast, [...segments, "$value"]);
}

// A string node's referenced token path, if it is an alias (`{path}`) or a
// `$ref` JSON Pointer value. Returns undefined for ordinary strings.
function referenceTargetPath(node: Node): string | undefined {
  if (typeof node.value !== "string") return undefined;
  const alias = aliasTarget(node.value);
  if (alias) return alias;
  const parent = node.parent;
  if (
    parent?.type === "property" &&
    parent.children?.[0]?.value === "$ref" &&
    node.value.startsWith("#/")
  ) {
    return pointerToPath(node.value);
  }
  return undefined;
}

// `#/color/primary/$value` → `color.primary`. Inverse of the pointer built
// in completion.ts: drop a trailing `$value`, RFC-6901 unescape each segment.
function pointerToPath(pointer: string): string {
  const segments = pointer
    .slice(2)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (segments[segments.length - 1] === "$value") segments.pop();
  return segments.join(".");
}

function resolveColor(
  path: string,
  result: AnalysisResult,
  index: WorkspaceIndex | undefined,
  uri: string | undefined,
): FlatToken | undefined {
  const local = result.resolved.byPath.get(path);
  if (local) return local.$type === "color" ? local : undefined;
  const cross = index?.lookup(path, uri)[0]?.token;
  return cross && cross.$type === "color" ? cross : undefined;
}

// Visit every string node in the tree in source order.
function visitStrings(root: Node, visit: (node: Node) => void): void {
  const walk = (node: Node): void => {
    if (node.type === "string") visit(node);
    if (node.children) for (const child of node.children) walk(child);
  };
  walk(root);
}
