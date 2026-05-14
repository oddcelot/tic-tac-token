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
  const ctx = aliasContext(result.text, result.ast, offset);
  if (!ctx) return empty;

  // Build replacement range: from just after the `{` to the cursor.
  const startPos = offsetToPosition(result.text, ctx.prefixStartOffset);
  const range = { start: startPos, end: position };

  // Suggest every resolved token. Monaco/IDE-side filtering narrows by
  // what the user has typed (`ctx.prefix`), so the server is permissive.
  const items: CompletionItem[] = [];
  for (const token of result.resolved.tokens) {
    if (!token.path) continue;
    if (ctx.prefix && !pathStartsWith(token.path, ctx.prefix)) continue;
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

// Treat the alias path as dot-separated segments and compare segment-
// wise so a prefix like `color.neut` matches `color.neutral.text` but
// not `colorScheme.dark`.
function pathStartsWith(candidate: string, prefix: string): boolean {
  if (candidate.startsWith(prefix)) return true;
  // Allow case-insensitive partial-segment match: "Color.brand" matches "color.brand"
  return candidate.toLowerCase().startsWith(prefix.toLowerCase());
}
