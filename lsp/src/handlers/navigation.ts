import { aliasTarget } from "@oddsquad/tic-tac-token/resolver";
import { findNodeAtLocation, type Node } from "jsonc-parser";
import { type Location, type Position, type Range } from "vscode-languageserver";
import type { AnalysisResult } from "../analyzer.ts";
import { nodeRange, positionToOffset } from "../utils/positions.ts";
import type { WorkspaceIndex } from "../workspace/index.ts";
import { findStringNodeAt } from "./completion.ts";
import { findEnclosingToken } from "./hover.ts";

// Mirrors flatten.ts's MODES_KEY — the `$extensions` sub-key under which
// mode variants live: `<token>.$extensions."tic-tac-token.modes".<mode>`.
const MODES_KEY = "tic-tac-token.modes";

// Map a resolved flat path (possibly a mode variant `a.b@dark`) to AST
// segments for findNodeAtLocation. A mode variant's value lives under
// the token's `$extensions."tic-tac-token.modes"` object, under the mode
// name — not as a further path segment.
function pathToAstSegments(path: string): string[] {
  const at = path.indexOf("@");
  if (at !== -1) {
    return [
      ...path.slice(0, at).split("."),
      "$extensions",
      MODES_KEY,
      path.slice(at + 1),
    ];
  }
  return path.split(".");
}

// A JSON `$ref` pointer → flat token path. Drops a trailing
// `$value`/`$type` so the pointer maps to its owning token.
function pointerToPath(pointer: string): string | undefined {
  const normalized = pointer.startsWith("#/") ? pointer.slice(2) : pointer;
  const segments = normalized
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
    .filter((s) => s.length > 0);
  while (segments.length > 0) {
    const last = segments[segments.length - 1]!;
    if (last === "$value" || last === "$type") segments.pop();
    else break;
  }
  return segments.length > 0 ? segments.join(".") : undefined;
}

// The `{alias}` / `$ref` target under the cursor, if any. Only whole-
// string aliases and `$ref` pointer values count as navigable
// references; a cursor on a token key or metadata is not.
type CursorRef = { path: string; isPointer: boolean };
function cursorRefAt(result: AnalysisResult, offset: number): CursorRef | undefined {
  const node = findStringNodeAt(result.ast, offset);
  if (!node || typeof node.value !== "string") return undefined;
  const alias = aliasTarget(node.value);
  if (alias) return { path: alias, isPointer: false };
  const parent = node.parent;
  if (parent?.type === "property" && parent.children?.[0]?.value === "$ref") {
    const path = pointerToPath(node.value);
    if (path) return { path, isPointer: true };
  }
  return undefined;
}

// Range of a token's defining key (`"primary"` in `"primary": {…}`)
// within an analysis. Used as the go-to-definition target and the
// declaration entry in find-references.
export function tokenKeyRange(
  analysis: AnalysisResult,
  path: string,
): Range | undefined {
  const { ast, text } = analysis;
  if (!ast) return undefined;
  const node = findNodeAtLocation(ast, pathToAstSegments(path));
  if (!node) return undefined;
  const keyNode = node.parent?.children?.[0];
  return keyNode ? nodeRange(text, keyNode) : nodeRange(text, node);
}

// Find the property-value node for `key` inside an object node.
function childValue(node: Node, key: string): Node | undefined {
  for (const pair of node.children ?? []) {
    if (pair.children?.[0]?.value === key) return pair.children?.[1];
  }
  return undefined;
}

// Deepest string node in the subtree whose value is a `{…}` alias.
function findAliasString(node: Node): Node | undefined {
  if (node.type === "string") {
    return aliasTarget(node.value) !== undefined ? node : undefined;
  }
  for (const child of node.children ?? []) {
    const result = findAliasString(child);
    if (result) return result;
  }
  return undefined;
}

// Range of the actual reference (the alias string or `$ref` value)
// inside the token at `path`. Prefers the direct `$value` string and the
// `$ref` value; falls back to scanning the token's subtree (embedded
// aliases) and finally the token key.
function referenceRange(analysis: AnalysisResult, path: string): Range | undefined {
  const { ast, text } = analysis;
  const node = ast ? findNodeAtLocation(ast, pathToAstSegments(path)) : undefined;
  if (!node) return undefined;

  const refValue = childValue(node, "$ref");
  if (refValue?.type === "string") return nodeRange(text, refValue);

  const valueNode = childValue(node, "$value");
  if (valueNode) {
    if (valueNode.type === "string" && aliasTarget(valueNode.value)) {
      return nodeRange(text, valueNode);
    }
    const aliased = findAliasString(valueNode);
    if (aliased) return nodeRange(text, aliased);
  }

  return tokenKeyRange(analysis, path);
}

// Ranges of every `$ref` value string in the document whose pointer
// targets `path`. Complements the resolver's `references` graph, which
// only records `{…}` alias strings — `$ref` usages are discovered by an
// AST scan because the resolver rewrites them away before building the
// graph.
function pointerRefRanges(analysis: AnalysisResult, path: string): Range[] {
  const { ast, text } = analysis;
  if (!ast) return [];
  const ranges: Range[] = [];
  const visit = (node: Node): void => {
    if (node.type === "property") {
      const key = node.children?.[0]?.value;
      const value = node.children?.[1];
      if (
        key === "$ref" &&
        value?.type === "string" &&
        typeof value.value === "string" &&
        pointerToPath(value.value) === path
      ) {
        ranges.push(nodeRange(text, value));
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(ast);
  return ranges;
}

export function definitionAt(
  result: AnalysisResult,
  position: Position,
  index?: WorkspaceIndex,
  uri?: string,
): Location | undefined {
  if (!result.ast || !uri) return undefined;
  const ref = cursorRefAt(result, positionToOffset(result.text, position));
  if (!ref) return undefined;

  const localRange = tokenKeyRange(result, ref.path);
  if (localRange) return { uri, range: localRange };

  // `$ref` JSON Pointers are single-document by definition — only
  // `{alias}` strings resolve cross-file.
  if (index && !ref.isPointer) {
    const matches = index.lookup(ref.path, uri);
    if (matches.length > 0) {
      const target = matches[0]!;
      const analysis = index.analysisOf(target.uri);
      const range = analysis ? tokenKeyRange(analysis, ref.path) : undefined;
      if (range) return { uri: target.uri, range };
    }
  }
  return undefined;
}

export function referencesAt(
  result: AnalysisResult,
  position: Position,
  index?: WorkspaceIndex,
  uri?: string,
): Location[] {
  const locations: Location[] = [];
  if (!result.ast || !uri) return locations;
  const offset = positionToOffset(result.text, position);

  const ref = cursorRefAt(result, offset);
  const cursorPath =
    ref?.path ?? findEnclosingToken(result.ast, offset)?.path;
  if (!cursorPath) return locations;

  const seen = new Set<string>();
  const push = (targetUri: string, range: Range) => {
    const key = `${targetUri}:${range.start.line}:${range.start.character}`;
    if (seen.has(key)) return;
    seen.add(key);
    locations.push({ uri: targetUri, range });
  };

  // The symbol's definition (current file plus any workspace copies).
  const defHere = tokenKeyRange(result, cursorPath);
  if (defHere) push(uri, defHere);
  if (index) {
    for (const match of index.lookup(cursorPath, uri)) {
      const analysis = index.analysisOf(match.uri);
      const range = analysis ? tokenKeyRange(analysis, cursorPath) : undefined;
      if (range) push(match.uri, range);
    }
  }

  // In-document aliases referencing the symbol.
  for (const refPath of result.resolved.references.get(cursorPath) ?? []) {
    const range = referenceRange(result, refPath);
    if (range) push(uri, range);
  }
  // In-document `$ref` pointers referencing the symbol.
  for (const range of pointerRefRanges(result, cursorPath)) {
    push(uri, range);
  }

  // Cross-file aliases referencing the symbol.
  if (index) {
    for (const { uri: otherUri, analysis } of index.entries()) {
      if (otherUri === uri) continue;
      for (const refPath of analysis.resolved.references.get(cursorPath) ?? []) {
        const range = referenceRange(analysis, refPath);
        if (range) push(otherUri, range);
      }
      // Cross-file `$ref` pointers (uncommon, but cheap when they exist).
      for (const range of pointerRefRanges(analysis, cursorPath)) {
        push(otherUri, range);
      }
    }
  }

  return locations;
}