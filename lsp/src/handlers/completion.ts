import { flattenTokens } from "@oddsquad/tic-tac-token/resolver";
import type { Node } from "jsonc-parser";
import {
  type CompletionItem,
  CompletionItemKind,
  type CompletionList,
  type Position,
} from "vscode-languageserver";
import type { AnalysisResult } from "../analyzer.ts";
import { offsetToPosition } from "../utils/positions.ts";

// Convert (line, character) → byte offset. Linear scan; fine for
// typical document sizes. Mirrors the helper used by the hover handler;
// kept local rather than shared to avoid a circular import.
function positionToOffset(text: string, position: Position): number {
  let line = 0;
  let character = 0;
  for (let i = 0; i < text.length; i++) {
    if (line === position.line && character === position.character) return i;
    if (text.charCodeAt(i) === 0x0a /* \n */) {
      line++;
      character = 0;
    } else {
      character++;
    }
  }
  return text.length;
}

// Find the AST string node containing a given offset, if any.
function findStringNodeAt(root: Node | undefined, offset: number): Node | undefined {
  if (!root) return undefined;
  function visit(node: Node): Node | undefined {
    if (offset < node.offset || offset > node.offset + node.length) return undefined;
    if (node.type === "string") return node;
    if (node.children) {
      for (const child of node.children) {
        const result = visit(child);
        if (result) return result;
      }
    }
    return undefined;
  }
  return visit(root);
}

// Detect alias-string context at the cursor: cursor is inside a JSON
// string whose value starts with `{`, and is positioned before any
// closing `}`. Returns the literal path prefix between `{` and cursor.
type AliasContext = {
  prefix: string;
  prefixStartOffset: number; // absolute offset in the doc where the prefix starts
};

// Detect JSON-Pointer-string context: cursor is inside a string whose
// parent property is named `$ref`. Returns the literal prefix between
// the opening `"` and the cursor (typically begins with `#/`).
type PointerContext = {
  prefix: string;
  prefixStartOffset: number; // absolute offset at the opening `"` + 1
};

function jsonPointerContext(
  text: string,
  ast: Node | undefined,
  offset: number,
): PointerContext | undefined {
  const node = findStringNodeAt(ast, offset);
  if (!node) return undefined;
  const parent = node.parent;
  if (!parent || parent.type !== "property") return undefined;
  const keyNode = parent.children?.[0];
  if (!keyNode || keyNode.value !== "$ref") return undefined;

  const contentStart = node.offset + 1;
  if (offset < contentStart) return undefined;
  const upToCursor = text.slice(contentStart, offset);
  return { prefix: upToCursor, prefixStartOffset: contentStart };
}

// RFC 6901 escape: `~` → `~0`, `/` → `~1`. Applied per-segment.
function escapePointerSegment(s: string): string {
  return s.replace(/~/g, "~0").replace(/\//g, "~1");
}

function jsonPointerForToken(path: string): string {
  const segments = path.split(".").map(escapePointerSegment);
  return `#/${segments.join("/")}/$value`;
}

function aliasContext(text: string, ast: Node | undefined, offset: number): AliasContext | undefined {
  const node = findStringNodeAt(ast, offset);
  if (!node) return undefined;

  // Skip the opening quote at node.offset.
  const contentStart = node.offset + 1;
  if (offset < contentStart) return undefined;

  // Read string contents from source rather than relying on node.value
  // (which is the unescaped JSON value — offsets there don't correspond
  // to source offsets when there are escape sequences).
  const contentEnd = node.offset + node.length - 1; // skip closing quote (may not exist if unterminated)
  const upToCursor = text.slice(contentStart, offset);
  if (!upToCursor.startsWith("{")) return undefined;

  // If a closing `}` lies between `{` and cursor, we're past the alias.
  const aliasBody = upToCursor.slice(1);
  if (aliasBody.includes("}")) return undefined;
  void contentEnd;

  return {
    prefix: aliasBody,
    prefixStartOffset: contentStart + 1, // just after the `{`
  };
}

export function completionsAt(
  result: AnalysisResult,
  position: Position,
): CompletionList {
  const empty: CompletionList = { isIncomplete: false, items: [] };
  const offset = positionToOffset(result.text, position);

  // Alias context first: cursor inside a `"{...}"` string.
  const alias = aliasContext(result.text, result.ast, offset);
  if (alias) {
    const startPos = offsetToPosition(result.text, alias.prefixStartOffset);
    const range = { start: startPos, end: position };
    const items: CompletionItem[] = [];
    for (const token of result.resolved.tokens) {
      if (!token.path) continue;
      if (alias.prefix && !pathStartsWith(token.path, alias.prefix)) continue;
      items.push({
        label: token.path,
        kind: CompletionItemKind.Variable,
        detail: token.$type,
        documentation: token.$description,
        textEdit: { range, newText: token.path },
        filterText: token.path,
        sortText: token.path,
      });
    }
    return { isIncomplete: false, items };
  }

  // $ref pointer context: cursor inside a `"$ref": "#/..."` string.
  const pointer = jsonPointerContext(result.text, result.ast, offset);
  if (pointer) {
    const startPos = offsetToPosition(result.text, pointer.prefixStartOffset);
    const range = { start: startPos, end: position };
    const items: CompletionItem[] = [];
    // Use the pre-resolution literal flatten so we only suggest pointers
    // that actually exist in the source ($value-bearing tokens). Token-
    // root $ref tokens have no $value in source, so their path isn't a
    // valid pointer target — exclude them.
    const literalTokens =
      result.value !== undefined ? flattenTokens(result.value).tokens : [];
    for (const token of literalTokens) {
      if (!token.path) continue;
      const ptr = jsonPointerForToken(token.path);
      if (pointer.prefix && !pathStartsWith(ptr, pointer.prefix)) continue;
      items.push({
        label: ptr,
        kind: CompletionItemKind.Reference,
        detail: token.$type,
        documentation: token.$description,
        textEdit: { range, newText: ptr },
        filterText: ptr,
        sortText: ptr,
      });
    }
    return { isIncomplete: false, items };
  }

  return empty;
}

// Treat the alias path as dot-separated segments and compare segment-
// wise so a prefix like `color.neut` matches `color.neutral.text` but
// not `colorScheme.dark`.
function pathStartsWith(candidate: string, prefix: string): boolean {
  if (candidate.startsWith(prefix)) return true;
  // Allow case-insensitive partial-segment match: "Color.brand" matches "color.brand"
  return candidate.toLowerCase().startsWith(prefix.toLowerCase());
}
