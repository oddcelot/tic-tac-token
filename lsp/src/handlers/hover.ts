import type { FlatToken } from "dtcg-tokens/resolver";
import { flattenTokens } from "dtcg-tokens/resolver";
import type { Node } from "jsonc-parser";
import { type Hover, MarkupKind, type Position } from "vscode-languageserver";
import type { AnalysisResult } from "../analyzer.ts";
import { renderTokenHover } from "../utils/hover-markdown.ts";
import { nodeRange } from "../utils/positions.ts";

// Convert (line, character) → byte offset for jsonc-parser's
// position-based APIs. Linear scan over the text; cheap for typical
// document sizes.
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

// Walk up the ancestor chain in the AST to find the nearest enclosing
// "token" node — an object that has a `$value` or `$ref` property.
// Returns the token node and its dot-path from the document root.
function findEnclosingToken(
  root: Node | undefined,
  offset: number,
): { node: Node; path: string } | undefined {
  if (!root) return undefined;

  function visit(node: Node, prefix: string[]): { node: Node; path: string } | undefined {
    if (offset < node.offset || offset > node.offset + node.length) return undefined;

    if (node.type === "object" && node.children) {
      const isToken = node.children.some(
        (pair) =>
          pair.children?.[0]?.value === "$value" ||
          pair.children?.[0]?.value === "$ref",
      );
      // Recurse into properties first to find the deepest match.
      for (const pair of node.children) {
        const key = pair.children?.[0]?.value;
        const child = pair.children?.[1];
        if (typeof key === "string" && !key.startsWith("$") && child) {
          const deeper = visit(child, [...prefix, key]);
          if (deeper) return deeper;
        }
      }
      if (isToken) return { node, path: prefix.join(".") };
    }
    return undefined;
  }

  return visit(root, []);
}

export function hoverAt(
  result: AnalysisResult,
  position: Position,
): Hover | undefined {
  const offset = positionToOffset(result.text, position);
  const enclosing = findEnclosingToken(result.ast, offset);
  if (!enclosing) return undefined;

  // Build the literal token (pre-resolution) by flattening just the
  // node at this path from the original parsed value. We re-flatten the
  // whole document and pick the matching path — simpler than reaching
  // into the AST.
  const literalFlat = result.value !== undefined ? flattenTokens(result.value).tokens : [];
  const literal = literalFlat.find((t) => t.path === enclosing.path);
  if (!literal) return undefined;

  const resolved: FlatToken | undefined = result.resolved.byPath.get(enclosing.path);

  const markdown = renderTokenHover(literal, resolved);
  return {
    contents: { kind: MarkupKind.Markdown, value: markdown },
    range: nodeRange(result.text, enclosing.node),
  };
}

